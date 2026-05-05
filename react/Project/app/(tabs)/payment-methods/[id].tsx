// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Payment-method detail screen — second level of the
//              payment-methods Stack. View mode shows the saved fields;
//              tapping Edit flips the same screen into a form (same
//              chip-picker + TextInput pattern as new.tsx) that PATCHes
//              /api/payment-methods/<id>/. A Delete button at the bottom
//              fires a confirm Alert and DELETEs the record before
//              popping back to the list.
//
//              Path-param `id` comes from the file name `[id].tsx` and
//              is read via useLocalSearchParams. We re-fetch on focus so
//              if the user edits the same record from somewhere else
//              the on-screen state stays accurate.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch } from '@/src/api/client';
import { PaymentMethod, PaymentMethodType, PaymentMethodUpdate } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { MonthYearField, isoToMmYy } from '@/src/components/MonthYearField';

const METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CHECKING', label: 'Checking Account' },
];


export default function PaymentMethodDetailScreen() {
    const { session } = useAuth();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [pm, setPm] = useState<PaymentMethod | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [editing, setEditing] = useState(false);
    const [draftNickname, setDraftNickname] = useState('');
    const [draftType, setDraftType] = useState<PaymentMethodType>('CREDIT_CARD');
    const [draftExpiry, setDraftExpiry] = useState('');
    const [saving, setSaving] = useState(false);

    const [deleting, setDeleting] = useState(false);

    const fetchOne = useCallback(async () => {
        if (!session?.token || !id) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiFetch<PaymentMethod>(`/payment-methods/${id}/`, {
                token: session.token,
            });
            setPm(data);
        } catch (error) {
            const message = error instanceof ApiError && error.status === 404
                ? 'This payment method no longer exists.'
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

    function startEdit() {
        if (!pm) return;
        setDraftNickname(pm.nickname);
        setDraftType(pm.method_type);
        setDraftExpiry(pm.expiry_date ?? '');
        setErrorMessage('');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setErrorMessage('');
    }

    async function saveEdit() {
        if (!session?.token || !pm) return;
        if (!draftNickname.trim()) {
            setErrorMessage('Nickname is required.');
            return;
        }
        // No further date validation needed — MonthYearField only emits a
        // complete ISO YYYY-MM-DD when MM/YY parses cleanly, so draftExpiry
        // is either valid or empty by construction.
        setSaving(true);
        setErrorMessage('');
        try {
            const update: PaymentMethodUpdate = {
                nickname: draftNickname.trim(),
                method_type: draftType,
                expiry_date: draftExpiry || null,
            };
            const data = await apiFetch<PaymentMethod>(`/payment-methods/${pm.id}/`, {
                method: 'PATCH',
                token: session.token,
                body: update,
            });
            setPm(data);
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
        if (!pm) return;
        Alert.alert(
            'Delete payment method?',
            `"${pm.nickname}" will be removed. Expenses currently using it will keep their record but their payment-method link will be cleared.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: doDelete },
            ],
        );
    }

    async function doDelete() {
        if (!session?.token || !pm) return;
        setDeleting(true);
        try {
            await apiFetch(`/payment-methods/${pm.id}/`, {
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

    if (loading && !pm) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!pm) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{errorMessage || 'Not found.'}</Text>
                <Pressable style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Stack.Screen options={{ title: pm.nickname }} />

            <View style={styles.card} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                <Text style={styles.label}>Nickname</Text>
                {editing ? (
                    <TextInput
                        style={styles.input}
                        value={draftNickname}
                        onChangeText={setDraftNickname}
                        autoCapitalize="words"
                    />
                ) : (
                    <Text style={styles.value}>{pm.nickname}</Text>
                )}

                <Text style={styles.label}>Method type</Text>
                {editing ? (
                    <View style={styles.chipRow}>
                        {METHOD_TYPE_OPTIONS.map((opt) => {
                            const selected = draftType === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => setDraftType(opt.value)}
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
                    <Text style={styles.value}>{pm.method_type_label}</Text>
                )}

                <Text style={styles.label}>Expiry date</Text>
                {editing ? (
                    <MonthYearField value={draftExpiry} onChange={setDraftExpiry} />
                ) : (
                    <Text style={styles.value}>{isoToMmYy(pm.expiry_date) || '—'}</Text>
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

            <View style={styles.divider} lightColor="#e3e3e7" darkColor="rgba(255,255,255,0.1)" />

            <Pressable
                style={[styles.deleteButton, deleting && styles.buttonDisabled]}
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
    value: {
        fontSize: 18,
        marginTop: 4,
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
