// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Layout for the (auth) route group. Renders the login and
//              register screens as a Stack so users can navigate between
//              them. The route-group parentheses keep these URLs at the
//              app root (e.g. /login) without a /auth prefix.

import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerTitle: 'Financial Tracker' }}>
            <Stack.Screen name="login" options={{ title: 'Log in' }} />
            <Stack.Screen name="register" options={{ title: 'Sign up' }} />
        </Stack>
    );
}
