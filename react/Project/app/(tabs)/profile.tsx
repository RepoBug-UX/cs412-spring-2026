// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Profile tab — view and edit the caller's UserProfile.
//              Phase 4b read+update screen. View mode shows the user's
//              monthly income and currency preference; tapping Edit flips
//              the same screen into a form mode that PATCHes /api/profile/.
//              Logout lives at the bottom because account actions
//              naturally cluster together. Loading / error / saving
//              states are surfaced inline so the user always knows what
//              the screen is doing.

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
import { UserProfile, UserProfileUpdate } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/** Currency options exposed in the edit form. Mirrors UserProfile.CURRENCY_CHOICES on the backend. */
const CURRENCY_OPTIONS: { code: string; label: string }[] = [
    { code: 'USD', label: 'US Dollar (USD)' },
    { code: 'EUR', label: 'Euro (EUR)' },
    { code: 'GBP', label: 'British Pound (GBP)' },
    { code: 'JPY', label: 'Japanese Yen (JPY)' },
    { code: 'CAD', label: 'Canadian Dollar (CAD)' },
    { code: 'AUD', label: 'Australian Dollar (AUD)' },
];

export default function ProfileTab() {
    const { session, logout } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    // Edit-mode local form state. Populated from `profile` whenever the
    // user enters edit mode so cancelling discards their unsaved input.
    const [editing, setEditing] = useState(false);
    const [draftIncome, setDraftIncome] = useState('');
    const [draftCurrency, setDraftCurrency] = useState('USD');
    const [saving, setSaving] = useState(false);

    const [signingOut, setSigningOut] = useState(false);

    /**
     * Fetch the current user's profile. Re-runs on every tab focus via
     * `useFocusEffect` so the screen reflects edits made elsewhere
     * (e.g. through the web frontend or the admin) without a manual
     * pull-to-refresh.
     */
    const fetchProfile = useCallback(async () => {
        if (!session?.token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await apiFetch<UserProfile>('/profile/', { token: session.token });
            setProfile(data);
        } catch (error) {
            const message = error instanceof ApiError
                ? `Could not load profile (HTTP ${error.status}).`
                : 'Could not reach the server. Check that the backend is running.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }, [session?.token]);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [fetchProfile]),
    );

    function startEdit() {
        if (!profile) return;
        setDraftIncome(profile.monthly_income);
        setDraftCurrency(profile.currency_preference);
        setErrorMessage('');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setErrorMessage('');
    }

    async function saveEdit() {
        if (!session?.token) return;
        setSaving(true);
        setErrorMessage('');
        try {
            const update: UserProfileUpdate = {
                monthly_income: draftIncome,
                currency_preference: draftCurrency,
            };
            const updated = await apiFetch<UserProfile>('/profile/', {
                method: 'PATCH',
                token: session.token,
                body: update,
            });
            setProfile(updated);
            setEditing(false);
        } catch (error) {
            if (error instanceof ApiError && error.status === 400 && error.body) {
                // Surface the first DRF field-error so the user sees what was
                // wrong (e.g. invalid decimal).
                const first = Object.values(error.body as Record<string, string[]>)[0];
                setErrorMessage(Array.isArray(first) ? first[0] : 'Could not save profile.');
            } else {
                setErrorMessage('Could not save profile. Try again in a moment.');
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleLogout() {
        setSigningOut(true);
        try {
            await logout();
            // Auth gate in the root layout handles the redirect.
        } finally {
            setSigningOut(false);
        }
    }

    if (loading && !profile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!profile) {
        // Loaded but failed (or empty) — show the error and a retry.
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{errorMessage || 'Profile unavailable.'}</Text>
                <Pressable style={styles.button} onPress={fetchProfile}>
                    <Text style={styles.buttonText}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Profile</Text>

            <View style={styles.card} lightColor="#fff" darkColor="rgba(255,255,255,0.05)">
                <Text style={styles.label}>Username</Text>
                <Text style={styles.value}>{profile.username}</Text>

                <Text style={styles.label}>Monthly income</Text>
                {editing ? (
                    <TextInput
                        value={draftIncome}
                        onChangeText={setDraftIncome}
                        keyboardType="decimal-pad"
                        style={styles.input}
                        placeholder="0.00"
                    />
                ) : (
                    <Text style={styles.value}>
                        {profile.monthly_income} {profile.currency_preference}
                    </Text>
                )}

                <Text style={styles.label}>Currency preference</Text>
                {editing ? (
                    <View style={styles.currencyRow}>
                        {CURRENCY_OPTIONS.map((opt) => {
                            const selected = draftCurrency === opt.code;
                            return (
                                <Pressable
                                    key={opt.code}
                                    onPress={() => setDraftCurrency(opt.code)}
                                    style={[styles.currencyChip, selected && styles.currencyChipSelected]}
                                >
                                    <Text style={selected ? styles.currencyChipTextSelected : styles.currencyChipText}>
                                        {opt.code}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.value}>
                        {CURRENCY_OPTIONS.find((c) => c.code === profile.currency_preference)?.label
                            ?? profile.currency_preference}
                    </Text>
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
                style={[styles.logoutButton, signingOut && styles.buttonDisabled]}
                onPress={handleLogout}
                disabled={signingOut}
            >
                {signingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log out</Text>}
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
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 16,
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
    currencyRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    currencyChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e3e3e7',
        backgroundColor: '#f7f7f9',
    },
    currencyChipSelected: {
        backgroundColor: '#2b6cb0',
        borderColor: '#2b6cb0',
    },
    currencyChipText: {
        color: '#1c1c1e',
        fontSize: 13,
        fontWeight: '600',
    },
    currencyChipTextSelected: {
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
    logoutButton: {
        backgroundColor: '#b94a48',
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    divider: {
        height: 1,
        marginVertical: 24,
    },
    error: {
        color: '#b94a48',
        marginVertical: 12,
        textAlign: 'center',
    },
});
