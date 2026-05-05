// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Login screen for the mobile app. Posts to /api/auth/login/
//              via the AuthContext, then the root layout's auth gate
//              redirects to the (tabs) group on success. The form pattern
//              mirrors the DadJokes Add-Joke reference screen — local
//              useState per field, Pressable submit, inline error display.

import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';

export default function LoginScreen() {
    const { login } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        if (!username.trim() || !password) {
            setErrorMessage('Please enter both a username and a password.');
            return;
        }
        setErrorMessage('');
        setSubmitting(true);
        try {
            await login(username.trim(), password);
            // On success the root layout's auth gate redirects automatically.
            router.replace('/');
        } catch (error) {
            // DRF's login endpoint returns 400 with {"non_field_errors": [...]}
            // on bad credentials; surface a friendly fallback otherwise.
            if (error instanceof ApiError && error.status === 400) {
                setErrorMessage('Invalid username or password.');
            } else {
                setErrorMessage('Could not log in. Is the backend reachable?');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to view your financial tracker.</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="your-username"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
            />

            {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}

            <Pressable
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
            </Pressable>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Don&apos;t have an account?</Text>
                {/* Cast: the .expo/types cache regenerates on `expo start`. */}
                <Link href={'/(auth)/register' as never} style={styles.footerLink}>
                    Sign up
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
