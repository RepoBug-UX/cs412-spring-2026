// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Expenses list — top of the Stack within the Expenses tab.
//              Demonstrates the §9.6 search/filter requirement on mobile:
//              three chip-row filters (status, billing cycle, essentials)
//              that map directly to the API query params handled by
//              RecurringExpenseViewSet.get_queryset on the backend. The
//              list re-fetches whenever a filter changes or when the tab
//              is re-focused; rows tap into the detail screen.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiList } from '@/src/api/client';
import { BillingCycle, RecurringExpense } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/** Tri-state filter for an enum-like dimension. `'ANY'` means no filter. */
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type CycleFilter = 'ANY' | BillingCycle;
type EssentialsFilter = 'ANY' | 'YES' | 'NO';

export default function ExpensesListScreen() {
    const { session } = useAuth();
    const [items, setItems] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
    const [cycleFilter, setCycleFilter] = useState<CycleFilter>('ANY');
    const [essentialsFilter, setEssentialsFilter] = useState<EssentialsFilter>('ANY');

    const fetchList = useCallback(async () => {
        if (!session?.token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const query: Record<string, string> = {};
            if (statusFilter === 'ACTIVE') query.is_active = 'true';
            if (statusFilter === 'INACTIVE') query.is_active = 'false';
            if (cycleFilter !== 'ANY') query.billing_cycle = cycleFilter;
            if (essentialsFilter === 'YES') query.is_essential = 'true';
            if (essentialsFilter === 'NO') query.is_essential = 'false';

            const data = await apiList<RecurringExpense>('/expenses/', {
                token: session.token,
                query,
            });
            setItems(data);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not load expenses (HTTP ${error.status}).`
                : 'Could not reach the server. Check that the backend is running.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token, statusFilter, cycleFilter, essentialsFilter]);

    useFocusEffect(
        useCallback(() => {
            fetchList();
        }, [fetchList]),
    );

    /** Render a horizontal chip row for one filter dimension. */
    function FilterRow<T extends string>({
        label,
        value,
        onChange,
        options,
    }: {
        label: string;
        value: T;
        onChange: (next: T) => void;
        options: { value: T; label: string }[];
    }) {
        return (
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>{label}</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                >
                    {options.map((opt) => {
                        const selected = value === opt.value;
                        return (
                            <Pressable
                                key={opt.value}
                                onPress={() => onChange(opt.value)}
                                style={[styles.chip, selected && styles.chipSelected]}
                            >
                                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                    {opt.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <Pressable onPress={() => router.push('/expenses/new' as never)} hitSlop={12}>
                            <Text style={styles.headerAction}>+ Add</Text>
                        </Pressable>
                    ),
                }}
            />

            <View style={styles.filtersWrap} lightColor="#fff" darkColor="rgba(255,255,255,0.04)">
                <FilterRow<StatusFilter>
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' },
                        { value: 'ALL', label: 'All' },
                    ]}
                />
                <FilterRow<CycleFilter>
                    label="Cycle"
                    value={cycleFilter}
                    onChange={setCycleFilter}
                    options={[
                        { value: 'ANY', label: 'Any' },
                        { value: 'MONTHLY', label: 'Monthly' },
                        { value: 'QUARTERLY', label: 'Quarterly' },
                        { value: 'ANNUALLY', label: 'Annually' },
                    ]}
                />
                <FilterRow<EssentialsFilter>
                    label="Importance"
                    value={essentialsFilter}
                    onChange={setEssentialsFilter}
                    options={[
                        { value: 'ANY', label: 'Any' },
                        { value: 'YES', label: 'Essentials' },
                        { value: 'NO', label: 'Non-essentials' },
                    ]}
                />
            </View>

            {loading && items.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                </View>
            ) : errorMessage && items.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.error}>{errorMessage}</Text>
                    <Pressable style={styles.retryButton} onPress={fetchList}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </Pressable>
                </View>
            ) : items.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.empty}>
                        No expenses match the current filters.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContainer}>
                    {items.map((expense) => (
                        <Pressable
                            key={expense.id}
                            onPress={() => router.push(`/expenses/${expense.id}` as never)}
                            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        >
                            <View
                                style={styles.rowInner}
                                lightColor="#fff"
                                darkColor="rgba(255,255,255,0.05)"
                            >
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>{expense.service_name}</Text>
                                    <Text style={styles.rowSubtitle}>
                                        {expense.category_name} · {expense.billing_cycle_label.toLowerCase()}
                                    </Text>
                                    <Text style={styles.rowMeta}>
                                        Next due {expense.next_due_date}
                                        {expense.is_active ? '' : ' · paused'}
                                    </Text>
                                </View>
                                <View style={styles.rowAmountWrap}>
                                    <Text style={styles.rowAmount}>{expense.expense_amount}</Text>
                                    <FontAwesome name="chevron-right" size={12} color="#c0c0c5" />
                                </View>
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    filtersWrap: {
        paddingTop: 12,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#e3e3e7',
    },
    filterRow: {
        marginBottom: 8,
    },
    filterLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#6c6c70',
        marginLeft: 16,
        marginBottom: 4,
    },
    chipScroll: {
        paddingHorizontal: 16,
        gap: 6,
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
    listContainer: {
        padding: 16,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    headerAction: {
        color: '#2b6cb0',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 12,
    },
    row: {
        marginBottom: 8,
    },
    rowPressed: {
        opacity: 0.7,
    },
    rowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 8,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    rowSubtitle: {
        color: '#6c6c70',
        fontSize: 13,
        marginTop: 2,
    },
    rowMeta: {
        color: '#6c6c70',
        fontSize: 12,
        marginTop: 2,
    },
    rowAmountWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rowAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
    empty: {
        color: '#6c6c70',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    error: {
        color: '#b94a48',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 6,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
