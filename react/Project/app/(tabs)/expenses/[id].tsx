// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Expense detail — second level of the Expenses Stack.
//              View mode shows the saved fields plus the price-history
//              timeline (the rubric §9.6 cross-model "report" surfaced
//              inline). Edit mode flips the same screen into a form
//              that PATCHes /api/expenses/<id>/; per D4 the backend's
//              save() override appends a new PriceHistory row whenever
//              expense_amount changes, so the timeline grows naturally
//              as the user edits over time. Delete fires an Alert.alert
//              confirm and DELETEs.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch, apiList } from '@/src/api/client';
import {
    BillingCycle,
    Category,
    PaymentMethod,
    PriceHistory,
    RecurringExpense,
    RecurringExpenseUpdate,
} from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { CategoryPicker } from '@/src/components/CategoryPicker';
import { DateField } from '@/src/components/DateField';

const BILLING_CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
    { value: 'ANNUALLY', label: 'Annually' },
];

function isPlausibleDate(input: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
    const [, , day] = input.split('-').map(Number);
    return day >= 1 && day <= 31;
}

/**
 * Extract the hostname (e.g. "billing.example.com") from a URL for compact
 * display on the URL button. Falls back to the raw input if it can't be
 * parsed — avoids importing the URL polyfill for what is otherwise a
 * cosmetic affordance.
 */
function hostnameOf(url: string): string {
    const match = url.match(/^https?:\/\/([^/]+)/i);
    return match ? match[1] : url;
}

