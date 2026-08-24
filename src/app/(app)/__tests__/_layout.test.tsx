import { useAuth } from '@clerk/expo';
import * as React from 'react';

import { getTabIcon } from '@/components/ui/tab-icons';
import { useIsFirstTime } from '@/lib/hooks/use-is-first-time';
import { cleanup, render, screen } from '@/lib/test-utils';

import TabLayout from '../_layout';

const mockScreenProps: Array<{ name: string; options: Record<string, unknown> }> = [];

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/hooks/use-is-first-time', () => ({
  useIsFirstTime: jest.fn(),
}));

jest.mock('@/components/ui/tab-icons', () => ({
  getTabIcon: jest.fn(name => `${name}-icon`),
}));

jest.mock('@bottom-tabs/react-navigation', () => ({
  createNativeBottomTabNavigator: () => ({ Navigator: () => null }),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: 'tabs' }, children);
  Tabs.Screen = (props: { name: string; options: Record<string, unknown> }) => {
    mockScreenProps.push(props);
    return React.createElement(View, { testID: `tab-${props.name}` });
  };
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(View, { testID: `redirect-${href}` }),
    withLayoutContext: () => Tabs,
  };
});

function arrangeGuard({
  firstTime = false,
  loaded = true,
  signedIn = true,
} = {}) {
  jest.mocked(useIsFirstTime).mockReturnValue([firstTime, jest.fn()]);
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: loaded,
    isSignedIn: signedIn,
  } as never);
}

afterEach(() => {
  cleanup();
  mockScreenProps.length = 0;
  jest.clearAllMocks();
});

describe('authenticated app route guard', () => {
  it('sends first-time users to onboarding before checking auth', () => {
    arrangeGuard({ firstTime: true, loaded: false, signedIn: false });

    render(<TabLayout />);

    expect(screen.getByTestId('redirect-/onboarding')).toBeOnTheScreen();
  });

  it('renders nothing while Clerk restores a returning session', () => {
    arrangeGuard({ loaded: false });

    const { toJSON } = render(<TabLayout />);

    expect(toJSON()).toBeNull();
  });

  it('sends loaded signed-out users to login', () => {
    arrangeGuard({ signedIn: false });

    render(<TabLayout />);

    expect(screen.getByTestId('redirect-/login')).toBeOnTheScreen();
  });

  it('renders the stable tab contract for signed-in users', () => {
    arrangeGuard();

    render(<TabLayout />);

    expect(screen.getByTestId('tabs')).toBeOnTheScreen();
    expect(mockScreenProps.map(({ name, options }) => ({
      name,
      testID: options.tabBarButtonTestID,
      title: options.title,
    }))).toEqual([
      { name: 'index', testID: 'feed-tab', title: 'Feed' },
      { name: 'style', testID: 'style-tab', title: 'Style' },
      { name: 'settings', testID: 'settings-tab', title: 'Settings' },
    ]);

    for (const { options } of mockScreenProps) {
      (options.tabBarIcon as () => unknown)();
    }
    expect(getTabIcon).toHaveBeenCalledWith('feed');
    expect(getTabIcon).toHaveBeenCalledWith('style');
    expect(getTabIcon).toHaveBeenCalledWith('settings');
  });
});
