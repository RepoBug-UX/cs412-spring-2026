# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: DRF views for the financial-tracker project app. Defines
#              ViewSets for the user-owned models (PaymentMethod,
#              RecurringExpense, PriceHistory), a read-only ViewSet for
#              global categories, a singleton view for the current user's
#              profile, and a function-based view that produces the
#              "Price Increase Report" required by DESIGN.md §9.6.

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.utils import timezone
from django.views.generic import DetailView, ListView, TemplateView
from rest_framework import generics, mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Category, PaymentMethod, PriceHistory, RecurringExpense, UserProfile
from .serializers import (
    CategorySerializer,
    PaymentMethodSerializer,
    PriceHistorySerializer,
    RecurringExpenseSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


class CurrentProfileView(generics.RetrieveUpdateAPIView):
    """
    @notice Singleton endpoint that returns or updates the requesting user's
            UserProfile.
    @dev Mounted at /project/api/profile/ — there is no list or create here
         because each Django user has at most one financial profile. PUT/PATCH
         updates the calling user's own profile only; the resource cannot be
         reassigned.
    """

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """
        @notice Returns the requesting user's UserProfile.
        @dev Raises UserProfile.DoesNotExist if the authenticated Django
             user has no associated profile (handled by DRF as a 404).
             Profile auto-creation on signup is a Phase 3 concern.
        """
        return self.request.user.financial_profile


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    @notice Read-only ViewSet exposing the global Category list.
    @dev Per design D1 categories are global and seeded by data migration
         0002_seed_categories. Authenticated users can list and retrieve
         them, but the API does not permit creates, updates, or deletes —
         category management is admin-only for v1.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """
    @notice CRUD ViewSet for the requesting user's PaymentMethods.
    @dev get_queryset filters to the calling user's profile so users can
         never see or modify another user's payment methods. perform_create
         stamps the owning UserProfile from request.user, ignoring any
         attempt by the client to set it.
    """

    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        @notice Restricts the queryset to payment methods owned by the caller.
        @return PaymentMethod queryset filtered to request.user.financial_profile.
        """
        return PaymentMethod.objects.filter(user=self.request.user.financial_profile)

    def perform_create(self, serializer):
        """
        @notice Persists a new PaymentMethod owned by the caller.
        @dev The owning UserProfile is set server-side from the request,
             so clients cannot create payment methods on behalf of others.
        """
        serializer.save(user=self.request.user.financial_profile)


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    """
    @notice CRUD ViewSet for the requesting user's RecurringExpenses.
    @dev Implements the search/filter requirement from DESIGN.md §9.6.
         Supported query params on list:
            - category=<id>           filter by Category id
            - billing_cycle=<MONTHLY|QUARTERLY|ANNUALLY>
            - is_essential=<true|false>   filter via category.is_essential
            - is_active=<true|false>
            - due_within_days=<int>   next_due_date within N days from today
         Filters compose with AND semantics. The price_history nested action
         (GET /api/expenses/<pk>/price-history/) returns the timeline rows
         for one expense, mirroring the §5.1 nested route without requiring
         drf-nested-routers.
    """

    serializer_class = RecurringExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        @notice Restricts the queryset to expenses owned by the caller and
                applies the §9.6 filter query params if present.
        @return Filtered RecurringExpense queryset.
        """
        qs = RecurringExpense.objects.filter(
            user=self.request.user.financial_profile
        ).select_related("category", "payment_method")

        params = self.request.query_params

        category_id = params.get("category")
        if category_id:
            qs = qs.filter(category_id=category_id)

        billing_cycle = params.get("billing_cycle")
        if billing_cycle:
            qs = qs.filter(billing_cycle=billing_cycle)

        is_essential = params.get("is_essential")
        if is_essential is not None:
            qs = qs.filter(category__is_essential=_parse_bool(is_essential))

        is_active = params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=_parse_bool(is_active))

        due_within_days = params.get("due_within_days")
        if due_within_days is not None:
            try:
                horizon = timezone.now().date() + timedelta(days=int(due_within_days))
                qs = qs.filter(next_due_date__lte=horizon)
            except ValueError:
                pass  # silently ignore non-integer input; matches DRF defaults

        return qs

    def perform_create(self, serializer):
        """
        @notice Persists a new RecurringExpense owned by the caller.
        @dev Owner is stamped from request.user. The model's save() override
             handles the initial PriceHistory row (D4/D8) automatically.
        """
        serializer.save(user=self.request.user.financial_profile)

    @action(detail=True, methods=["get"], url_path="price-history")
    def price_history(self, request, pk=None):
        """
        @notice Returns the PriceHistory timeline for a single expense.
        @dev Mirrors the nested route described in DESIGN.md §5.1 without
             pulling in drf-nested-routers. Per-user filtering is inherited
             from get_queryset, so users cannot access another user's
             timelines even by guessing primary keys.
        """
        expense = self.get_object()
        rows = expense.price_history.all()
        serializer = PriceHistorySerializer(rows, many=True)
        return Response(serializer.data)


class PriceHistoryViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    @notice Read + partial-update ViewSet for PriceHistory rows.
    @dev Per design D8, individual rows can have their change_note edited
         after the fact; amount_recorded and date_changed are read-only at
         the serializer layer. Create and destroy are deliberately omitted —
         rows are created by RecurringExpense.save() and never deleted by
         clients.
    """

    serializer_class = PriceHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        @notice Restricts to PriceHistory rows whose parent expense belongs
                to the caller.
        @return Filtered PriceHistory queryset.
        """
        return PriceHistory.objects.filter(
            expense__user=self.request.user.financial_profile
        ).select_related("expense")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def price_change_report(request):
    """
    @notice "Price Change Report" — the cross-model derived report
            required by DESIGN.md §9.6. Surfaces both increases and
            decreases over the trailing window so users see the full
            picture (e.g. a loan payment dropping after a balance change
            is just as worth flagging as a subscription getting more
            expensive).
    @dev For each of the calling user's RecurringExpenses, looks at the
         PriceHistory rows whose date_changed falls within the trailing
         window (default 365 days) and reports the ones whose latest
         recorded amount differs from the earliest in the window. Each
         row carries `direction` ("increase" | "decrease"), the signed
         absolute change, and the signed percent change. Sort order is
         by absolute percent change descending, so the biggest movers
         (regardless of direction) surface first.

         Query params:
            - window_days=<int>   trailing window length, default 365
    @return JSON object with window_days, count, and a results list.
    """
    profile = request.user.financial_profile

    raw_window = request.query_params.get("window_days", "365")
    try:
        window_days = max(1, int(raw_window))
    except ValueError:
        return Response(
            {"detail": f"window_days must be an integer, got {raw_window!r}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cutoff = timezone.now().date() - timedelta(days=window_days)

    changes = []
    expenses = profile.expenses.filter(is_active=True).prefetch_related("price_history")
    for expense in expenses:
        in_window = list(
            expense.price_history.filter(date_changed__gte=cutoff).order_by("date_changed", "id")
        )
        if len(in_window) < 2:
            continue
        first_row, latest_row = in_window[0], in_window[-1]
        if latest_row.amount_recorded == first_row.amount_recorded:
            continue
        absolute_change = latest_row.amount_recorded - first_row.amount_recorded
        percent_change = (absolute_change / first_row.amount_recorded) * Decimal("100")
        direction = "increase" if absolute_change > 0 else "decrease"
        changes.append(
            {
                "expense_id": expense.id,
                "service_name": expense.service_name,
                "category_name": expense.category.name,
                "first_amount": str(first_row.amount_recorded),
                "first_date": first_row.date_changed,
                "latest_amount": str(latest_row.amount_recorded),
                "latest_date": latest_row.date_changed,
                # `absolute_change` and `percent_change` are signed —
                # negative when the price went down — so the client can
                # render and color them without re-deriving the sign.
                "absolute_change": str(absolute_change),
                "percent_change": f"{percent_change:.2f}",
                "direction": direction,
            }
        )

    # Sort by magnitude (biggest movers first) regardless of direction.
    changes.sort(key=lambda row: abs(float(row["percent_change"])), reverse=True)

    return Response(
        {
            "window_days": window_days,
            "count": len(changes),
            "results": changes,
        }
    )


class UserRegistrationView(generics.CreateAPIView):
    """
    @notice Sign-up endpoint for the React Native client.
    @dev Mounted at /project/api/auth/register/. Creates an auth User and
         a paired UserProfile atomically (so the new account is immediately
         usable by any user-owned ViewSet) and returns a freshly-issued
         token, mirroring the response shape of the login endpoint so the
         mobile app can treat sign-up as auto-login.

         Permission is AllowAny — registration is by definition called by
         unauthenticated clients. Validation (unique username, password
         minimum length) lives on UserRegistrationSerializer.
    """

    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # registration is anonymous-only

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        @notice Validates the payload, creates User + UserProfile + Token in
                a single transaction, and returns the same shape the login
                endpoint uses.
        @dev Wrapped in transaction.atomic so a failure to create either the
             profile or the token rolls back the new User row — there is no
             "orphan" account scenario where the user exists but the system
             cannot serve their data.
        @return JSON with token, user_id, and username on success (HTTP 201).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Create the paired UserProfile with safe defaults; the mobile app
        # surfaces a profile-edit screen post-registration for the user to
        # set their actual income and currency.
        UserProfile.objects.create(user=user)

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user_id": user.pk,
                "username": user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class FinanceTrackerObtainAuthToken(ObtainAuthToken):
    """
    @notice Token-issuance endpoint for the React Native client.
    @dev Wraps DRF's built-in ObtainAuthToken so we can attach a docstring
         and customize the response shape later without changing the URL.
         POST {"username": "...", "password": "..."} returns
         {"token": "...", "user_id": ..., "username": "..."}.
    """

    def post(self, request, *args, **kwargs):
        """
        @notice Validates credentials and returns or creates an auth token.
        @return JSON with token plus the basic user identifiers the mobile
                client will need to bootstrap its first authenticated call.
        """
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _created = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user_id": user.pk,
                "username": user.username,
            }
        )