export default function ExpenseDetailScreen() {
    const { session } = useAuth();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [expense, setExpense] = useState<RecurringExpense | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    // FK option lists are only fetched when the user enters edit mode,
    // since view mode only needs the denormalized labels off the expense.
    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [optionsReady, setOptionsReady] = useState(false);

    // Edit-mode form state.
    const [editing, setEditing] = useState(false);
    const [draftServiceName, setDraftServiceName] = useState('');
    const [draftAmount, setDraftAmount] = useState('');
    const [draftCycle, setDraftCycle] = useState<BillingCycle>('MONTHLY');
    const [draftDue, setDraftDue] = useState('');
    const [draftCategory, setDraftCategory] = useState<number | null>(null);
    const [draftPayment, setDraftPayment] = useState<number | null>(null);
    const [draftActive, setDraftActive] = useState(true);
    // 4h additions: free-text notes, payment-portal URL, and the
    // optional reason-for-this-price-change captured at edit time.
    const [draftNotes, setDraftNotes] = useState('');
    const [draftPaymentUrl, setDraftPaymentUrl] = useState('');
    const [draftChangeNote, setDraftChangeNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchOne = useCallback(async () => {
        if (!session?.token || !id) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiFetch<RecurringExpense>(`/expenses/${id}/`, {
                token: session.token,
            });
            setExpense(data);
        } catch (error) {
            const message = error instanceof ApiError && error.status === 404
                ? 'This expense no longer exists.'
                : error instanceof ApiError
                    ? `Could not load (HTTP ${error.status}).`
                    : 'Could not reach the server.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token, id]);

    useFocusEffect(
        useCallback(() => {
            fetchOne();
        }, [fetchOne]),
    );

    /** Lazy-load FK options the first time the user taps Edit. */
    useEffect(() => {
        if (!editing || optionsReady || !session?.token) return;
        let cancelled = false;
        (async () => {
            try {
                const [cats, pms] = await Promise.all([
                    apiList<Category>('/categories/', { token: session.token }),
                    apiList<PaymentMethod>('/payment-methods/', { token: session.token }),
                ]);
                if (cancelled) return;
                setCategories(cats);
                setPaymentMethods(pms);
                setOptionsReady(true);
            } catch {
                if (cancelled) return;
                setErrorMessage('Could not load categories / payment methods for editing.');
                setEditing(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [editing, optionsReady, session?.token]);

    function startEdit() {
        if (!expense) return;
        setDraftServiceName(expense.service_name);
        setDraftAmount(expense.expense_amount);
        setDraftCycle(expense.billing_cycle);
        setDraftDue(expense.next_due_date);
        setDraftCategory(expense.category);
        setDraftPayment(expense.payment_method);
        setDraftActive(expense.is_active);
        setDraftNotes(expense.notes ?? '');
        setDraftPaymentUrl(expense.payment_url ?? '');
        setDraftChangeNote('');
        setErrorMessage('');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setErrorMessage('');
    }

    async function saveEdit() {
        if (!session?.token || !expense) return;
        if (!draftServiceName.trim()) {
            setErrorMessage('Service name is required.');
            return;
        }
        const parsed = parseFloat(draftAmount);
        if (Number.isNaN(parsed) || parsed < 0) {
            setErrorMessage('Amount must be a non-negative number.');
            return;
        }
        if (!isPlausibleDate(draftDue)) {
            setErrorMessage('Next due date must be in YYYY-MM-DD format.');
            return;
        }
        if (draftCategory === null) {
            setErrorMessage('Please choose a category.');
            return;
        }
        const trimmedUrl = draftPaymentUrl.trim();
        if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
            setErrorMessage('Payment URL must start with http:// or https://');
            return;
        }
        setSaving(true);
        setErrorMessage('');
        try {
            const update: RecurringExpenseUpdate = {
                service_name: draftServiceName.trim(),
                expense_amount: draftAmount.trim(),
                billing_cycle: draftCycle,
                next_due_date: draftDue.trim(),
                category: draftCategory,
                payment_method: draftPayment,
                is_active: draftActive,
                notes: draftNotes.trim(),
                payment_url: trimmedUrl,
            };
            // Only forward the price-change note when the amount actually
            // changed. Sending it on a non-amount edit would just be
            // discarded server-side, but skipping it here saves a
            // round-trip body byte and keeps intent obvious.
            if (draftAmount.trim() !== expense.expense_amount) {
                update.pending_change_note = draftChangeNote.trim();
            }
            const data = await apiFetch<RecurringExpense>(`/expenses/${expense.id}/`, {
                method: 'PATCH',
                token: session.token,
                body: update,
            });
            setExpense(data);
            setEditing(false);
        } catch (error) {
            if (error instanceof ApiError && error.status === 400 && error.body) {
                const first = Object.values(error.body as Record<string, string[]>)[0];
                setErrorMessage(Array.isArray(first) ? first[0] : 'Could not save.');
            } else {
                setErrorMessage('Could not save. Try again in a moment.');
            }
        } finally {
            setSaving(false);
        }
    }

    function confirmDelete() {
        if (!expense) return;
        Alert.alert(
            'Delete expense?',
            `"${expense.service_name}" and its full price history will be removed.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: doDelete },
            ],
        );
    }

    async function doDelete() {
        if (!session?.token || !expense) return;
        setDeleting(true);
        try {
            await apiFetch(`/expenses/${expense.id}/`, {
                method: 'DELETE',
                token: session.token,
            });
            router.back();
        } catch (error) {
            const message = error instanceof ApiError
                ? `Delete failed (HTTP ${error.status}).`
                : 'Delete failed. Try again in a moment.';
            setErrorMessage(message);
            setDeleting(false);
        }
    }

    if (loading && !expense) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!expense) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{errorMessage || 'Not found.'}</Text>
                <Pressable style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    const sortedHistory: PriceHistory[] = [...expense.price_history].sort(
        (a, b) => {
            // Chronological ascending so the page reads top-to-bottom as price evolved.
            const cmp = a.date_changed.localeCompare(b.date_changed);
            return cmp !== 0 ? cmp : a.id - b.id;
        },
    );

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Stack.Screen options={{ title: expense.service_name }} />

            <View style={styles.card} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                <Text style={styles.label}>Service name</Text>
                {editing ? (
                    <TextInput
                        style={styles.input}
                        value={draftServiceName}
                        onChangeText={setDraftServiceName}
                        autoCapitalize="words"
                    />
                ) : (
                    <Text style={styles.value}>{expense.service_name}</Text>
                )}

                <Text style={styles.label}>Amount</Text>
                {editing ? (
                    <>
                        <TextInput
                            style={styles.input}
                            value={draftAmount}
                            onChangeText={setDraftAmount}
                            keyboardType="decimal-pad"
                        />
                        {/* When the amount has actually changed, prompt for an */}
                        {/* optional reason. Forwarded to the auto-created       */}
                        {/* PriceHistory row via `pending_change_note` (D8 at    */}
                        {/* edit time, chunk 4h).                                */}
                        {draftAmount.trim() !== expense.expense_amount && (
                            <>
                                <Text style={styles.subLabel}>
                                    Reason for the change (optional)
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={draftChangeNote}
                                    onChangeText={setDraftChangeNote}
                                    placeholder="e.g. annual plan price hike, downgraded plan"
                                    placeholderTextColor="#9c9ca0"
                                />
                                <Text style={styles.hint}>
                                    Saved with this price change so future you knows why.
                                    You can still edit the note later from the price-history
                                    detail screen.
                                </Text>
                            </>
                        )}
                    </>
                ) : (
                    <Text style={styles.value}>{expense.expense_amount}</Text>
                )}

                <Text style={styles.label}>Billing cycle</Text>
                {editing ? (
                    <View style={styles.chipRow}>
                        {BILLING_CYCLE_OPTIONS.map((opt) => {
                            const selected = draftCycle === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => setDraftCycle(opt.value)}
                                    style={[styles.chip, selected && styles.chipSelected]}
                                >
                                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.value}>{expense.billing_cycle_label}</Text>
                )}

                <Text style={styles.label}>Next due date</Text>
                {editing ? (
                    <DateField value={draftDue} onChange={setDraftDue} />
                ) : (
                    <Text style={styles.value}>{expense.next_due_date}</Text>
                )}

                <Text style={styles.label}>Category</Text>
                {editing ? (
                    <CategoryPicker
                        categories={categories}
                        selectedId={draftCategory}
                        onSelect={setDraftCategory}
                    />
                ) : (
                    <Text style={styles.value}>{expense.category_name}</Text>
                )}

                <Text style={styles.label}>Payment method</Text>
                {editing ? (
                    <View style={styles.chipRow}>
                        <Pressable
                            onPress={() => setDraftPayment(null)}
                            style={[styles.chip, draftPayment === null && styles.chipSelected]}
                        >
                            <Text style={draftPayment === null ? styles.chipTextSelected : styles.chipText}>
                                None
                            </Text>
                        </Pressable>
                        {paymentMethods.map((pm) => {
                            const selected = draftPayment === pm.id;
                            return (
                                <Pressable
                                    key={pm.id}
                                    onPress={() => setDraftPayment(pm.id)}
                                    style={[styles.chip, selected && styles.chipSelected]}
                                >
                                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                        {pm.nickname}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.value}>
                        {paymentMethods.find((pm) => pm.id === expense.payment_method)?.nickname
                            ?? (expense.payment_method === null ? '— (unassigned)' : `#${expense.payment_method}`)}
                    </Text>
                )}

                <View style={styles.activeRow}>
                    <Text style={styles.label}>Active</Text>
                    {editing ? (
                        <Switch value={draftActive} onValueChange={setDraftActive} />
                    ) : (
                        <Text style={styles.value}>{expense.is_active ? 'Yes' : 'No'}</Text>
                    )}
                </View>

                <Text style={styles.label}>Notes</Text>
                {editing ? (
                    <TextInput
                        style={styles.textarea}
                        value={draftNotes}
                        onChangeText={setDraftNotes}
                        multiline
                        placeholder="Anything that helps you tell this expense apart from similar ones."
                        placeholderTextColor="#9c9ca0"
                    />
                ) : (
                    <Text style={[styles.value, !expense.notes && styles.valueMuted]}>
                        {expense.notes || '—'}
                    </Text>
                )}

                <Text style={styles.label}>Payment URL</Text>
                {editing ? (
                    <TextInput
                        style={styles.input}
                        value={draftPaymentUrl}
                        onChangeText={setDraftPaymentUrl}
                        placeholder="https://billing.example.com/account"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                ) : expense.payment_url ? (
                    <Pressable
                        onPress={() => Linking.openURL(expense.payment_url)}
                        style={({ pressed }) => [styles.urlButton, pressed && styles.urlButtonPressed]}
                    >
                        <FontAwesome
                            name="external-link"
                            size={14}
                            color="#2b6cb0"
                            style={styles.urlButtonIcon}
                        />
                        <Text style={styles.urlButtonText} numberOfLines={1}>
                            {hostnameOf(expense.payment_url)}
                        </Text>
                    </Pressable>
                ) : (
                    <Text style={[styles.value, styles.valueMuted]}>—</Text>
                )}
            </View>

            {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}

            {editing ? (
                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.buttonSecondary, saving && styles.buttonDisabled]}
                        onPress={cancelEdit}
                        disabled={saving}
                    >
                        <Text style={styles.buttonSecondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.button, saving && styles.buttonDisabled]}
                        onPress={saveEdit}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
                    </Pressable>
                </View>
            ) : (
                <Pressable style={styles.button} onPress={startEdit}>
                    <Text style={styles.buttonText}>Edit</Text>
                </Pressable>
            )}

            {/* Price-history timeline. Read-only here; tap a row to edit its note. */}
            <Text style={styles.sectionHeading}>Price history</Text>
            {sortedHistory.length === 0 ? (
                <Text style={styles.empty}>No price history yet.</Text>
            ) : (
                <View
                    style={styles.timelineCard}
                    lightColor="#fff"
                    darkColor="rgba(255,255,255,0.05)"
                >
                    {sortedHistory.map((row, idx) => (
                        <Pressable
                            key={row.id}
                            onPress={() => router.push(`/expenses/price-history/${row.id}` as never)}
                            style={({ pressed }) => [
                                styles.timelineRow,
                                idx > 0 && styles.timelineRowBorder,
                                pressed && styles.rowPressed,
                            ]}
                        >
                            <View style={styles.timelineLeft}>
                                <Text style={styles.timelineDate}>{row.date_changed}</Text>
                                <Text style={styles.timelineNote}>
                                    {row.change_note || '—'}
                                </Text>
                            </View>
                            <Text style={styles.timelineAmount}>{row.amount_recorded}</Text>
                        </Pressable>
                    ))}
                </View>
            )}

            <View style={styles.divider} lightColor="#e3e3e7" darkColor="rgba(255,255,255,0.1)" />

            <Pressable
                style={[styles.deleteButton, (deleting || editing) && styles.buttonDisabled]}
                onPress={confirmDelete}
                disabled={deleting || editing}
            >
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete</Text>}
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        paddingBottom: 48,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        color: '#6c6c70',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 12,
    },
    subLabel: {
        fontSize: 12,
        color: '#6c6c70',
        marginTop: 10,
        marginBottom: 4,
    },
    hint: {
        fontSize: 12,
        color: '#6c6c70',
        marginTop: 4,
        lineHeight: 16,
    },
    value: {
        fontSize: 18,
        marginTop: 4,
    },
    valueMuted: {
        color: '#6c6c70',
        fontStyle: 'italic',
    },
    textarea: {
        backgroundColor: '#f7f7f9',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
        marginTop: 4,
    },
    urlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#edf2f7',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    urlButtonPressed: {
        opacity: 0.7,
    },
    urlButtonIcon: {
        marginRight: 8,
    },
    urlButtonText: {
        color: '#2b6cb0',
        fontSize: 15,
        fontWeight: '600',
        flexShrink: 1,
    },
    input: {
        backgroundColor: '#f7f7f9',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        fontSize: 18,
        marginTop: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    chip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e3e3e7',
        backgroundColor: '#f7f7f9',
    },
    chipSelected: {
        backgroundColor: '#2b6cb0',
        borderColor: '#2b6cb0',
    },
    chipText: {
        color: '#1c1c1e',
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    activeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    button: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
        flex: 1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonSecondary: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
        flex: 1,
        borderColor: '#e3e3e7',
        borderWidth: 1,
    },
    buttonSecondaryText: {
        color: '#1c1c1e',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 8,
    },
    empty: {
        color: '#6c6c70',
        fontStyle: 'italic',
    },
    timelineCard: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    timelineRowBorder: {
        borderTopWidth: 1,
        borderTopColor: '#e3e3e7',
    },
    timelineLeft: {
        flex: 1,
    },
    timelineDate: {
        fontSize: 14,
        fontWeight: '600',
    },
    timelineNote: {
        color: '#6c6c70',
        fontSize: 13,
        marginTop: 2,
    },
    timelineAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
    rowPressed: {
        opacity: 0.6,
    },
    divider: {
        height: 1,
        marginVertical: 24,
    },
    deleteButton: {
        backgroundColor: '#b94a48',
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    error: {
        color: '#b94a48',
        textAlign: 'center',
        marginVertical: 12,
    },
});
