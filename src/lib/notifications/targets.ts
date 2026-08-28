import type { Href } from 'expo-router';

import { ROUTES } from '@/lib/navigation';

/**
 * The `data` block of a push message, as it actually arrives. FCM sends data
 * values as strings, but the iOS bridge will hand back a parsed object for a
 * value that happened to be JSON, and nothing stops a sender putting anything
 * at all in here — so the type is deliberately as wide as reality.
 */
export type NotificationData = Record<string, unknown>;

/**
 * The key a sender puts the destination under. A payload without it is not a
 * deep link, which is the common case: most notifications just open the app.
 */
const ROUTE_KEY = 'route';

/**
 * A route parameter must be a short, opaque token. Slashes, dots and
 * whitespace are refused so a value cannot climb out of the segment it was
 * meant to fill.
 */
const SAFE_PARAM = /^[\w-]{1,64}$/;

/** Builds the `Href` for one named destination, or `null` if its params are wrong. */
type TargetResolver = (data: Record<string, string>) => Href | null;

/**
 * Every destination a notification may open, by name.
 *
 * This is an allow-list, not a lookup into `ROUTES`: a payload names a key
 * here, and the value decides what — if anything — that becomes. Two routes in
 * the registry are deliberately absent. `login` and `onboarding` are reached by
 * the `(app)` guard deciding the user belongs there, and a push that could send
 * a signed-in user to either would be a way to fake a sign-out.
 */
const TARGETS = {
  home: () => ROUTES.home,
  settings: () => ROUTES.settings,
  style: () => ROUTES.style,
  addPost: () => ROUTES.addPost,
  post: data => (isSafeParam(data.id) ? ROUTES.post(data.id) : null),
} as const satisfies Readonly<Record<string, TargetResolver>>;

/** The destination names a sender may use. Exported so the contract is greppable. */
export type NotificationTargetName = keyof typeof TARGETS;

function isSafeParam(value: string | undefined): value is string {
  return typeof value === 'string' && SAFE_PARAM.test(value);
}

/**
 * Keep only the entries whose value is genuinely a string. Anything else — a
 * parsed object, a number, `null` — is dropped rather than coerced, so a
 * resolver below only ever sees strings.
 */
function toStringRecord(data: NotificationData): Record<string, string> {
  const clean: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Turn a push payload into somewhere to navigate, or `null`.
 *
 * **The payload is untrusted input.** It arrives from the network, it is
 * attacker-shaped in the general case, and nothing about it is validated by the
 * time it reaches here. So the route is never built from it: the payload only
 * names a destination, and `TARGETS` decides whether that name means
 * anything. An unknown name, a missing name, a malformed parameter and a
 * payload that is not an object all answer `null`, which callers treat as
 * "just open the app".
 */
export function resolveNotificationTarget(data: NotificationData | undefined): Href | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const values = toStringRecord(data);
  const name = values[ROUTE_KEY];

  // `Object.hasOwn` and not `name in TARGETS`: the name is attacker-controlled,
  // and `constructor` or `toString` would otherwise resolve to something.
  if (name === undefined || !Object.hasOwn(TARGETS, name)) {
    return null;
  }

  return (TARGETS as Readonly<Record<string, TargetResolver>>)[name](values);
}
