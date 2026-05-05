# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Data models for the financial-tracker project app.
#              Defines five related models — UserProfile, Category,
#              PaymentMethod, RecurringExpense, and PriceHistory — that together
#              capture a user's recurring subscriptions/bills and the history
#              of price changes for each one.

from decimal import Decimal

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """
    @notice Per-user profile that augments Django's built-in User model with
            financial-tracker preferences (income, currency).
    @dev OneToOne to settings.AUTH_USER_MODEL so each Django user has at most
         one profile. All user-owned models in this app FK to UserProfile,
         not directly to User, so business logic stays decoupled from auth.
    """

    CURRENCY_CHOICES = [
        ("USD", "US Dollar"),
        ("EUR", "Euro"),
        ("GBP", "British Pound"),
        ("JPY", "Japanese Yen"),
        ("CAD", "Canadian Dollar"),
        ("AUD", "Australian Dollar"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="financial_profile",
    )
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency_preference = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="USD")

    def __str__(self):
        """
        @notice Returns a human-readable string for this profile.
        @return Username plus the configured currency code.
        """
        return f"{self.user.username} ({self.currency_preference})"


class Category(models.Model):
    """
    @notice A spending category (e.g. Housing, Utilities, Subscriptions — SaaS).
    @dev Standalone model with no foreign keys — every other user-owned model
         in the app references this one. Per design D1, categories are global
         (shared across all users) for v1; per-user customization is a v2 goal.
    """

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_essential = models.BooleanField(default=False)
    budget_goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        """
        @notice Returns the category's name for display.
        @return The category name.
        """
        return self.name


class PaymentMethod(models.Model):
    """
    @notice A payment instrument owned by a user (credit card, debit card, or
            checking account) used to pay recurring expenses.
    @dev FK to UserProfile so methods are scoped per-user. expiry_date is
         optional because checking accounts do not expire.
    """

    METHOD_TYPE_CHOICES = [
        ("CREDIT_CARD", "Credit Card"),
        ("DEBIT_CARD", "Debit Card"),
        ("CHECKING", "Checking Account"),
    ]

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="payment_methods")
    nickname = models.CharField(max_length=100)
    method_type = models.CharField(max_length=20, choices=METHOD_TYPE_CHOICES)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["nickname", "id"]

    def __str__(self):
        """
        @notice Returns a human-readable string for this payment method.
        @return Owner username, nickname, and short type label, e.g.
                "alice_anderson — Chase Sapphire (Credit Card)". The username
                prefix disambiguates payment methods across users that may
                share nicknames or types in the admin and FK selectors.
        """
        return f"{self.user.user.username} — {self.nickname} ({self.get_method_type_display()})"


