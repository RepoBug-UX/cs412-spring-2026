# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Django admin registrations for the financial-tracker project app.
#              Customizes the change-list display for each model so the
#              admin UI is useful for the Week 2 checkpoint deliverable
#              (admin screenshot PDF) and for ongoing dev-time inspection.

from django.contrib import admin

from .models import (
    Category,
    PaymentMethod,
    PriceHistory,
    RecurringExpense,
    UserProfile,
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """
    @notice Admin registration for UserProfile.
    @dev Surfaces the linked Django username and currency in the change-list
         so profiles are easy to identify alongside Django's own auth.User
         table.
    """

    list_display = ("user", "monthly_income", "currency_preference")
    list_filter = ("currency_preference",)
    search_fields = ("user__username", "user__email")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """
    @notice Admin registration for Category.
    @dev Categories are global (per design D1); the change-list shows the
         essential flag and budget goal so seeded data is reviewable at a
         glance.
    """

    list_display = ("name", "is_essential", "budget_goal")
    list_filter = ("is_essential",)
    search_fields = ("name", "description")


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    """
    @notice Admin registration for PaymentMethod.
    @dev Filtering by method_type and surfacing the owning user makes it easy
         to audit a single user's wallet during development.
    """

    list_display = ("nickname", "method_type", "user", "expiry_date")
    list_filter = ("method_type",)
    search_fields = ("nickname", "user__user__username")


@admin.register(RecurringExpense)
class RecurringExpenseAdmin(admin.ModelAdmin):
    """
    @notice Admin registration for RecurringExpense.
    @dev The change-list is the densest view of the system — it spans all
         three FK relationships plus the billing cycle and active flag, so
         it is the most useful single page for seeing the state of a user's
         finances during development.
    """

    list_display = (
        "service_name",
        "user",
        "category",
        "payment_method",
        "expense_amount",
        "billing_cycle",
        "next_due_date",
        "is_active",
    )
    list_filter = ("billing_cycle", "is_active", "category")
    search_fields = ("service_name", "user__user__username")
    autocomplete_fields = ("user", "category", "payment_method")


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    """
    @notice Admin registration for PriceHistory.
    @dev Read-mostly model — rows are created automatically by
         RecurringExpense.save(). The list-display orders surface the
         expense and date so timelines are inspectable in chronological order.
    """

    list_display = ("expense", "amount_recorded", "date_changed", "change_note")
    list_filter = ("date_changed",)
    search_fields = ("expense__service_name", "change_note")
