# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: DRF serializers for the financial-tracker project app.
#              Each serializer mirrors a model in models.py and is consumed
#              by the corresponding ViewSet in views.py. Read-only fields
#              are used for owner/derived data so clients cannot spoof
#              ownership or rewrite immutable history rows.

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Category,
    PaymentMethod,
    PriceHistory,
    RecurringExpense,
    UserProfile,
)


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    @notice Serializes inbound sign-up payloads and creates a Django User.
    @dev Matches the pattern from the course lesson on DRF auth: password is
         write-only so it never appears in responses, and `create()` calls
         User.objects.create_user so the password is hashed correctly. The
         companion UserProfile row is created by the registration view, not
         here, so this serializer remains focused on the User model alone.
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "password", "email"]
        extra_kwargs = {"email": {"required": False, "allow_blank": True}}

    def create(self, validated_data):
        """
        @notice Persists a new auth User with a hashed password.
        @return The newly-created User instance.
        """
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=validated_data.get("email", ""),
        )


class UserProfileSerializer(serializers.ModelSerializer):
    """
    @notice Serializes a UserProfile for the /api/profile/ endpoint.
    @dev Exposes the linked Django username read-only so the client knows
         which account it is editing without being able to reassign it.
    """

    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["id", "username", "monthly_income", "currency_preference"]
        read_only_fields = ["id", "username"]


class CategorySerializer(serializers.ModelSerializer):
    """
    @notice Serializes a global Category for the /api/categories/ endpoint.
    @dev Per design D1 categories are global and read-only over the API.
         All fields are exposed because categories are not user-sensitive.
    """

    class Meta:
        model = Category
        fields = ["id", "name", "description", "is_essential", "budget_goal"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    """
    @notice Serializes a PaymentMethod for the /api/payment-methods/ endpoint.
    @dev The owning UserProfile is read-only and assigned automatically by
         the ViewSet from the authenticated request — clients cannot create
         a payment method on behalf of another user.
    """

    user = serializers.PrimaryKeyRelatedField(read_only=True)
    method_type_label = serializers.CharField(source="get_method_type_display", read_only=True)

    class Meta:
        model = PaymentMethod
        fields = [
            "id",
            "user",
            "nickname",
            "method_type",
            "method_type_label",
            "expiry_date",
        ]
        read_only_fields = ["id", "user", "method_type_label"]


class PriceHistorySerializer(serializers.ModelSerializer):
    """
    @notice Serializes a PriceHistory row.
    @dev amount_recorded and date_changed are read-only — per design D8
         only the change_note is editable post-hoc. The expense FK is also
         read-only so a row cannot be reparented to a different expense.
    """

    class Meta:
        model = PriceHistory
        fields = ["id", "expense", "amount_recorded", "date_changed", "change_note"]
        read_only_fields = ["id", "expense", "amount_recorded", "date_changed"]


class RecurringExpenseSerializer(serializers.ModelSerializer):
    """
    @notice Serializes a RecurringExpense for the /api/expenses/ endpoint.
    @dev The owning user is read-only and stamped from request.user by the
         ViewSet. category and payment_method accept primary keys on write;
         a `category_name` convenience field is exposed read-only for clients
         that want to render the category without a second API call. The
         nested price_history list is read-only here — clients fetch detail
         via the nested action or the standalone /api/price-history/
         endpoint.

         Chunk 4h additions:
         - `notes` (free-text) and `payment_url` (URL) round-trip normally.
         - `pending_change_note` is write-only: when present on a PATCH
           that changes `expense_amount`, the value is forwarded to
           `RecurringExpense.save()` via the `_pending_change_note`
           instance attribute and persisted on the auto-created
           `PriceHistory` row.
    """

    user = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    billing_cycle_label = serializers.CharField(
        source="get_billing_cycle_display", read_only=True
    )
    price_history = PriceHistorySerializer(many=True, read_only=True)
    pending_change_note = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "user",
            "category",
            "category_name",
            "payment_method",
            "service_name",
            "expense_amount",
            "billing_cycle",
            "billing_cycle_label",
            "next_due_date",
            "is_active",
            "notes",
            "payment_url",
            "price_history",
            "pending_change_note",
        ]
        read_only_fields = [
            "id",
            "user",
            "category_name",
            "billing_cycle_label",
            "price_history",
        ]

    def update(self, instance, validated_data):
        """
        @notice Forwards a caller-supplied price-change note onto the
                model instance so save() can attach it to the
                auto-created PriceHistory row.
        @dev `pending_change_note` is consumed here and never reaches the
             ORM as a model field. If the amount didn't actually change,
             the note is silently discarded (no PriceHistory row exists
             to attach it to).
        """
        pending = validated_data.pop("pending_change_note", "")
        instance._pending_change_note = pending
        return super().update(instance, validated_data)

    def create(self, validated_data):
        """
        @notice Drops `pending_change_note` on create — the initial
                PriceHistory row uses the fixed "Initial price recorded."
                copy.
        """
        validated_data.pop("pending_change_note", None)
        return super().create(validated_data)
