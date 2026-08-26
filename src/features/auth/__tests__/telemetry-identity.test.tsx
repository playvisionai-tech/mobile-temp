import { useAuth } from '@clerk/expo';
import * as React from 'react';

import { setAnalyticsUser } from '@/lib/analytics';
import { setCrashUser } from '@/lib/crash-reporting';
import { cleanup, render } from '@/lib/test-utils';

import { TelemetryIdentity } from '../telemetry-identity';

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  setAnalyticsUser: jest.fn(),
}));

jest.mock('@/lib/crash-reporting', () => ({
  setCrashUser: jest.fn(),
}));

function arrangeSession({
  loaded = true,
  signedIn = true,
  userId = 'user_2abcDEF',
}: { loaded?: boolean; signedIn?: boolean; userId?: string | null } = {}) {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: loaded,
    isSignedIn: loaded ? signedIn : undefined,
    userId: loaded ? userId : undefined,
  } as never);
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('telemetry identity', () => {
  it('identifies a signed-in user to both telemetry wrappers', () => {
    arrangeSession({ userId: 'user_2abcDEF' });

    render(<TelemetryIdentity />);

    expect(setAnalyticsUser).toHaveBeenCalledWith('user_2abcDEF');
    expect(setCrashUser).toHaveBeenCalledWith('user_2abcDEF');
  });

  it('renders nothing of its own', () => {
    arrangeSession();

    const { toJSON } = render(<TelemetryIdentity />);

    expect(toJSON()).toBeNull();
  });

  it('waits for Clerk before touching the identity', () => {
    arrangeSession({ loaded: false });

    render(<TelemetryIdentity />);

    expect(setAnalyticsUser).not.toHaveBeenCalled();
    expect(setCrashUser).not.toHaveBeenCalled();
  });

  it('identifies a session Clerk restored from its token cache', () => {
    // Cold start: the token cache resolves after the first render, so no sign-in
    // ever happens. The id must still reach telemetry.
    arrangeSession({ loaded: false });
    const { rerender } = render(<TelemetryIdentity />);
    expect(setAnalyticsUser).not.toHaveBeenCalled();

    arrangeSession({ userId: 'user_restored' });
    rerender(<TelemetryIdentity />);

    expect(setAnalyticsUser).toHaveBeenCalledWith('user_restored');
    expect(setCrashUser).toHaveBeenCalledWith('user_restored');
  });

  it('clears the identity when the session goes away', () => {
    // A 401 in the API client signs the user out without any UI involvement.
    arrangeSession({ userId: 'user_2abcDEF' });
    const { rerender } = render(<TelemetryIdentity />);

    arrangeSession({ signedIn: false, userId: null });
    rerender(<TelemetryIdentity />);

    expect(setAnalyticsUser).toHaveBeenLastCalledWith(null);
    expect(setCrashUser).toHaveBeenLastCalledWith(null);
  });

  it('does not re-identify while the session is unchanged', () => {
    arrangeSession({ userId: 'user_2abcDEF' });
    const { rerender } = render(<TelemetryIdentity />);

    rerender(<TelemetryIdentity />);
    rerender(<TelemetryIdentity />);

    expect(setAnalyticsUser).toHaveBeenCalledTimes(1);
    expect(setCrashUser).toHaveBeenCalledTimes(1);
  });

  it('sends only the opaque id Clerk provides', () => {
    arrangeSession({ userId: 'user_2abcDEF' });

    render(<TelemetryIdentity />);

    for (const call of jest.mocked(setAnalyticsUser).mock.calls) {
      expect(call).toEqual(['user_2abcDEF']);
    }
    for (const call of jest.mocked(setCrashUser).mock.calls) {
      expect(call).toEqual(['user_2abcDEF']);
    }
  });
});
