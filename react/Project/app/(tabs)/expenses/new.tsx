// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Create-Expense form. The most form-heavy screen in the
//              app: free-text fields (service name, expense amount,
//              next-due date), enum chip-pickers (billing cycle), and
//              FK chip-pickers populated by parallel GETs of the
//              Categories and PaymentMethods endpoints. Saves via POST
//              /api/expenses/; the backend's RecurringExpense.save()
//              override creates the initial PriceHistory row
//              automatically (D4/D8). On success returns to the list.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
    RecurringExpense,
    RecurringExpenseCreate,
} from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { CategoryPicker } from '@/src/components/CategoryPicker';
import { DateField } from '@/src/components/DateField';

const BILLING_CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
    { value: 'ANNUALLY', label: 'Annually' },
];

/** Reusable YYYY-MM-DD shape check; backend DateField does final validation. */
function isPlausibleDate(input: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
    const [, , day] = input.split('-').map(Number);
    return day >= 1 && day <= 31;
}

/** Today as YYYY-MM-DD; used to seed the date field. */
function todayISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export default function NewExpenseScreen() {
    const { session } = useAuth();

    // FK option lists fetched in parallel on mount.
    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [optionsError, setOptionsError] = useState('');

    // Form fields.
    const [serviceName, setServiceName] = useState('');
    const [amount, setAmount] = useState('');
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
    const [nextDue, setNextDue] = useState(todayISO());
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(true);
    // Free-text notes + payment-portal URL (chunk 4h). Both optional.
    const [notes, setNotes] = useState('');
    const [paymentUrl, setPaymentUrl] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!session?.token) return;
        let cancelled = false;
        (async () => {
            setOptionsLoading(true);
            setOptionsError('');
            try {
                const [cats, pms] = await Promise.all([
                    apiList<Category>('/categories/', { token: session.token }),
                    apiList<PaymentMethod>('/payment-methods/', { token: session.token }),
                ]);
                if (cancelled) return;
                setCategories(cats);
                setPaymentMethods(pms);
                // Seed the category to the first option so submit works without
                // forcing the user to scroll the picker if they don't care.
                if (cats.length && categoryId === null) setCategoryId(cats[0].id);
            } catch (error) {
                if (cancelled) return;
                setOptionsError(
                    error instanceof ApiError
                        ? `Could not load form options (HTTP ${error.status}).`
                        : 'Could not load form options.',
                );
            } finally {
                if (!cancelled) setOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.token]);

    async function handleSubmit() {
        if (!session?.token) return;
        if (!serviceName.trim()) {
            setErrorMessage('Service name is required.');
            return;
        }
        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
            setErrorMessage('Amount must be a non-negative number.');
            return;
        }
        if (!isPlausibleDate(nextDue)) {
            setErrorMessage('Next due date must be in YYYY-MM-DD format.');
            return;
        }
        if (categoryId === null) {
            setErrorMessage('Please choose a category.');
            return;
        }
        const trimmedUrl = paymentUrl.trim();
        if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
            setErrorMessage('Payment URL must start with http:// or https://');
            return;
        }

        setErrorMessage('');
        setSubmitting(true);
        try {
            const body: RecurringExpenseCreate = {
                category: categoryId,
                payment_method: paymentMethodId,
                service_name: serviceName.trim(),
                expense_amount: amount.trim(),
                billing_cycle: billingCycle,
                next_due_date: nextDue.trim(),
                is_active: isActive,
                notes: notes.trim(),
                payment_url: trimmedUrl,
            };
            await apiFetch<RecurringExpense>('/expenses/', {
                method: 'POST',
                token: session.token,
                body,
            });
            router.back();
        } catch (error) {
            if (error instanceof ApiError && error.status === 400 && error.body) {
                const first = Object.values(error.body as Record<string, string[]>)[0];
                setErrorMessage(Array.isArray(first) ? first[0] : 'Could not save.');
            } else {
                setErrorMessage('Could not save. Try again in a moment.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    if (optionsLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (optionsError) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{optionsError}</Text>
                <Pressable style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Service name</Text>
            <TextInput
                style={styles.input}
                value={serviceName}
                onChangeText={setServiceName}
                placeholder="e.g. Netflix"
                autoCapitalize="words"
            />

            <Text style={styles.label}>Amount</Text>
            <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
            />

            <Text style={styles.label}>Billing cycle</Text>
            <View style={styles.chipRow}>
                {BILLING_CYCLE_OPTIONS.map((opt) => {
                    const selected = billingCycle === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            onPress={() => setBillingCycle(opt.value)}
                            style={[styles.chip, selected && styles.chipSelected]}
                        >
                            <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                {opt.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={styles.label}>Next due date</Text>
            <DateField value={nextDue} onChange={setNextDue} />

            <Text style={styles.label}>Category</Text>
            <CategoryPicker
                categories={categories}
                selectedId={categoryId}
                onSelect={setCategoryId}
            />

            <Text style={styles.label}>Payment method (optional)</Text>
            <View style={styles.chipRow}>
                <Pressable
                    onPress={() => setPaymentMethodId(null)}
                    style={[styles.chip, paymentMethodId === null && styles.chipSelected]}
                >
                    <Text style={paymentMethodId === null ? styles.chipTextSelected : styles.chipText}>
                        None
                    </Text>
                </Pressable>
                {paymentMethods.map((pm) => {
                    const selected = paymentMethodId === pm.id;
                    return (
                        <Pressable
                            key={pm.id}
                            onPress={() => setPaymentMethodId(pm.id)}
                            style={[styles.chip, selected && styles.chipSelected]}
                        >
                            <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                {pm.nickname}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.activeRow}>
                <Text style={styles.label}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} />
            </View>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
                style={styles.textarea}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Anything that helps you tell this expense apart from similar ones (e.g. which apartment, which loan, who you pay)."
                placeholderTextColor="#9c9ca0"
            />

            <Text style={styles.label}>Payment URL (optional)</Text>
            <TextInput
                style={styles.input}
                value={paymentUrl}
                onChangeText={setPaymentUrl}
                placeholder="https://billing.example.com/account"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
            />
            <Text style={styles.hint}>
                If set, the expense detail will show a tappable link straight to your
                payment portal.
            </Text>

            {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}

            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.buttonSecondary, submitting && styles.buttonDisabled]}
                    onPress={() => router.back()}
                    disabled={submitting}
                >
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, submitting && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
                </Pressable>
            </View>
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
    label: {
        fontSize: 12,
        color: '#6c6c70',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 16,
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16,
    },
    textarea: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16,
        minHeight: 90,
        textAlignVertical: 'top',
    },
    hint: {
        color: '#6c6c70',
        fontSize: 12,
        marginTop: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e3e3e7',
        backgroundColor: '#fff',
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
    error: {
        color: '#b94a48',
        marginTop: 16,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
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
    buttonDisabled: {
        opacity: 0.5,
    },
});
