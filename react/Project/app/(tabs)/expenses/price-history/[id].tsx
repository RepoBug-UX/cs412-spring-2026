// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Price-history note editor — the D8 safety net. The
//              auto-created PriceHistory rows on expense create/edit
//              default to either "Initial price recorded." or an empty
//              note; users land here from the parent expense's timeline
//              to attach context after the fact ("monthly plan price
//              hike", "promo expired", etc.). amount_recorded and
//              date_changed are read-only by serializer design — the
//              field never even renders as editable here, mirroring the
//              backend rule.

import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError, apiFetch } from '@/src/api/client';
import { PriceHistory, PriceHistoryUpdate } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

export default function PriceHistoryNoteScreen() {
    const { session } = useAuth();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [row, setRow] = useState<PriceHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [draftNote, setDraftNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const fetchOne = useCallback(async () => {
        if (!session?.token || !id) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiFetch<PriceHistory>(`/price-history/${id}/`, {
                token: session.token,
            });
            setRow(data);
            setDraftNote(data.change_note);
        } catch (error) {
            const message = error instanceof ApiError && error.status === 404
                ? 'This price-history row no longer exists.'
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

    async function handleSave() {
        if (!session?.token || !row) return;
        setSaving(true);
        setSaved(false);
        setErrorMessage('');
        try {
            const update: PriceHistoryUpdate = { change_note: draftNote };
            const data = await apiFetch<PriceHistory>(`/price-history/${row.id}/`, {
                method: 'PATCH',
                token: session.token,
                body: update,
            });
            setRow(data);
            setSaved(true);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not save (HTTP ${error.status}).`
                : 'Could not save. Try again in a moment.';
            setErrorMessage(message);
        } finally {
            setSaving(false);
        }
    }

    if (loading && !row) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!row) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{errorMessage || 'Not found.'}</Text>
                <Pressable style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    const dirty = draftNote !== row.change_note;

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.card} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                <Text style={styles.label}>Date changed</Text>
                <Text style={styles.value}>{row.date_changed}</Text>

                <Text style={styles.label}>Recorded amount</Text>
                <Text style={styles.value}>{row.amount_recorded}</Text>

                <Text style={styles.hint}>
                    Date and amount are read-only — they reflect the moment the price
                    was last saved. Edit the note below to add context.
                </Text>
            </View>

            <Text style={styles.label}>Change note</Text>
            <TextInput
                style={styles.textarea}
                value={draftNote}
                onChangeText={(t) => {
                    setDraftNote(t);
                    setSaved(false);
                }}
                multiline
                placeholder="Why did this price change? (optional)"
                placeholderTextColor="#9c9ca0"
            />

            {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}
            {saved && <Text style={styles.savedHint}>Saved.</Text>}

            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.buttonSecondary, saving && styles.buttonDisabled]}
                    onPress={() => router.back()}
                    disabled={saving}
                >
                    <Text style={styles.buttonSecondaryText}>Back</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, (saving || !dirty) && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={saving || !dirty}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save note</Text>}
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
    hint: {
        color: '#6c6c70',
        fontSize: 12,
        marginTop: 12,
        lineHeight: 18,
    },
    textarea: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16,
        minHeight: 110,
        textAlignVertical: 'top',
        marginTop: 6,
    },
    error: {
        color: '#b94a48',
        textAlign: 'center',
        marginTop: 12,
    },
    savedHint: {
        color: '#157a3a',
        textAlign: 'center',
        marginTop: 12,
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
