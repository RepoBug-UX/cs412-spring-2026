// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Stack-within-tabs layout for the Expenses feature.
//              Mirrors the payment-methods Stack: list -> push detail
//              -> push edit-note (price-history) all feel like a native
//              push/pop flow inside one tab. Per-screen titles are set
//              in the child files when they need dynamic content (e.g.
//              the detail screen uses the service name).

import { Stack } from 'expo-router';

export default function ExpensesStackLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Expenses' }} />
            <Stack.Screen name="new" options={{ title: 'Add Expense' }} />
            <Stack.Screen name="[id]" options={{ title: 'Expense' }} />
            <Stack.Screen
                name="price-history/[id]"
                options={{ title: 'Price change' }}
            />
            <Stack.Screen
                name="price-changes"
                options={{ title: 'Price changes' }}
            />
        </Stack>
    );
}
