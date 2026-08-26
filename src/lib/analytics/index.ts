import type { Analytics } from '@react-native-firebase/analytics';
import type {
  AnalyticsEventName,
  AnalyticsParams,
  AnalyticsParamsArg,
  AnalyticsParamValue,
  EventSchema,
  ParamKind,
} from './events';

import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { ANALYTICS_EVENTS } from './events';

export * from './events';

/**
 * The slice of the Analytics modular API this wrapper uses. Declaring it here
 * rather than deriving it from the package keeps the surface we depend on
 * visible in one place, and lets `loadApi` type its `require` result. The
 * package's own `logEvent` is a wall of per-event overloads; ours is the one
 * generic form underneath them.
 */
type AnalyticsApi = {
  getAnalytics: () => Analytics;
  logEvent: (analytics: Analytics, name: string, params?: AnalyticsParams) => void;
  logScreenView: (
    analytics: Analytics,
    params: { screen_name?: string; screen_class?: string },
  ) => Promise<void>;
  setUserId: (analytics: Analytics, id: string | null) => Promise<void>;
  setAnalyticsCollectionEnabled: (analytics: Analytics, enabled: boolean) => Promise<void>;
};

/** Firebase truncates a string parameter value, and a screen name, at 100 characters. */
const MAX_STRING_LENGTH = 100;

/**
 * Resolve the native module, or `null` when it is not there — Jest, a build
 * without the Firebase config, or any point before the default app has been
 * initialized. Deliberately not memoized: a failure here is often "too early",
 * not "never", and caching the miss would silence analytics for the rest of the
 * process.
 */
function loadApi(): AnalyticsApi | null {
  try {
    const api = require('@react-native-firebase/analytics') as AnalyticsApi | undefined;
    return typeof api?.getAnalytics === 'function' ? api : null;
  }
  catch {
    return null;
  }
}

/**
 * Run an action against the live instance, swallowing everything. Telemetry
 * must never throw into the code path it is observing, and it must not leave an
 * unhandled rejection behind either, so a returned promise is caught too.
 */
function run(action: (api: AnalyticsApi, analytics: Analytics) => unknown): void {
  try {
    const api = loadApi();
    if (api === null) {
      return;
    }
    const result = action(api, api.getAnalytics());
    if (result instanceof Promise) {
      result.catch(() => {});
    }
  }
  catch {
    // Reporting failed. Nothing the caller can do about it, and nothing it should know.
  }
}

function warn(message: string): void {
  if (__DEV__) {
    console.warn(`[analytics] ${message}`);
  }
}

/**
 * Reject strings that are obviously a person, or free text, rather than a
 * machine value. Analytics parameters are meant to be dimensions — ids, slugs,
 * enum members, route templates — so anything with whitespace is treated as
 * prose and refused along with emails and phone numbers. A backstop, not a
 * validator: an opaque token that happens to be someone's handle still passes.
 */
function isMachineToken(value: string): boolean {
  return value.length > 0
    && value.length <= MAX_STRING_LENGTH
    && !/\s/.test(value)
    && !value.includes('@')
    && !/^\+\d[\d()-]{6,}$/.test(value);
}

/** The same shape test applied to a user identifier, where whitespace means a display name. */
function looksLikePii(userId: string): boolean {
  return userId.includes('@') || /\s/.test(userId) || /^\+\d[\d\s()-]{6,}$/.test(userId);
}

/** Check one value against its declared kind. Returns `null` when it does not belong. */
function validateParam(kind: ParamKind, value: unknown): AnalyticsParamValue | null {
  if (typeof kind !== 'string') {
    return typeof value === 'string' && kind.includes(value) ? value : null;
  }
  if (kind === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (kind === 'boolean') {
    return typeof value === 'boolean' ? value : null;
  }
  return typeof value === 'string' && isMachineToken(value) ? value : null;
}

/**
 * Reduce a caller's object to exactly what the registry declares for the event.
 * A parameter that is undeclared, missing, or of the wrong kind is dropped —
 * the event itself still goes out, because a partial event is more useful than
 * a hole in the funnel.
 */
function sanitizeParams(schema: EventSchema, params: Record<string, unknown>): AnalyticsParams {
  const clean: AnalyticsParams = {};

  for (const [key, value] of Object.entries(params)) {
    const kind = schema[key];
    if (kind === undefined) {
      warn(`dropped undeclared parameter "${key}".`);
      continue;
    }
    const validated = validateParam(kind, value);
    if (validated === null) {
      warn(`dropped parameter "${key}": it does not match its declared kind.`);
      continue;
    }
    clean[key] = validated;
  }

  return clean;
}

/**
 * Log a registry event. The name and its parameters are checked by the compiler
 * against `ANALYTICS_EVENTS`, and again at runtime so a JavaScript caller — or
 * a value that only exists at runtime — cannot widen the surface.
 */
export function trackEvent<TName extends AnalyticsEventName>(
  name: TName,
  ...args: AnalyticsParamsArg<TName>
): void {
  const schema = (ANALYTICS_EVENTS as Record<string, EventSchema | undefined>)[name];
  if (schema === undefined) {
    warn(`dropped unknown event "${String(name)}". Declare it in events.ts first.`);
    return;
  }

  const params = sanitizeParams(schema, (args[0] ?? {}) as Record<string, unknown>);

  run((api, analytics) => api.logEvent(analytics, name, params));
}

/**
 * Log a screen view. `screenClass` defaults to the screen name: a React Native
 * app is a single native view controller, so leaving it to the SDK would file
 * every screen under the same class.
 */
export function trackScreen(screenName: string, screenClass?: string): void {
  const name = screenName.trim().slice(0, MAX_STRING_LENGTH);
  if (name.length === 0) {
    return;
  }

  run(async (api, analytics) => api.logScreenView(analytics, {
    screen_name: name,
    screen_class: (screenClass ?? name).trim().slice(0, MAX_STRING_LENGTH) || name,
  }));
}

/**
 * Associate later events with an opaque internal user id — never an email,
 * name, phone number or token. Pass `null` on sign-out to clear it.
 */
export function setAnalyticsUser(userId: string | null): void {
  if (typeof userId === 'string' && looksLikePii(userId)) {
    warn('setAnalyticsUser ignored a value that looks like PII. Pass an opaque internal id.');
    return;
  }

  run(async (api, analytics) => api.setUserId(analytics, userId));
}

/** Turn collection on or off. Resolves even when the native module is absent. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  try {
    const api = loadApi();
    if (api === null) {
      return;
    }
    await api.setAnalyticsCollectionEnabled(api.getAnalytics(), enabled);
  }
  catch {
    // Same contract as the rest of the module: never throw into the caller.
  }
}

/**
 * Collapse the volatile parts of a router path into a stable screen name, so a
 * report groups by screen rather than by row: `/feed/12` becomes `/feed/[id]`.
 */
export function toScreenName(pathname: string): string {
  return pathname
    .split('/')
    .map(segment => (/^\d+$/.test(segment) ? '[id]' : segment))
    .join('/');
}

/**
 * Log a screen view on every Expo Router path change. Export only — the root
 * layout owns where it is mounted.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }
    trackScreen(toScreenName(pathname));
  }, [pathname]);
}
