// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: TypeScript interfaces mirroring the DRF serializer shapes
//              defined in django/project/serializers.py. Centralizing them
//              here lets every screen consume `apiFetch<UserProfile>(...)`
//              with full type information and keeps drift between the
//              backend serializers and the mobile client visible: when a
//              field is added or removed in serializers.py, the missing
//              property here is the first thing TypeScript flags.

/** GET /api/profile/ — UserProfileSerializer. */
export interface UserProfile {
    id: number;
    /** Read-only; mirrors the linked auth User's username. */
    username: string;
    /** Stored as a Decimal on the backend; serialized as a string. */
    monthly_income: string;
    /** ISO currency code, e.g. "USD" / "GBP" / "JPY". */
    currency_preference: string;
}

/** Subset accepted by PATCH /api/profile/ — username is read-only. */
export type UserProfileUpdate = Partial<Pick<UserProfile, 'monthly_income' | 'currency_preference'>>;

/** GET /api/categories/ — CategorySerializer (read-only globally per D1). */
export interface Category {
    id: number;
    name: string;
    description: string;
    is_essential: boolean;
    /** Decimal serialized as string, or null when no goal is set. */
    budget_goal: string | null;
}

/** Mirrors PaymentMethod.METHOD_TYPE_CHOICES on the backend. */
export type PaymentMethodType = 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKING';

/** GET/POST/PATCH/DELETE /api/payment-methods/ — PaymentMethodSerializer. */
export interface PaymentMethod {
    id: number;
    /** Read-only owner FK; assigned server-side from the request. */
    user: number;
    nickname: string;
    method_type: PaymentMethodType;
    /** Read-only display label, e.g. "Credit Card", from get_method_type_display. */
    method_type_label: string;
    /** ISO date YYYY-MM-DD, or null when not set. */
    expiry_date: string | null;
}

/** Body shape POSTed to /api/payment-methods/ (user is server-stamped). */
export interface PaymentMethodCreate {
    nickname: string;
    method_type: PaymentMethodType;
    expiry_date?: string | null;
}

/** Body shape PATCHed to /api/payment-methods/<id>/. */
export type PaymentMethodUpdate = Partial<PaymentMethodCreate>;

/** Mirrors RecurringExpense.BILLING_CYCLE_CHOICES on the backend. */
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

/**
 * GET /api/price-history/<id>/ — PriceHistorySerializer.
 *
 * Per design D8, only `change_note` is editable from clients;
 * `amount_recorded` and `date_changed` are read-only at the serializer
 * layer (PATCH attempts to set them are silently dropped, not rejected).
 */
export interface PriceHistory {
    id: number;
    expense: number;
    amount_recorded: string;
    date_changed: string;
    change_note: string;
}

/** Body shape PATCHed to /api/price-history/<id>/. */
export interface PriceHistoryUpdate {
    change_note: string;
}

/** GET /api/expenses/ — RecurringExpenseSerializer (full read shape). */
export interface RecurringExpense {
    id: number;
    user: number;
    category: number;
    /** Read-only convenience field; mirrors category.name. */
    category_name: string;
    /** FK; null when no payment method is assigned (per D3). */
    payment_method: number | null;
    service_name: string;
    expense_amount: string;
    billing_cycle: BillingCycle;
    /** Read-only display label, e.g. "Monthly". */
    billing_cycle_label: string;
    next_due_date: string;
    is_active: boolean;
    /** Free-text user notes (chunk 4h). */
    notes: string;
    /** Optional URL to the expense's payment portal (chunk 4h); empty when unset. */
    payment_url: string;
    /**
     * Nested timeline rows, ordered newest-first by the serializer's
     * default Meta. The detail screen re-sorts chronologically.
     */
    price_history: PriceHistory[];
}

/** Body shape POSTed to /api/expenses/ (user is server-stamped). */
export interface RecurringExpenseCreate {
    category: number;
    payment_method?: number | null;
    service_name: string;
    expense_amount: string;
    billing_cycle: BillingCycle;
    next_due_date: string;
    is_active?: boolean;
    notes?: string;
    payment_url?: string;
}

/**
 * Body shape PATCHed to /api/expenses/<id>/.
 *
 * Adds the optional `pending_change_note` field (chunk 4h): when present
 * on a PATCH that changes `expense_amount`, the backend forwards it to
 * the auto-created PriceHistory row. Discarded silently on PATCHes that
 * don't change the amount.
 */
export type RecurringExpenseUpdate = Partial<RecurringExpenseCreate> & {
    pending_change_note?: string;
};

/** Direction of a price change row. */
export type PriceChangeDirection = 'increase' | 'decrease';

/**
 * One row of the cross-model derived report at
 * /api/reports/price-changes/. All amounts are DRF-serialized strings to
 * preserve decimal precision; the screen `parseFloat`s them only for
 * display purposes (sort and percent rendering). `absolute_change` and
 * `percent_change` are signed — negative when the price went down.
 */
export interface PriceChangeRow {
    expense_id: number;
    service_name: string;
    category_name: string;
    first_amount: string;
    first_date: string;
    latest_amount: string;
    latest_date: string;
    absolute_change: string;
    percent_change: string;
    direction: PriceChangeDirection;
}

/** Top-level shape of /api/reports/price-changes/?window_days=<n>. */
export interface PriceChangeReport {
    window_days: number;
    count: number;
    results: PriceChangeRow[];
}
