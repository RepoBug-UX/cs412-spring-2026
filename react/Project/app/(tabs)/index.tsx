// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Home tab — Dashboard. Replaces the Phase 4a placeholder
//              welcome screen with the project's marquee read-only view:
//              a monthly-outflow summary, a per-category pie chart, the
//              same per-category breakdown as a sorted list, and a
//              "next 30 days" upcoming-bills section. All values are
//              normalized into monthly units so quarterly and annual
//              expenses contribute their fair share. Refreshes on every
//              tab focus, so editing an expense in another tab updates
//              the dashboard the moment you come back.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch, apiList } from '@/src/api/client';
import { BillingCycle, RecurringExpense, UserProfile } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * Visually-distinct palette used to colour pie slices and per-category
 * list rows. Long enough to cover the seeded-category set (10) without
 * recycling colors, and ordered for contrast between adjacent slots.
 */
const CATEGORY_COLORS = [
    '#2b6cb0', // blue
    '#dd6b20', // orange
    '#38a169', // green
    '#d53f8c', // pink
    '#805ad5', // purple
    '#319795', // teal
    '#d69e2e', // yellow
    '#e53e3e', // red
    '#718096', // gray
    '#ad5389', // magenta
];

/** Convert one expense's billing amount into its equivalent monthly cost. */
function normalizeToMonthly(amount: number, cycle: BillingCycle): number {
    switch (cycle) {
        case 'MONTHLY':
            return amount;
        case 'QUARTERLY':
            return amount / 3;
        case 'ANNUALLY':
            return amount / 12;
    }
}

interface CategoryAgg {
    name: string;
    monthly: number;
    color: string;
}

interface UpcomingBill {
    id: number;
    service_name: string;
    next_due_date: string;
    expense_amount: string;
    daysAway: number;
}

