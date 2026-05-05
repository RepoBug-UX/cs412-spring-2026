// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Payment Methods list — top of the Stack within the
//              "Payment Methods" tab. Shows the user's cards/accounts
//              with a tap-to-detail row interaction and a header "+ Add"
//              button that pushes the create screen. Refreshes on every
//              focus so newly-created or deleted methods show up
//              immediately when navigating back from a child screen.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiList } from '@/src/api/client';
import { PaymentMethod } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/** FontAwesome icon name for each method type. */
const METHOD_ICON: Record<PaymentMethod['method_type'], React.ComponentProps<typeof FontAwesome>['name']> = {
    CREDIT_CARD: 'credit-card',
    DEBIT_CARD: 'credit-card-alt',
    CHECKING: 'university',
};

export default function PaymentMethodsListScreen() {
    const { session } = useAuth();
    const [items, setItems] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchList = useCallback(async () => {
        if (!session?.token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiList<PaymentMethod>('/payment-methods/', { token: session.token });
            setItems(data);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not load payment methods (HTTP ${error.status}).`
                : 'Could not reach the server. Check that the backend is running.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token]);

    useFocusEffect(
        useCallback(() => {
            fetchList();
        }, [fetchList]),
    );

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <Pressable onPress={() => router.push('/payment-methods/new' as never)} hitSlop={12}>
                            <Text style={styles.headerAction}>+ Add</Text>
                        </Pressable>
                    ),
                }}
            />

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
                    <Text style={styles.empty}>No payment methods yet.</Text>
                    <Pressable
                        style={styles.primaryButton}
                        onPress={() => router.push('/payment-methods/new' as never)}
                    >
                        <Text style={styles.primaryButtonText}>Add your first</Text>
                    </Pressable>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.container}>
                    {items.map((pm) => (
                        <Pressable
                            key={pm.id}
                            onPress={() => router.push(`/payment-methods/${pm.id}` as never)}
                            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        >
                            <View
                                style={styles.rowInner}
                                lightColor="#fff"
                                darkColor="rgba(255,255,255,0.05)"
                            >
                                <FontAwesome
                                    name={METHOD_ICON[pm.method_type]}
                                    size={22}
                                    color="#2b6cb0"
                                    style={styles.rowIcon}
                                />
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>{pm.nickname}</Text>
                                    <Text style={styles.rowSubtitle}>
                                        {pm.method_type_label}
                                        {pm.expiry_date ? ` · expires ${pm.expiry_date}` : ''}
                                    </Text>
                                </View>
                                <FontAwesome name="chevron-right" size={14} color="#c0c0c5" />
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
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
    rowIcon: {
        marginRight: 14,
        width: 24,
        textAlign: 'center',
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
    empty: {
        color: '#6c6c70',
        fontStyle: 'italic',
        marginBottom: 20,
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
    primaryButton: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 6,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
