import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';

import { useThemeConfig } from '@/components/ui/use-theme-config';
import { useScreenTracking } from '@/lib/analytics';
import { initializeFeatureFlags } from '@/lib/feature-flags';
import { loadSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { fireEvent, render, screen } from '@/lib/test-utils';

import RootLayout from '../_layout';

jest.mock('../../global.css', () => ({}));

jest.mock('env', () => ({
  __esModule: true,
  default: { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example' },
}));

jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: { cache: true } }));

jest.mock('@clerk/expo', () => {
  return {
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('expo-splash-screen', () => ({
  hide: jest.fn(),
  preventAutoHideAsync: jest.fn(),
  setOptions: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: 'stack' }, children);
  Stack.Screen = ({ name }: { name: string }) =>
    React.createElement(View, { testID: `stack-${name}` });
  return { ErrorBoundary: () => null, Stack };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-flash-message', () => () => null);

jest.mock('@/lib/api', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/use-theme-config', () => ({
  useThemeConfig: jest.fn(() => ({ dark: true })),
}));

jest.mock('@/lib/hooks/use-selected-theme', () => ({
  loadSelectedTheme: jest.fn(),
}));

// Both telemetry modules are covered by their own tests. Here the observable
// behavior is only that the root layout starts them.
jest.mock('@/lib/analytics', () => ({
  useScreenTracking: jest.fn(),
}));

jest.mock('@/lib/feature-flags', () => ({
  initializeFeatureFlags: jest.fn(() => Promise.resolve()),
}));

describe('root layout', () => {
  it('initializes startup services and declares the root stack', () => {
    render(<RootLayout />);

    expect(loadSelectedTheme).toHaveBeenCalledTimes(1);
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
    expect(SplashScreen.setOptions).toHaveBeenCalledWith({ duration: 500, fade: true });
    expect(screen.getByTestId('stack-(app)')).toBeOnTheScreen();
    expect(screen.getByTestId('stack-onboarding')).toBeOnTheScreen();
    expect(screen.getByTestId('stack-login')).toBeOnTheScreen();
  });

  it('starts feature flags at module scope and tracks screens from the tree', () => {
    render(<RootLayout />);

    // Module scope: fired on import, before anything rendered.
    expect(initializeFeatureFlags).toHaveBeenCalled();
    expect(useScreenTracking).toHaveBeenCalled();
  });

  it('hides the splash only after the first root layout', () => {
    render(<RootLayout />);
    const stack = screen.getByTestId('stack');
    const rootView = stack.parent;

    fireEvent(rootView, 'layout');
    fireEvent(rootView, 'layout');

    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it('supports both dark and non-dark navigation themes', () => {
    jest.mocked(useThemeConfig).mockReturnValueOnce({ dark: false } as never);

    render(<RootLayout />);

    expect(screen.getByTestId('stack')).toBeOnTheScreen();
  });
});
