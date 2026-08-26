/* eslint-disable react-refresh/only-export-components */
/**
 * Fake `@clerk/expo`, swapped in by metro.config.js when MOCK_AUTH=1.
 *
 * Exports exactly the five symbols this app imports — ClerkProvider, useAuth,
 * useSignIn, getClerkInstance (plus `tokenCache` from ./token-cache) — and
 * nothing else. See ./README.md for what this does and does not prove.
 */
import type { ReactNode } from 'react';
import * as React from 'react';

import {
  completeSignInAttempt,
  getIsSignedIn,
  getSignInStatus,
  MOCK_JWT,
  MOCK_SESSION_ID,
  MOCK_USER_ID,
  signInSession,
  signOutSession,
  subscribe,
} from './session-state';

/** Reactive read of the session flag. Re-renders every consumer on a change. */
function useIsSignedIn() {
  return React.useSyncExternalStore(subscribe, getIsSignedIn, getIsSignedIn);
}

/**
 * `publishableKey` and `tokenCache` are accepted and ignored — accepting them
 * is the whole point, since the real provider throws on the placeholder key
 * that ships in .env.
 */
export function ClerkProvider({ children }: {
  children: ReactNode;
  publishableKey?: string;
  tokenCache?: unknown;
}) {
  return <>{children}</>;
}

export function useAuth() {
  const isSignedIn = useIsSignedIn();

  return {
    // Always loaded: the real client resolves this asynchronously off a network
    // handshake that never completes with a fake key, which is exactly what
    // strands `(app)/_layout.tsx` on its `if (!isLoaded) return null` branch.
    isLoaded: true,
    isSignedIn,
    userId: isSignedIn ? MOCK_USER_ID : null,
    sessionId: isSignedIn ? MOCK_SESSION_ID : null,
    signOut: React.useCallback(async () => {
      signOutSession();
    }, []),
    getToken: React.useCallback(async () => (getIsSignedIn() ? MOCK_JWT : null), []),
  };
}

type PasswordParams = { emailAddress: string; password: string };
type NavigateArgs = { decorateUrl: (url: unknown) => unknown };
type FinalizeParams = { navigate?: (args: NavigateArgs) => unknown };
type MockError = { message: string } | null;

/**
 * A single stable object, so the `signIn` a screen captured in a `useCallback`
 * closure is the same one `password()` mutates. `login-screen.tsx` reads
 * `signIn.status` immediately after awaiting `signIn.password(...)`, off that
 * captured reference — a fresh object per render would still read the old
 * status and never reach `finalize()`.
 */
const signIn = {
  get status() {
    return getSignInStatus();
  },

  /**
   * The factor-specific call the login screen actually uses. Resolves with
   * `{ error }` instead of throwing, matching the future sign-in API.
   */
  async password({ emailAddress, password }: PasswordParams): Promise<{ error: MockError }> {
    if (!emailAddress || !password) {
      return { error: { message: 'Missing credentials' } };
    }
    completeSignInAttempt();
    return { error: null };
  },

  /** Advanced-use entry point. Nothing in this app calls it; kept for parity. */
  async create(_params: Partial<PasswordParams>): Promise<{ error: MockError }> {
    completeSignInAttempt();
    return { error: null };
  },

  /**
   * Activates the session, then hands the caller a `decorateUrl` to build its
   * destination with. Identity is correct here: decoration exists to smuggle a
   * cookie-refresh handshake through Safari ITP, which has no analogue offline.
   *
   * The session is set BEFORE `navigate` runs, the reverse of the real client.
   * The callback in `login-screen.tsx` is a `router.replace()` into `(app)`,
   * whose guard reads `isSignedIn` on the very next render — activating
   * afterwards would let the guard bounce the user straight back to /login.
   */
  async finalize(params?: FinalizeParams): Promise<{ error: MockError }> {
    signInSession();
    params?.navigate?.({ decorateUrl: url => url });
    return { error: null };
  },
};

export function useSignIn() {
  return {
    isLoaded: true,
    signIn,
    setActive: React.useCallback(async () => {
      signInSession();
    }, []),
  };
}

/**
 * `lib/api/client.tsx` calls this with an explicit `{ publishableKey }` and
 * reads `.session` on every request, so `session` is a getter: it must be null
 * while signed out or the interceptor would attach a token to anonymous calls.
 */
export function getClerkInstance(_options?: { publishableKey?: string }) {
  return {
    get session() {
      return getIsSignedIn()
        ? {
            id: MOCK_SESSION_ID,
            getToken: async (_options?: { template?: string }) => MOCK_JWT,
          }
        : null;
    },
    get user() {
      return getIsSignedIn() ? { id: MOCK_USER_ID } : null;
    },
    async signOut() {
      signOutSession();
    },
  };
}