/** Today as YYYY-MM-DD; used for the upcoming-bills window. */
function todayISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Days between two YYYY-MM-DD strings; result is positive when `to` is later. */
function daysBetween(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Cycle filter for the dashboard: "ALL" normalizes to monthly; any
 *  specific cycle shows only those expenses at their actual amount. */
type CycleFilter = 'ALL' | BillingCycle;

export default function DashboardTab() {
    const { session } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    // Default to "Monthly" because most people frame their finances
    // monthly; the hero card label aligns with the chart that way.
    const [cycleFilter, setCycleFilter] = useState<CycleFilter>('MONTHLY');

    const fetchAll = useCallback(async () => {
        if (!session?.token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            // Profile + active expenses in parallel; "active only" because
            // paused / inactive subscriptions don't contribute to the
            // user's current monthly outflow.
            const [profileData, expenseData] = await Promise.all([
                apiFetch<UserProfile>('/profile/', { token: session.token }),
                apiList<RecurringExpense>('/expenses/', {
                    token: session.token,
                    query: { is_active: 'true' },
                }),
            ]);
            setProfile(profileData);
            setExpenses(expenseData);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not load dashboard (HTTP ${error.status}).`
                : 'Could not reach the server. Check that the backend is running.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token]);

    useFocusEffect(
        useCallback(() => {
            fetchAll();
        }, [fetchAll]),
    );

    if (loading && expenses.length === 0 && !profile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (errorMessage && expenses.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{errorMessage}</Text>
                <Pressable style={styles.button} onPress={fetchAll}>
                    <Text style={styles.buttonText}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    // Apply the cycle filter. For "ALL" we keep every active expense and
    // normalize to monthly so amounts add up to a meaningful total. For a
    // specific cycle we filter to that cycle and sum the raw amounts —
    // most users don't think about a quarterly $500 bill in monthly terms,
    // they think about it as $500 quarterly.
    const filteredExpenses = cycleFilter === 'ALL'
        ? expenses
        : expenses.filter((exp) => exp.billing_cycle === cycleFilter);
    const shouldNormalize = cycleFilter === 'ALL';

    const aggMap = new Map<string, number>();
    for (const exp of filteredExpenses) {
        const raw = parseFloat(exp.expense_amount);
        const contribution = shouldNormalize
            ? normalizeToMonthly(raw, exp.billing_cycle)
            : raw;
        aggMap.set(exp.category_name, (aggMap.get(exp.category_name) ?? 0) + contribution);
    }
    const categoryAggs: CategoryAgg[] = [...aggMap.entries()]
        .map(([name, monthly], idx) => ({
            name,
            monthly,
            color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        }))
        .sort((a, b) => b.monthly - a.monthly);

    const totalMonthly = categoryAggs.reduce((sum, c) => sum + c.monthly, 0);
    const currency = profile?.currency_preference ?? 'USD';

    /** Human-readable hero label for the current filter. */
    const heroLabel = cycleFilter === 'ALL'
        ? 'Monthly outflow*'
        : cycleFilter === 'MONTHLY'
            ? 'Monthly outflow'
            : cycleFilter === 'QUARTERLY'
                ? 'Quarterly outflow'
                : 'Annual outflow';

    // Upcoming bills: due within next 30 days, sorted by date.
    const today = todayISO();
    const upcoming: UpcomingBill[] = expenses
        .map((exp) => ({
            id: exp.id,
            service_name: exp.service_name,
            next_due_date: exp.next_due_date,
            expense_amount: exp.expense_amount,
            daysAway: daysBetween(today, exp.next_due_date),
        }))
        .filter((b) => b.daysAway >= 0 && b.daysAway <= 30)
        .sort((a, b) => a.daysAway - b.daysAway);

    const chartWidth = Dimensions.get('window').width - 32;
    // Round to 2 decimals for both the pie-chart legend and downstream
    // display — keeps everything consistent with the per-category list and
    // matches how currency is normally written. Repeating-decimal artifacts
    // (e.g. 166.6666… from a quarterly $500 normalized to monthly) never
    // reach the UI.
    const pieData = categoryAggs.map((c) => ({
        name: c.name,
        amount: Math.round(c.monthly * 100) / 100,
        color: c.color,
        legendFontColor: '#1c1c1e',
        legendFontSize: 12,
    }));

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Cycle filter — chip row above the hero card so the user
                always sees what filter the headline number represents. */}
            <View style={styles.filterRow}>
                {(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ALL'] as CycleFilter[]).map((opt) => {
                    const selected = cycleFilter === opt;
                    const label = opt === 'ALL'
                        ? 'All'
                        : opt === 'MONTHLY'
                            ? 'Monthly'
                            : opt === 'QUARTERLY'
                                ? 'Quarterly'
                                : 'Annually';
                    return (
                        <Pressable
                            key={opt}
                            onPress={() => setCycleFilter(opt)}
                            style={[styles.filterChip, selected && styles.filterChipSelected]}
                        >
                            <Text style={selected ? styles.filterChipTextSelected : styles.filterChipText}>
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Header card: total outflow at the chosen cycle. */}
            <View
                style={styles.heroCard}
                lightColor="#fff"
                darkColor="rgba(255,255,255,0.05)"
            >
                <Text style={styles.heroLabel}>{heroLabel}</Text>
                <Text style={styles.heroValue}>
                    {totalMonthly.toFixed(2)}
                    <Text style={styles.heroCurrency}> {currency}</Text>
                </Text>
                <Text style={styles.heroSubtitle}>
                    Across {filteredExpenses.length}{' '}
                    {cycleFilter === 'ALL' ? 'active' : `${heroLabel.toLowerCase().replace(' outflow', '').replace('*', '')}`}{' '}
                    {filteredExpenses.length === 1 ? 'subscription / bill' : 'subscriptions / bills'}
                </Text>
                {cycleFilter === 'ALL' && (
                    <Text style={styles.heroFootnote}>
                        * All amounts shown as monthly equivalents (quarterly ÷ 3, annual ÷ 12).
                    </Text>
                )}
            </View>

            {/* Pie chart. Two empty states: no expenses at all (CTA) vs
                no expenses match the current cycle filter (helpful nudge). */}
            {expenses.length === 0 ? (
                <View
                    style={styles.emptyCard}
                    lightColor="#fff"
                    darkColor="rgba(255,255,255,0.05)"
                >
                    <Text style={styles.emptyTitle}>No active expenses yet</Text>
                    <Text style={styles.emptyText}>
                        Add your first recurring subscription or bill to see your monthly
                        outflow broken down here.
                    </Text>
                    <Pressable
                        style={styles.button}
                        onPress={() => router.push('/expenses/new' as never)}
                    >
                        <Text style={styles.buttonText}>Add an expense</Text>
                    </Pressable>
                </View>
            ) : categoryAggs.length === 0 ? (
                <View
                    style={styles.emptyCard}
                    lightColor="#fff"
                    darkColor="rgba(255,255,255,0.05)"
                >
                    <Text style={styles.emptyTitle}>Nothing in this cycle</Text>
                    <Text style={styles.emptyText}>
                        You have active expenses, but none on a {cycleFilter.toLowerCase()} schedule.
                        Try a different cycle filter above.
                    </Text>
                </View>
            ) : (
                <>
                    <Text style={styles.sectionHeading}>By category</Text>
                    <View
                        style={styles.chartCard}
                        lightColor="#fff"
                        darkColor="rgba(255,255,255,0.05)"
                    >
                        <PieChart
                            data={pieData}
                            width={chartWidth}
                            height={200}
                            chartConfig={{
                                color: () => '#000',
                                labelColor: () => '#1c1c1e',
                            }}
                            accessor="amount"
                            backgroundColor="transparent"
                            paddingLeft="0"
                            absolute
                        />
                    </View>

                    {/* Per-category list — same data as the chart, easier to read precisely. */}
                    <View
                        style={styles.listCard}
                        lightColor="#fff"
                        darkColor="rgba(255,255,255,0.05)"
                    >
                        {categoryAggs.map((c, idx) => {
                            const pct = totalMonthly > 0 ? (c.monthly / totalMonthly) * 100 : 0;
                            return (
                                <View
                                    key={c.name}
                                    style={[styles.listRow, idx > 0 && styles.listRowBorder]}
                                >
                                    <View style={[styles.swatch, { backgroundColor: c.color }]} />
                                    <Text style={styles.listName}>{c.name}</Text>
                                    <Text style={styles.listPct}>{pct.toFixed(0)}%</Text>
                                    <Text style={styles.listAmount}>
                                        {c.monthly.toFixed(2)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            {/* Cross-link into the Price Change report (rubric §9.6 / §9.9). */}
            {expenses.length > 0 && (
                <Pressable
                    onPress={() => router.push('/expenses/price-changes' as never)}
                    style={({ pressed }) => [styles.reportLink, pressed && styles.rowPressed]}
                >
                    <View
                        style={styles.reportLinkInner}
                        lightColor="#fff"
                        darkColor="rgba(255,255,255,0.05)"
                    >
                        <FontAwesome name="line-chart" size={18} color="#2b6cb0" style={styles.listIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listName}>Price changes</Text>
                            <Text style={styles.listSub}>
                                See which active expenses have moved up or down over time.
                            </Text>
                        </View>
                        <FontAwesome name="chevron-right" size={12} color="#c0c0c5" />
                    </View>
                </Pressable>
            )}

            {/* Upcoming bills (next 30 days) */}
            {upcoming.length > 0 && (
                <>
                    <Text style={styles.sectionHeading}>Due in the next 30 days</Text>
                    <View
                        style={styles.listCard}
                        lightColor="#fff"
                        darkColor="rgba(255,255,255,0.05)"
                    >
                        {upcoming.map((b, idx) => (
                            <Pressable
                                key={b.id}
                                onPress={() => router.push(`/expenses/${b.id}` as never)}
                                style={({ pressed }) => [
                                    styles.listRow,
                                    idx > 0 && styles.listRowBorder,
                                    pressed && styles.rowPressed,
                                ]}
                            >
                                <FontAwesome
                                    name="calendar"
                                    size={14}
                                    color="#6c6c70"
                                    style={styles.listIcon}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.listName}>{b.service_name}</Text>
                                    <Text style={styles.listSub}>
                                        {b.daysAway === 0
                                            ? 'today'
                                            : b.daysAway === 1
                                                ? 'tomorrow'
                                                : `in ${b.daysAway} days · ${b.next_due_date}`}
                                    </Text>
                                </View>
                                <Text style={styles.listAmount}>{b.expense_amount}</Text>
                            </Pressable>
                        ))}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 48,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e3e3e7',
        backgroundColor: '#fff',
    },
    filterChipSelected: {
        backgroundColor: '#2b6cb0',
        borderColor: '#2b6cb0',
    },
    filterChipText: {
        color: '#1c1c1e',
        fontSize: 13,
        fontWeight: '600',
    },
    filterChipTextSelected: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    heroCard: {
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    heroFootnote: {
        color: '#6c6c70',
        fontSize: 11,
        marginTop: 10,
        lineHeight: 15,
        fontStyle: 'italic',
    },
    heroLabel: {
        fontSize: 13,
        color: '#6c6c70',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroValue: {
        fontSize: 38,
        fontWeight: '700',
        marginTop: 4,
    },
    heroCurrency: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6c6c70',
    },
    heroSubtitle: {
        color: '#6c6c70',
        marginTop: 6,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
        marginTop: 8,
    },
    chartCard: {
        borderRadius: 12,
        padding: 8,
        marginBottom: 12,
        alignItems: 'center',
    },
    listCard: {
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
    },
    reportLink: {
        marginBottom: 20,
    },
    reportLinkInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 10,
    },
    listRowBorder: {
        borderTopWidth: 1,
        borderTopColor: '#e3e3e7',
    },
    rowPressed: {
        opacity: 0.6,
    },
    listIcon: {
        width: 18,
        textAlign: 'center',
    },
    listName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    listSub: {
        color: '#6c6c70',
        fontSize: 12,
        marginTop: 2,
    },
    listPct: {
        color: '#6c6c70',
        fontSize: 12,
        width: 38,
        textAlign: 'right',
    },
    listAmount: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
    swatch: {
        width: 12,
        height: 12,
        borderRadius: 3,
    },
    emptyCard: {
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
    },
    emptyText: {
        color: '#6c6c70',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    error: {
        color: '#b94a48',
        textAlign: 'center',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
