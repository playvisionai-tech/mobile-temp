# crash-reporting — current behavior

## What this feature does
The app's only wrapper around `@react-native-firebase/crashlytics`. It exposes
four functions — record a handled error as a non-fatal, identify the user,
drop a breadcrumb, and toggle collection — and nothing else. Every one of them
is a silent no-op when the native module is not there, so callers can report
telemetry without branching on the environment and without a `try`/`catch` of
their own. `@react-native-firebase/crashlytics` is imported here and nowhere
else in `src/`.

## Behavior
- `recordError(error, context?)` reports a **non-fatal**. A value that is not an
  `Error` is coerced: a string becomes its message, anything else is
  `JSON.stringify`d, and a value that cannot be serialized (circular, `undefined`)
  falls back to `String(value)`.
- `context` is written first, as Crashlytics **custom keys**, with every value
  stringified (`2` → `"2"`, `false` → `"false"`). An absent or empty context
  writes no keys. Custom keys in Crashlytics are **session-scoped, not
  per-error**: once set they stay attached to every later report from the same
  process until a call overwrites the same key.
- `setCrashUser(userId)` sets the Crashlytics user identifier. It must be an
  opaque internal id. A value that looks like PII — it contains `@`, contains
  whitespace, or reads as an E.164 phone number — is **dropped**, and in
  `__DEV__` a `console.warn` says so. `null` clears the identifier (the
  sign-out path); it is sent as the empty string, which is how Crashlytics
  unsets it.
- `logCrashBreadcrumb(message)` appends to the Crashlytics log that ships with
  the next report.
- `setCrashReportingEnabled(enabled)` toggles collection and resolves when the
  native call settles. It resolves — never rejects — when the module is absent
  or the native call fails.
- **Nothing throws into the caller.** A missing native module, a throwing native
  call, and a rejected native promise are all swallowed; returned promises are
  given a `.catch` so a failure cannot surface as an unhandled rejection.
- The native module is resolved on **every** call and the result is not cached.
  A call made before the default Firebase app is initialized no-ops, and the
  next call after initialization works.
- `setCrashUser` hands `run` an async callback. `run` swallows both a
  synchronous throw and a rejected promise, so crash reporting cannot fail into
  the code path it is observing.

## Entry points
- `recordError`, `setCrashUser`, `logCrashBreadcrumb`,
  `setCrashReportingEnabled` from `@/lib/crash-reporting`.
- Nothing mounts or configures this module. There is no provider; the native SDK
  starts itself from the Firebase config in the build.

## Platform differences
- None in this module. iOS and Android divergence is handled inside the Firebase
  SDK.

## Verifying delivery
- Non-fatals (`recordError`) do arrive from a dev-client build.
- **A FATAL crash cannot be verified in a dev-client build.** Expo Dev Client
  installs its own error overlay and intercepts the crash before Crashlytics
  sees it, so fatal delivery must be checked in a **preview or release** build.
  Crashlytics also only uploads a fatal report on the *next* launch, so relaunch
  the app after crashing it.

## Out of scope
- Fatal reporting is not triggered from here. There is no wrapper around
  `crash()`; the SDK's automatic handlers own fatals.
- Unsent-report management — `checkForUnsentReports`, `sendUnsentReports`,
  `deleteUnsentReports`, `didCrashOnPreviousExecution` — is not exposed.
- Persisting the `setCrashReportingEnabled` choice. The module forwards the
  toggle; whoever owns the user-facing setting owns storing it.
- Redacting PII from error messages, breadcrumbs or context values. Only the
  user identifier is guarded.
