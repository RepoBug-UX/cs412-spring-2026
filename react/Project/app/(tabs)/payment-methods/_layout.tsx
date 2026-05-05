// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Stack-within-tabs layout for the Payment Methods feature.
//              Lets list -> detail -> edit feel like a native push/pop
//              flow even though the whole thing lives inside one tab.
//              Per-screen titles are set in each child file via Stack.Screen
//              options when they need dynamic content.

import { Stack } from 'expo-router';

export default function PaymentMethodsStackLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Payment Methods' }} />
            <Stack.Screen name="new" options={{ title: 'Add Payment Method' }} />
            <Stack.Screen name="[id]" options={{ title: 'Payment Method' }} />
        </Stack>
    );
}