class RecurringExpense(models.Model):
    """
    @notice A recurring subscription or bill (e.g. Netflix, electricity, rent).
    @dev Carries three foreign keys — UserProfile, Category, and an OPTIONAL
         PaymentMethod (per design D2/D3, this is nullable so users can log
         loosely-attributed expenses like groceries before assigning a card).

         The save() override implements the PriceHistory auto-creation rule
         from design D4/D8: an initial PriceHistory row is created on first
         save (so the timeline starts at the original price), and a new row
         is appended whenever expense_amount changes on a subsequent save.

         Callers that want to attach a change_note to that auto-created
         row (chunk 4h: prompt at edit time) can set
         `_pending_change_note` on the instance before calling save();
         the override consumes and clears the attribute so it doesn't
         leak into a subsequent save() on the same instance.
    """

    BILLING_CYCLE_CHOICES = [
        ("MONTHLY", "Monthly"),
        ("QUARTERLY", "Quarterly"),
        ("ANNUALLY", "Annually"),
    ]

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="expenses")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="expenses")
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        related_name="expenses",
        null=True,
        blank=True,
    )

    service_name = models.CharField(max_length=200)
    expense_amount = models.DecimalField(max_digits=12, decimal_places=2)
    billing_cycle = models.CharField(max_length=10, choices=BILLING_CYCLE_CHOICES, default="MONTHLY")
    next_due_date = models.DateField()
    is_active = models.BooleanField(default=True)
    # Free-text user notes (added in chunk 4h). Lets the user disambiguate
    # near-identical expenses (e.g. "rent for the second apartment") and
    # pin context that wouldn't fit the structured fields.
    notes = models.TextField(blank=True)
    # Optional URL to the expense's payment portal (added in chunk 4h).
    # The mobile UI surfaces this as a tappable button so users can jump
    # straight to where they pay this bill rather than searching for it.
    payment_url = models.URLField(blank=True, max_length=500)

    class Meta:
        ordering = ["next_due_date", "service_name"]

    def __str__(self):
        """
        @notice Returns a human-readable string for this expense.
        @return Owner username, service name, and the formatted recurring
                amount, e.g. "carol_chen — Adobe Creative Cloud — 54.99 USD/monthly".
                The username prefix disambiguates similarly-named services
                across users.
        """
        return (
            f"{self.user.user.username} — {self.service_name} — "
            f"{self.expense_amount} {self.user.currency_preference}/{self.get_billing_cycle_display().lower()}"
        )

    def save(self, *args, **kwargs):
        """
        @notice Persists the expense and maintains its PriceHistory timeline.
        @dev On first save (no pk), this method creates the row and then
             appends an initial PriceHistory entry capturing the starting
             price. On subsequent saves, it compares the incoming
             expense_amount against the value stored in the database; if
             different, it appends a new PriceHistory row after the save
             completes. The change_note defaults to empty — per D8 the user
             can edit the note later from the price-history detail page.
        """
        from django.utils import timezone

        creating = self._state.adding
        previous_amount = None
        if not creating:
            previous_amount = (
                RecurringExpense.objects.filter(pk=self.pk)
                .values_list("expense_amount", flat=True)
                .first()
            )

        super().save(*args, **kwargs)

        # Both the initial row and any subsequent change row are stamped
        # with today's date — date_changed represents "when this price
        # became effective for tracking purposes", which is the moment of
        # the action (create or edit), not the future next_due_date.
        today = timezone.now().date()

        # Caller-supplied note for this price change (set by the
        # serializer's update() in chunk 4h). Pulled and cleared here so
        # the same instance can't accidentally re-use the note on a
        # follow-up save.
        pending_note = getattr(self, "_pending_change_note", "") or ""
        if hasattr(self, "_pending_change_note"):
            self._pending_change_note = ""

        if creating:
            PriceHistory.objects.create(
                expense=self,
                amount_recorded=self.expense_amount,
                date_changed=today,
                change_note="Initial price recorded.",
            )
        elif previous_amount is not None and previous_amount != self.expense_amount:
            PriceHistory.objects.create(
                expense=self,
                amount_recorded=self.expense_amount,
                date_changed=today,
                change_note=pending_note,
            )


class PriceHistory(models.Model):
    """
    @notice A single point on a RecurringExpense's price timeline.
    @dev FK to RecurringExpense. Rows are created automatically by
         RecurringExpense.save() (see D4/D8): one on initial creation and one
         per subsequent amount change. Users may edit change_note on existing
         rows after the fact (the D8 safety net), but amount_recorded and
         date_changed should be considered append-only history.
    """

    expense = models.ForeignKey(
        RecurringExpense, on_delete=models.CASCADE, related_name="price_history"
    )
    amount_recorded = models.DecimalField(max_digits=12, decimal_places=2)
    date_changed = models.DateField()
    change_note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "price history"
        ordering = ["-date_changed", "-id"]

    def __str__(self):
        """
        @notice Returns a human-readable string for this history row.
        @return Owner username, service name, recorded amount, and date of
                change, e.g. "alice_anderson — Netflix: 15.99 on 2026-05-15".
                The username prefix disambiguates timeline rows across users
                in admin and FK selectors.
        """
        return (
            f"{self.expense.user.user.username} — {self.expense.service_name}: "
            f"{self.amount_recorded} on {self.date_changed}"
        )
