// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Authentication context provider for the mobile app.
//              Persists the DRF auth token in expo-secure-store so the
//              session survives app restarts, exposes login / register /
//              logout helpers that talk to the Django auth endpoints,
//              and publishes auth state via React Context so screens can
//              react to it (e.g. the root layout's redirect logic).

import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { apiFetch } from '@/src/api/client';

/** Persistence key for the DRF token in expo-secure-store. */
const TOKEN_KEY = 'finance_tracker_token';
/** Persistence key for the cached username (avoids re-fetching on resume). */
const USERNAME_KEY = 'finance_tracker_username';

interface AuthSession {
    token: string;
    username: string;
}

/**
 * Shape exposed by `useAuth()`.
 *
 * - `session`: the currently-authenticated user, or `null` when anonymous.
 * - `isLoading`: true on first render while we restore from SecureStore.
 *   Screens should render a splash/loader while this is true so the auth
 *   gate does not flash the wrong route.
 * - `login` / `register`: hit the corresponding Django endpoints and persist
 *   the returned token. Throws on invalid credentials so callers can render
 *   inline errors.
 * - `logout`: clears the persisted token and resets `session` to null.
 */
interface AuthContextValue {
    session: AuthSession | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email?: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Response shape returned by /api/auth/login/ and /api/auth/register/. */
interface AuthResponse {
    token: string;
    user_id: number;
    username: string;
}

/**
 * AuthProvider — wrap the app root in this so every screen can call
 * `useAuth()`. Restores any persisted session on mount; while that work
 * is in progress, `isLoading` is true and consumers should defer
 * navigation decisions.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Restore any persisted token from SecureStore on cold start.
        // SecureStore reads are asynchronous; until they complete we
        // present `isLoading=true` so the auth gate does not redirect
        // prematurely.
        (async () => {
            try {
                const [token, username] = await Promise.all([
                    SecureStore.getItemAsync(TOKEN_KEY),
                    SecureStore.getItemAsync(USERNAME_KEY),
                ]);
                if (token && username) {
                    setSession({ token, username });
                }
            } catch (error) {
                console.warn('[auth] failed to restore session:', error);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    /**
     * Persist the issued credentials to SecureStore and update state.
     * Centralized here so login and register share the exact same path.
     */
    async function persistSession(token: string, username: string) {
        await Promise.all([
            SecureStore.setItemAsync(TOKEN_KEY, token),
            SecureStore.setItemAsync(USERNAME_KEY, username),
        ]);
        setSession({ token, username });
    }

    async function login(username: string, password: string) {
        const data = await apiFetch<AuthResponse>('/auth/login/', {
            method: 'POST',
            body: { username, password },
        });
        await persistSession(data.token, data.username);
    }

    async function register(username: string, password: string, email?: string) {
        const data = await apiFetch<AuthResponse>('/auth/register/', {
            method: 'POST',
            body: { username, password, email },
        });
        await persistSession(data.token, data.username);
    }

    async function logout() {
        await Promise.all([
            SecureStore.deleteItemAsync(TOKEN_KEY),
            SecureStore.deleteItemAsync(USERNAME_KEY),
        ]);
        setSession(null);
    }

    const value: AuthContextValue = { session, isLoading, login, register, logout };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for accessing the auth context. Throws if used outside an
 * AuthProvider so misuse is caught at render-time rather than producing
 * silently-stale auth state.
 */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth() must be called inside an <AuthProvider>.');
    }
    return ctx;
}
