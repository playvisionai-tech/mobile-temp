import type { Crashlytics } from '@react-native-firebase/crashlytics';

/**
 * The slice of the Crashlytics modular API this wrapper uses. Declaring it
 * here rather than deriving it from the package keeps the surface we depend on
 * visible in one place, and lets `loadApi` type its `require` result.
 */
type CrashlyticsApi = {
  getCrashlytics: () => Crashlytics;
  log: (crashlytics: Crashlytics, message: string) => void;
  recordError: (crashlytics: Crashlytics, error: Error, jsErrorName?: string) => void;
  setUserId: (crashlytics: Crashlytics, userId: string) => Promise<null>;
  setAttributes: (crashlytics: Crashlytics, attributes: Record<string, string>) => Promise<null>;
  setCrashlyticsCollectionEnabled: (crashlytics: Crashlytics, enabled: boolean) => Promise<null>;
};

/** Values a caller may attach to a report. Everything is stringified for Crashlytics. */
export type CrashContext = Record<string, string | number | boolean>;

/**
 * Resolve the native module, or `null` when it is not there — Jest, a build
 * without the Firebase config, or any point before the default app has been
 * initialized. Deliberately not memoized: a failure here is often "too early",
 * not "never", and caching the miss would silence reporting for the rest of the
 * process.
 */
function loadApi(): CrashlyticsApi | null {
  try {
    const api = require('@react-native-firebase/crashlytics') as CrashlyticsApi | undefined;
    return typeof api?.getCrashlytics === 'function' ? api : null;
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
function run(action: (api: CrashlyticsApi, crashlytics: Crashlytics) => unknown): void {
  try {
    const api = loadApi();
    if (api === null) {
      return;
    }
    const result = action(api, api.getCrashlytics());
    if (result instanceof Promise) {
      result.catch(() => {});
    }
  }
  catch {
    // Reporting failed. There is nowhere left to report that to.
  }
}

/** Anything that is not already an `Error` becomes one, keeping something readable as the message. */
function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value) ?? String(value));
  }
  catch {
    return new Error(String(value));
  }
}

function toAttributes(context: CrashContext): Record<string, string> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * Reject identifiers that are obviously a person rather than a record. Catches
 * the mistakes that actually happen — passing an email, a display name, or a
 * phone number where an internal id belongs. It is a backstop, not a validator:
 * an opaque id that happens to be a real person's handle still gets through.
 */
function looksLikePii(userId: string): boolean {
  return userId.includes('@') || /\s/.test(userId) || /^\+\d[\d\s()-]{6,}$/.test(userId);
}

/**
 * Report a handled error as a Crashlytics non-fatal. `context` is attached as
 * custom keys, which are session-scoped in Crashlytics: they stay attached to
 * every later report from this session until overwritten.
 */
export function recordError(error: unknown, context?: CrashContext): void {
  run((api, crashlytics) => {
    if (context !== undefined && Object.keys(context).length > 0) {
      api.setAttributes(crashlytics, toAttributes(context)).catch(() => {});
    }
    api.recordError(crashlytics, toError(error));
  });
}

/**
 * Associate later reports with an opaque internal user id — never an email,
 * name, phone number or token. Pass `null` on sign-out to clear it.
 */
export function setCrashUser(userId: string | null): void {
  if (typeof userId === 'string' && looksLikePii(userId)) {
    if (__DEV__) {
      console.warn('[crash-reporting] setCrashUser ignored a value that looks like PII. Pass an opaque internal id.');
    }
    return;
  }

  run(async (api, crashlytics) => api.setUserId(crashlytics, userId ?? ''));
}

/** Add a breadcrumb to the log that ships with the next report. */
export function logCrashBreadcrumb(message: string): void {
  run((api, crashlytics) => api.log(crashlytics, message));
}

/** Turn collection on or off. Resolves even when the native module is absent. */
export async function setCrashReportingEnabled(enabled: boolean): Promise<void> {
  try {
    const api = loadApi();
    if (api === null) {
      return;
    }
    await api.setCrashlyticsCollectionEnabled(api.getCrashlytics(), enabled);
  }
  catch {
    // Same contract as the rest of the module: never throw into the caller.
  }
}
