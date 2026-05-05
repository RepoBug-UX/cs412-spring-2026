// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Sign-up screen. Posts to /api/auth/register/ via the
//              AuthContext, which atomically creates a User + UserProfile
//              + Token on the backend and treats the response as
//              auto-login. On success the root layout's gate redirects to
//              the authenticated tabs.

import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';

export default function RegisterScreen() {
    const { register } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        if (!username.trim() || !password) {
            setErrorMessage('Username and password are required.');
            return;
        }
        if (password.length < 8) {
            setErrorMessage('Password must be at least 8 characters.');
            return;
        }
        setErrorMessage('');
        setSubmitting(true);
        try {
            await register(username.trim(), password, email.trim() || undefined);
            router.replace('/');
        } catch (error) {
            // DRF returns 400 with per-field validation messages; flatten the
            // first one into the inline error so the user gets actionable
            // feedback (e.g. "A user with that username already exists.").
            if (error instanceof ApiError && error.status === 400 && error.body && typeof error.body === 'object') {
                const firstField = Object.values(error.body as Record<string, string[]>)[0];
                setErrorMessage(Array.isArray(firstField) ? firstField[0] : 'Registration failed.');
            } else {
                setErrorMessage('Could not create your account. Is the backend reachable?');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
                You&apos;ll get a starter profile and can edit your income and currency
                later from the Settings tab.
            </Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="pick-a-username"
            />

            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="at least 8 characters"
            />

            {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}

            <Pressable
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign up</Text>}
            </Pressable>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                {/* Cast: the .expo/types cache regenerates on `expo start`. */}
                <Link href={'/(auth)/login' as never} style={styles.footerLink}>
                    Log in
                </Link>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#f7f7f9',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 8,
    },
    subtitle: {
        color: '#6c6c70',
        marginBottom: 32,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6c6c70',
        marginBottom: 4,
        marginTop: 12,
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
    error: {
        color: '#b94a48',
        marginTop: 12,
    },
    button: {
        backgroundColor: '#2b6cb0',
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
        marginTop: 24,
    },
    buttonDisabled: {
        backgroundColor: '#7c9bbf',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        color: '#6c6c70',
    },
    footerLink: {
        color: '#2b6cb0',
        fontWeight: '600',
    },
});
