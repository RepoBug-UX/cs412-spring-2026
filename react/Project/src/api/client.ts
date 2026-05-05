// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Lightweight fetch wrapper for talking to the Django/DRF
//              backend at /project/api/. Centralizes the base-URL choice
//              (auto-detected from Expo's manifest in dev), transparently
//              injects the Authorization: Token <key> header when a token
//              is provided, normalizes JSON parsing, and tolerates DRF's
//              paginated and unpaginated response shapes the same way the
//              DadJokes reference app did.

import Constants from 'expo-constants';

/**
 * Derive the API host from Expo's manifest in development. When running
 * `expo start` the dev server publishes a `hostUri` like "192.168.1.42:8081";
 * the IP portion is the dev machine's LAN address, which is reachable from
 * iOS Simulator and from physical devices on the same Wi-Fi. Falls back to
 * `localhost` when the manifest is unavailable (e.g. some web/dev scenarios).
 *
 * Override `API_BASE` manually if you are running on the Android emulator
 * (use `10.0.2.2`) or pointing at a deployed backend.
 */
const debuggerHost: string | undefined = Constants.expoConfig?.hostUri?.split(':')[0];
const apiHost = debuggerHost ?? 'localhost';
export const API_BASE = `http://${apiHost}:8000/project/api`;

/** HTTP methods the wrapper supports. */
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Options accepted by `apiFetch`. `body` is JSON-serialized automatically. */
export interface ApiFetchOptions {
    method?: Method;
    /** Optional Token-auth key. When omitted, no Authorization header is sent. */
    token?: string | null;
    /** JSON-serializable request body. */
    body?: unknown;
    /** Optional query-string params; values are stringified and URL-encoded. */
    query?: Record<string, string | number | boolean | undefined>;
}

/** Thrown when the backend returns a non-2xx status. */
export class ApiError extends Error {
    status: number;
    body: unknown;

    constructor(status: number, body: unknown, message?: string) {
        super(message ?? `API error ${status}`);
        this.status = status;
        this.body = body;
    }
}

/**
 * Send a JSON request to the backend and return the parsed response body.
 *
 * - Authorization is injected only when `token` is truthy, matching DRF's
 *   TokenAuthentication header convention.
 * - Empty bodies (e.g. HTTP 204 from DELETE) resolve to `null` instead of
 *   crashing the JSON parser.
 * - Non-2xx responses raise `ApiError` carrying the parsed body so callers
 *   can surface DRF's per-field validation messages.
 */
export async function apiFetch<T = unknown>(
    path: string,
    options: ApiFetchOptions = {},
): Promise<T> {
    const { method = 'GET', token, body, query } = options;

    let url = `${API_BASE}${path}`;
    if (query) {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null) params.set(k, String(v));
        });
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (token) headers['Authorization'] = `Token ${token}`;

    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return null as T;

    const text = await response.text();
    const parsed = text.length ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new ApiError(response.status, parsed);
    }

    return parsed as T;
}

/**
 * Helper for endpoints that return a paginated DRF list. Tolerates both
 * the paginated wrapper (`{count, next, previous, results}`) and a bare
 * array, mirroring the pattern from the DadJokes reference app.
 */
export async function apiList<T>(
    path: string,
    options: ApiFetchOptions = {},
): Promise<T[]> {
    const data = await apiFetch<{ results?: T[] } | T[]>(path, options);
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
}