def _parse_bool(value):
    """
    @notice Parses a query-string boolean from common spellings.
    @dev Accepts true/false, 1/0, yes/no (case-insensitive). Anything else
         is treated as false. Used by RecurringExpenseViewSet.get_queryset.
    @return Python bool.
    """
    return str(value).strip().lower() in {"true", "1", "yes"}


# ---------------------------------------------------------------------------
# Web (Django-template) views — Phase 3 minimum-viable frontend
#
# Per DESIGN.md §2 and §5.2, the web frontend ships a basic ListView and
# DetailView for each of the five models so the rubric requirement is met
# while the React Native client does the heavy UX lifting. Full web CRUD,
# styling, and dashboard charts are stretch (Phase 7).
# ---------------------------------------------------------------------------


class LandingView(TemplateView):
    """
    @notice Public landing page for the project app.
    @dev Renders project/landing.html for both authenticated and anonymous
         visitors; the template branches on `user.is_authenticated` to
         show either a welcome message or a "log in" prompt.
    """

    template_name = "project/landing.html"


class UserProfileListView(LoginRequiredMixin, ListView):
    """
    @notice Lists the caller's own UserProfile (always one row).
    @dev Filtering by request.user keeps users from listing other accounts'
         profiles. The "list of one" approach satisfies the rubric's
         "ListView for each model" requirement without leaking data.
    """

    model = UserProfile
    template_name = "project/userprofile_list.html"
    context_object_name = "object_list"

    def get_queryset(self):
        """
        @notice Returns a queryset containing only the caller's profile.
        @return UserProfile queryset filtered to the requesting user.
        """
        return UserProfile.objects.filter(user=self.request.user)


class UserProfileDetailView(LoginRequiredMixin, DetailView):
    """
    @notice DetailView for one UserProfile. Restricted to the caller's own.
    @dev Any request for another user's profile pk results in a 404 because
         the queryset filter excludes it.
    """

    model = UserProfile
    template_name = "project/userprofile_detail.html"

    def get_queryset(self):
        """
        @notice Restricts access to the caller's profile only.
        @return UserProfile queryset filtered to the requesting user.
        """
        return UserProfile.objects.filter(user=self.request.user)

    def get_context_data(self, **kwargs):
        """
        @notice Adds the caller's active-expense count for the summary panel.
        @return Template context augmented with `active_expense_count`.
        """
        context = super().get_context_data(**kwargs)
        profile = context["object"]
        context["active_expense_count"] = profile.expenses.filter(is_active=True).count()
        return context


class CategoryListView(LoginRequiredMixin, ListView):
    """
    @notice Lists every Category in the system.
    @dev Categories are global per design D1, so no per-user filtering.
         LoginRequiredMixin still applies so anonymous users go to login
         rather than browsing without context.
    """

    model = Category
    template_name = "project/category_list.html"
    context_object_name = "object_list"


class CategoryDetailView(LoginRequiredMixin, DetailView):
    """
    @notice DetailView for one global Category.
    @dev get_context_data adds a count of how many of the *caller's* active
         expenses use this category, so the page is per-user-relevant even
         though Category itself is global.
    """

    model = Category
    template_name = "project/category_detail.html"

    def get_context_data(self, **kwargs):
        """
        @notice Adds caller-scoped expense count to the context.
        @return Template context with `user_expense_count`.
        """
        context = super().get_context_data(**kwargs)
        category = context["object"]
        try:
            profile = self.request.user.financial_profile
            context["user_expense_count"] = (
                category.expenses.filter(user=profile, is_active=True).count()
            )
        except UserProfile.DoesNotExist:
            context["user_expense_count"] = 0
        return context


