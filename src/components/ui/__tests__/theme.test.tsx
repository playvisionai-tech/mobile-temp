import { useIsFocused } from '@react-navigation/native';
import * as React from 'react';
import { Platform } from 'react-native';
import { useUniwind } from 'uniwind';

import { render, renderHook, screen } from '@/lib/test-utils';

import { FocusAwareStatusBar } from '../focus-aware-status-bar';
import { useThemeConfig } from '../use-theme-config';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: jest.fn(),
}));
jest.mock('uniwind', () => ({
  ...jest.requireActual('uniwind'),
  useUniwind: jest.fn(),
}));
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: (props: object) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'system-bars', ...props });
  },
}));

const mockUseIsFocused = jest.mocked(useIsFocused);
const mockUseUniwind = jest.mocked(useUniwind);
const originalOS = Platform.OS;

beforeEach(() => {
  Platform.OS = 'ios';
  mockUseIsFocused.mockReturnValue(true);
  mockUseUniwind.mockReturnValue({ theme: 'light' } as never);
});

afterAll(() => {
  Platform.OS = originalOS;
});

describe('focus-aware status bar', () => {
  it('uses dark system content for a focused light screen', () => {
    render(<FocusAwareStatusBar hidden />);

    expect(screen.getByTestId('system-bars')).toHaveProp('style', 'dark');
    expect(screen.getByTestId('system-bars')).toHaveProp('hidden', true);
  });

  it('uses light system content for a focused dark screen', () => {
    mockUseUniwind.mockReturnValue({ theme: 'dark' } as never);
    render(<FocusAwareStatusBar />);

    expect(screen.getByTestId('system-bars')).toHaveProp('style', 'light');
  });

  it('renders no system bars when its screen is not focused', () => {
    mockUseIsFocused.mockReturnValue(false);
    render(<FocusAwareStatusBar />);

    expect(screen.queryByTestId('system-bars')).not.toBeOnTheScreen();
  });

  it('renders nothing on web', () => {
    Platform.OS = 'web';
    render(<FocusAwareStatusBar />);

    expect(screen.queryByTestId('system-bars')).not.toBeOnTheScreen();
  });
});

describe('use theme config', () => {
  it('returns the light navigation palette', () => {
    const { result } = renderHook(useThemeConfig);

    expect(result.current).toMatchObject({
      dark: false,
      colors: { primary: '#FF8933', background: '#ffffff' },
    });
  });

  it('returns the dark navigation palette', () => {
    mockUseUniwind.mockReturnValue({ theme: 'dark' } as never);
    const { result } = renderHook(useThemeConfig);

    expect(result.current).toMatchObject({
      dark: true,
      colors: {
        primary: '#FFA766',
        background: '#121212',
        text: '#E5E5E5',
        border: '#7D7D7D',
        card: '#2E2E2E',
      },
    });
  });
});
