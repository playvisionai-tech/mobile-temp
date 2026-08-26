import { useAuth } from '@clerk/expo';
import * as React from 'react';

import { setAnalyticsUser } from '@/lib/analytics';
import { setCrashUser } from '@/lib/crash-reporting';

/**
 * Mirrors Clerk's session into the telemetry wrappers so a crash report or an
 * analytics event can be tied back to the account that produced it. Renders
 * nothing; it is mounted once, inside `ClerkProvider`, by `src/app/_layout.tsx`.
 *
 * Clerk's auth state is the trigger, not the login screen's success path: a
 * session also appears when Clerk restores it from the token cache on a cold
 * start, and disappears when the API client signs the user out on a 401.
 * Neither of those goes through the login button.
 *
 * Only Clerk's opaque `userId` is ever sent. An email, a name or anything else
 * a human could read is PII — see the PII rule in `src/lib/analytics/spec.md` —
 * and both wrappers drop such a value rather than report it.
 */
export function TelemetryIdentity(): null {
  const auth = useAuth();
  // `undefined` while Clerk restores the session from the token cache: neither
  // an id to set nor a sign-out to clear, so the effect below does nothing.
  // Once loaded it is the opaque id when signed in, and `null` when signed out.
  const sessionUserId = auth.isLoaded ? auth.userId : undefined;

  React.useEffect(() => {
    if (sessionUserId === undefined) {
      return;
    }

    setAnalyticsUser(sessionUserId);
    setCrashUser(sessionUserId);
  }, [sessionUserId]);

  return null;
}
