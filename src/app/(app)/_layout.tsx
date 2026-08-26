import type {
  NativeBottomTabNavigationEventMap,
  NativeBottomTabNavigationOptions,
} from '@bottom-tabs/react-navigation';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { useAuth } from '@clerk/expo';
import { Redirect, withLayoutContext } from 'expo-router';
import * as React from 'react';

import { getTabIcon } from '@/components/ui/tab-icons';
import { useIsFirstTime } from '@/lib/hooks/use-is-first-time';
import { ROUTES } from '@/lib/navigation';

// The navigator is mounted exactly once, here, which is why it is not wrapped:
// Expo Router requires it to be declared in the layout. The icons ARE wrapped —
// see components/ui/tab-icons.tsx.
const { Navigator } = createNativeBottomTabNavigator();

const Tabs = withLayoutContext<
  NativeBottomTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(Navigator);

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isFirstTime] = useIsFirstTime();

  if (isFirstTime) {
    return <Redirect href={ROUTES.onboarding} />;
  }
  // Clerk restores the session from the token cache asynchronously. Redirecting
  // before that resolves would bounce an already-signed-in user to /login.
  if (!isLoaded) {
    return null;
  }
  if (!isSignedIn) {
    return <Redirect href={ROUTES.login} />;
  }
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: () => getTabIcon('feed'),
          tabBarButtonTestID: 'feed-tab',
        }}
      />

      <Tabs.Screen
        name="style"
        options={{
          title: 'Style',
          tabBarIcon: () => getTabIcon('style'),
          tabBarButtonTestID: 'style-tab',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => getTabIcon('settings'),
          tabBarButtonTestID: 'settings-tab',
        }}
      />
    </Tabs>
  );
}
