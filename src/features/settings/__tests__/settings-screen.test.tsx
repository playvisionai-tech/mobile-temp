import { useAuth } from '@clerk/expo';
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';
import { useUniwind } from 'uniwind';

import { Github } from '@/components/ui/icons';
import { cleanup, render, screen, setup, waitFor } from '@/lib/test-utils';

import { SettingsScreen } from '../settings-screen';

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

jest.mock('uniwind', () => ({
  ...jest.requireActual('uniwind'),
  useUniwind: jest.fn(),
}));

const mockedUseAuth = useAuth as unknown as jest.Mock;
const mockedUseUniwind = useUniwind as jest.Mock;
const mockedShowMessage = showMessage as jest.Mock;
const signOut = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ signOut });
  mockedUseUniwind.mockReturnValue({ theme: 'light' });
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('settings screen', () => {
  it('shows light-theme settings and lets the user sign out', async () => {
    const { UNSAFE_getByType, user } = setup(<SettingsScreen />);

    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(UNSAFE_getByType(Github).props.color).toBe('#737373');

    await user.press(screen.getByText('Share'));
    await user.press(screen.getByText('Rate'));
    await user.press(screen.getByText('Support'));
    await user.press(screen.getByText('Privacy Policy'));
    await user.press(screen.getByText('Terms of Service'));
    await user.press(screen.getByText('Github'));
    await user.press(screen.getByText('Website'));
    await user.press(screen.getByText('Logout'));

    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(signOut).toHaveBeenCalled();
  });

  it('uses the dark-theme icon tint', () => {
    mockedUseUniwind.mockReturnValue({ theme: 'dark' });

    const { UNSAFE_getByType } = render(<SettingsScreen />);

    expect(UNSAFE_getByType(Github).props.color).toBe('#A3A3A3');
  });

  it('reports a sign-out failure without leaving the screen', async () => {
    const error = new Error('Clerk is unavailable');
    signOut.mockRejectedValue(error);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = setup(<SettingsScreen />);

    await user.press(screen.getByText('Logout'));

    await waitFor(() => {
      expect(mockedShowMessage).toHaveBeenCalledWith({
        duration: 4000,
        message: 'Could not sign out. Please try again.',
        type: 'danger',
      });
    });
    expect(screen.getByText('Settings')).toBeOnTheScreen();
  });
});
