// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Price-Change Report screen — the rubric §9.6 + §9.9
//              cross-model derived report. Renamed in chunk 4h from
//              "Price Increase Report" to surface both increases AND
//              decreases (a payment dropping after a balance change is
//              just as worth flagging as a subscription getting more
//              expensive). Consumes
//              GET /api/reports/price-changes/?window_days=<n>; window
//              is user-selectable via chip-picker (30/90/180/365 days);
//              tapping a result row pushes the parent expense's detail.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch } from '@/src/api/client';
import { PriceChangeReport, PriceChangeRow } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/** Selectable lookback windows. Matches the values shown on the chip row. */
const WINDOW_OPTIONS: { value: number; label: string }[] = [
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' },
];

export default function PriceChangesReportScreen() {
    const { session } = useAuth();
    const [windowDays, setWindowDays] = useState(365);
    const [report, setReport] = useState<PriceChangeReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchReport = useCallback(async () => {
        if (!session?.token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiFetch<PriceChangeReport>('/reports/price-changes/', {
                token: session.token,
                query: { window_days: windowDays },
            });
            setReport(data);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not load report (HTTP ${error.status}).`
                : 'Could not reach the server. Check that the backend is running.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token, windowDays]);

    useFocusEffect(
        useCallback(() => {
            fetchReport();
        }, [fetchReport]),
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.headline}>How have your prices changed?</Text>
            <Text style={styles.subtitle}>
                Active expenses whose recorded price has moved during the chosen
                window — sorted so the biggest movers (up or down) surface first.
            </Text>

            <View style={styles.chipRow}>
                {WINDOW_OPTIONS.map((opt) => {
                    const selected = windowDays === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            onPress={() => setWindowDays(opt.value)}
                            style={[styles.chip, selected && styles.chipSelected]}
                        >
                            <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                {opt.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {loading && !report ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                </View>
            ) : errorMessage && !report ? (
                <View style={styles.centered}>
                    <Text style={styles.error}>{errorMessage}</Text>
                    <Pressable style={styles.button} onPress={fetchReport}>
                        <Text style={styles.buttonText}>Retry</Text>
                    </Pressable>
                </View>
            ) : !report || report.count === 0 ? (
                <View style={styles.emptyCard} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                    <FontAwesome name="check-circle" size={28} color="#38a169" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyTitle}>No price changes</Text>
                    <Text style={styles.emptyText}>
                        Nothing on your active list moved up or down in the last{' '}
                        {WINDOW_OPTIONS.find((w) => w.value === windowDays)?.label ?? `${windowDays} days`}.
                    </Text>
                </View>
            ) : (
                <>
                    <Text style={styles.summaryLine}>
                        {report.count} {report.count === 1 ? 'expense' : 'expenses'} with price changes
                    </Text>
                    {report.results.map((row) => (
                        <RowCard key={row.expense_id} row={row} />
                    ))}
                </>
            )}
        </ScrollView>
    );
}

/**
 * One row of the report. Color-coded badge: red `+%` for increases,
 * green `−%` for decreases. The signed strings come straight from the
 * backend so no arithmetic is needed here beyond reading the fields.
 */
function RowCard({ row }: { row: PriceChangeRow }) {
    const isIncrease = row.direction === 'increase';
    const pct = parseFloat(row.percent_change);
    const magnitude = Math.abs(pct).toFixed(1);
    return (
        <Pressable
            onPress={() => router.push(`/expenses/${row.expense_id}` as never)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
            <View style={styles.rowInner} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{row.service_name}</Text>
                    <View style={[styles.pctBadge, isIncrease ? styles.pctBadgeUp : styles.pctBadgeDown]}>
                        <Text style={isIncrease ? styles.pctBadgeTextUp : styles.pctBadgeTextDown}>
                            {isIncrease ? '+' : '−'}{magnitude}%
                        </Text>
                    </View>
                </View>
                <Text style={styles.rowCategory}>{row.category_name}</Text>
                <View style={styles.rowChange}>
                    <Text style={styles.rowAmount}>{row.first_amount}</Text>
                    <FontAwesome
                        name="long-arrow-right"
                        size={14}
                        color="#6c6c70"
                        style={{ marginHorizontal: 8 }}
                    />
                    <Text style={[styles.rowAmount, isIncrease ? styles.rowAmountUp : styles.rowAmountDown]}>
                        {row.latest_amount}
                    </Text>
                    <Text style={[styles.rowDelta, isIncrease ? styles.rowDeltaUp : styles.rowDeltaDown]}>
                        ({row.absolute_change})
                    </Text>
                </View>
                <Text style={styles.rowDates}>
                    {row.first_date} → {row.latest_date}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 48,
    },
    centered: {
        alignItems: 'center',
        padding: 24,
    },
    headline: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        color: '#6c6c70',
        marginBottom: 16,
        lineHeight: 20,
    },
    summaryLine: {
        color: '#6c6c70',
        marginBottom: 12,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
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
    row: {
        marginBottom: 10,
    },
    rowPressed: {
        opacity: 0.7,
    },
    rowInner: {
        padding: 14,
        borderRadius: 8,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    pctBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
    },
    pctBadgeUp: {
        backgroundColor: '#fed7d7',
    },
    pctBadgeDown: {
        backgroundColor: '#c6f6d5',
    },
    pctBadgeTextUp: {
        color: '#9b2c2c',
        fontSize: 12,
        fontWeight: '700',
    },
    pctBadgeTextDown: {
        color: '#22543d',
        fontSize: 12,
        fontWeight: '700',
    },
    rowCategory: {
        color: '#6c6c70',
        fontSize: 13,
        marginTop: 2,
    },
    rowChange: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    rowAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
    rowAmountUp: {
        color: '#9b2c2c',
    },
    rowAmountDown: {
        color: '#22543d',
    },
    rowDelta: {
        fontSize: 13,
        marginLeft: 8,
    },
    rowDeltaUp: {
        color: '#9b2c2c',
    },
    rowDeltaDown: {
        color: '#22543d',
    },
    rowDates: {
        color: '#6c6c70',
        fontSize: 12,
        marginTop: 6,
    },
    emptyCard: {
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        color: '#6c6c70',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 20,
    },
    error: {
        color: '#b94a48',
        textAlign: 'center',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
