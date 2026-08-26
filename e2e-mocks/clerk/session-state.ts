/**
 * The one piece of mutable state behind the fake Clerk.
 *
 * Deliberately a module-level singleton rather than a store library: the mock
 * must not add a dependency, and Metro gives every importer the same module
 * instance, so `useAuth()` in the tab guard and `getClerkInstance()` in the
 * axios interceptor observe the same session without anything wiring them
 * together.
 */

/** Mirrors the subset of Clerk's `SignInStatus` this mock ever reaches. */
export type MockSignInStatus = 'needs_first_factor' | 'complete';

export type MockSessionState = {
  isSignedIn: boolean;
  signInStatus: MockSignInStatus;
};

/**
 * Signed in from the first frame. The point of the mock is to make the
 * authenticated half of the app reachable on a device, so the default state is
 * the one that gets you there; `signOut()` is what exercises the other branch.
 */
const state: MockSessionState = {
  isSignedIn: true,
  signInStatus: 'needs_first_factor',
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/** `useSyncExternalStore` subscribe. Returns its own unsubscribe. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getIsSignedIn() {
  return state.isSignedIn;
}

export function getSignInStatus() {
  return state.signInStatus;
}

/**
 * Activate a session. Called by `signIn.finalize()` — see the note there about
 * why this runs *before* the navigate callback rather than after it.
 */
export function signInSession() {
  if (state.isSignedIn && state.signInStatus === 'complete') {
    return;
  }
  state.isSignedIn = true;
  state.signInStatus = 'complete';
  emit();
}

/** Move the sign-in attempt to the point where `finalize()` is legal. */
export function completeSignInAttempt() {
  if (state.signInStatus === 'complete') {
    return;
  }
  state.signInStatus = 'complete';
  emit();
}

/**
 * Drop the session. The sign-in status resets too, so the sign-out → /login →
 * sign-in round trip can be driven repeatedly in one app session.
 */
export function signOutSession() {
  if (!state.isSignedIn && state.signInStatus === 'needs_first_factor') {
    return;
  }
  state.isSignedIn = false;
  state.signInStatus = 'needs_first_factor';
  emit();
}

export const MOCK_USER_ID = 'user_mock_1';
export const MOCK_SESSION_ID = 'sess_mock_1';
export const MOCK_JWT = 'mock-jwt-token';