class PaymentMethodListView(LoginRequiredMixin, ListView):
    """
    @notice Lists the caller's PaymentMethods.
    @dev get_queryset filters to request.user.financial_profile so users
         can only see their own cards/accounts.
    """

    model = PaymentMethod
    template_name = "project/paymentmethod_list.html"
    context_object_name = "object_list"

    def get_queryset(self):
        """
        @notice Restricts the queryset to the caller's payment methods.
        @return PaymentMethod queryset filtered to the requesting user.
        """
        return PaymentMethod.objects.filter(user=self.request.user.financial_profile)


class PaymentMethodDetailView(LoginRequiredMixin, DetailView):
    """
    @notice DetailView for one PaymentMethod owned by the caller.
    @dev Cross-user access yields a 404 because the queryset filter
         excludes other users' payment methods.
    """

    model = PaymentMethod
    template_name = "project/paymentmethod_detail.html"

    def get_queryset(self):
        """
        @notice Restricts access to the caller's payment methods.
        @return PaymentMethod queryset filtered to the requesting user.
        """
        return PaymentMethod.objects.filter(user=self.request.user.financial_profile)

    def get_context_data(self, **kwargs):
        """
        @notice Adds the active expenses charged on this payment method.
        @return Template context with `linked_expenses` ordered by next due.
        """
        context = super().get_context_data(**kwargs)
        context["linked_expenses"] = context["object"].expenses.filter(is_active=True)
        return context


class RecurringExpenseListView(LoginRequiredMixin, ListView):
    """
    @notice Lists the caller's RecurringExpenses with an optional
            essentials-only filter (a tiny demo of the §9.6 search/filter
            requirement on the web side; the API does the heavy lifting).
    @dev Reads the `essentials` query-string parameter (true/false) and
         filters via category.is_essential when present.
    """

    model = RecurringExpense
    template_name = "project/recurringexpense_list.html"
    context_object_name = "object_list"

    def get_queryset(self):
        """
        @notice Filters expenses to the caller and applies optional
                essentials filter.
        @return RecurringExpense queryset.
        """
        qs = (
            RecurringExpense.objects.filter(user=self.request.user.financial_profile)
            .select_related("category", "payment_method")
        )
        essentials = self.request.GET.get("essentials")
        if essentials is not None:
            qs = qs.filter(category__is_essential=_parse_bool(essentials))
        return qs


class RecurringExpenseDetailView(LoginRequiredMixin, DetailView):
    """
    @notice DetailView for one RecurringExpense owned by the caller,
            including the chronological PriceHistory timeline.
    @dev The `price_history` context entry is ordered chronologically
         (oldest first) so the page reads top-to-bottom as the price
         evolved — opposite of the model's default Meta ordering, which
         is newest-first for list views.
    """

    model = RecurringExpense
    template_name = "project/recurringexpense_detail.html"

    def get_queryset(self):
        """
        @notice Restricts access to the caller's expenses.
        @return RecurringExpense queryset filtered to the requesting user.
        """
        return RecurringExpense.objects.filter(user=self.request.user.financial_profile)

    def get_context_data(self, **kwargs):
        """
        @notice Adds the price-history timeline ordered chronologically.
        @return Template context with `price_history` (oldest first).
        """
        context = super().get_context_data(**kwargs)
        context["price_history"] = context["object"].price_history.order_by(
            "date_changed", "id"
        )
        return context


class PriceHistoryListView(LoginRequiredMixin, ListView):
    """
    @notice Lists every PriceHistory row whose parent expense belongs to
            the caller.
    @dev Cross-expense filter via expense__user. Default ordering comes
         from PriceHistory.Meta (newest first), which matches what the
         user expects when auditing recent changes.
    """

    model = PriceHistory
    template_name = "project/pricehistory_list.html"
    context_object_name = "object_list"

    def get_queryset(self):
        """
        @notice Restricts the queryset to PriceHistory rows on the
                caller's expenses.
        @return PriceHistory queryset filtered via expense__user.
        """
        return PriceHistory.objects.filter(
            expense__user=self.request.user.financial_profile
        ).select_related("expense")


class PriceHistoryDetailView(LoginRequiredMixin, DetailView):
    """
    @notice DetailView for one PriceHistory row owned (via expense) by
            the caller.
    @dev Used as the back-end target of the "view" link in the parent
         expense's timeline table. Edits to change_note flow through the
         API endpoint (PATCH /api/price-history/<pk>/) — web edit forms
         are Phase 7 stretch.
    """

    model = PriceHistory
    template_name = "project/pricehistory_detail.html"

    def get_queryset(self):
        """
        @notice Restricts access to PriceHistory rows on the caller's
                expenses.
        @return PriceHistory queryset filtered via expense__user.
        """
        return PriceHistory.objects.filter(
            expense__user=self.request.user.financial_profile
        ).select_related("expense")
