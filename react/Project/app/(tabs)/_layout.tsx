// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Tab navigation shell for the authenticated portion of the
//              mobile app. Phase 4a ships two real tabs — Home (welcome)
//              and Settings (logout) — proving the auth flow works
//              end-to-end. Subsequent chunks (4b, 4c, ...) repurpose the
//              `two` slot or add new sibling tabs for Profile, Payment
//              Methods, Expenses, etc.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';

/** Standard FontAwesome icon for a tab bar entry. */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  // Narrow useColorScheme()'s `'light' | 'dark' | null` union to a key the
  // Colors map actually has so TypeScript doesn't widen the index type.
  const colorScheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web to prevent a
        // hydration error in React Navigation v6 (kept from boilerplate).
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          // Inner Stack draws its own header; suppress the outer tabs header.
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="list-alt" color={color} />,
        }}
        // Re-tapping the Expenses tab while it's already focused pops the
        // inner Stack to the list view, so users always know "tap Expenses
        // -> see expenses" regardless of how deep they navigated last time.
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!navigation.isFocused()) return;
            const state = navigation.getState();
            const tabRoute = state.routes[state.index];
            if (tabRoute?.state && (tabRoute.state.index ?? 0) > 0) {
              e.preventDefault();
              navigation.dispatch({
                type: 'POP_TO_TOP',
                target: tabRoute.state.key,
              });
            }
          },
        })}
      />
      <Tabs.Screen
        name="payment-methods"
        options={{
          title: 'Cards',
          // Inner Stack draws its own header; suppress the outer tabs header.
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="credit-card" color={color} />,
        }}
        // Same popToTop-on-retap pattern as Expenses so navigation feels
        // consistent across both stack-within-tabs flows.
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!navigation.isFocused()) return;
            const state = navigation.getState();
            const tabRoute = state.routes[state.index];
            if (tabRoute?.state && (tabRoute.state.index ?? 0) > 0) {
              e.preventDefault();
              navigation.dispatch({
                type: 'POP_TO_TOP',
                target: tabRoute.state.key,
              });
            }
          },
        })}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
