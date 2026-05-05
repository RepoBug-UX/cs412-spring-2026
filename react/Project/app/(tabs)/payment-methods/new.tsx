// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Create-Payment-Method form. POSTs to /api/payment-methods/
//              and on success navigates back to the list (which refreshes
//              via useFocusEffect). Uses the chip-picker pattern from the
//              Profile edit screen for the small enum field, and a plain
//              TextInput with a YYYY-MM-DD placeholder for the optional
//              expiry. A real DatePicker is intentionally deferred to 4d
//              where the required next_due_date on expenses makes the
//              install worthwhile.

import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch } from '@/src/api/client';
import { PaymentMethod, PaymentMethodCreate, PaymentMethodType } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { MonthYearField } from '@/src/components/MonthYearField';

const METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CHECKING', label: 'Checking Account' },
];

export default function NewPaymentMethodScreen() {
    const { session } = useAuth();

    const [nickname, setNickname] = useState('');
    const [methodType, setMethodType] = useState<PaymentMethodType>('CREDIT_CARD');
    /** ISO YYYY-MM-DD or empty string. Maintained by MonthYearField. */
    const [expiry, setExpiry] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        if (!nickname.trim()) {
            setErrorMessage('Please give this method a nickname.');
            return;
        }
        if (!session?.token) return;

        setErrorMessage('');
        setSubmitting(true);
        try {
            const body: PaymentMethodCreate = {
                nickname: nickname.trim(),
                method_type: methodType,
                // MonthYearField only emits a complete ISO when MM/YY is fully
                // typed (and month is 1-12), so we never send a partial value.
                expiry_date: expiry || null,
            };
            await apiFetch<PaymentMethod>('/payment-methods/', {
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

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nickname</Text>
            <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="e.g. Chase Sapphire"
                autoCapitalize="words"
            />

            <Text style={styles.label}>Method type</Text>
            <View style={styles.chipRow}>
                {METHOD_TYPE_OPTIONS.map((opt) => {
                    const selected = methodType === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            onPress={() => setMethodType(opt.value)}
                            style={[styles.chip, selected && styles.chipSelected]}
                        >
                            <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                                {opt.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={styles.label}>Expiry date (optional)</Text>
            <MonthYearField value={expiry} onChange={setExpiry} />
            <Text style={styles.hint}>
                Type as MM/YY — matches what&apos;s printed on the card. Leave blank
                for accounts that don&apos;t expire (e.g. checking).
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
        fontSize: 14,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
