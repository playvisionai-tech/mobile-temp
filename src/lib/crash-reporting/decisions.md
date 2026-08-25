# crash-reporting — decisions

## 2026-08-25 — Handled errors are recorded as non-fatals, never rethrown as crashes
**Chose:** `recordError` reports through Crashlytics' non-fatal channel and
returns normally
**Over:** Letting a handled error propagate so the SDK's fatal handler picks it
up, or calling `crash()` for anything the app considers serious
**Why:** An error the app has a recovery path for is not a crash. Rethrowing to
get it into Crashlytics would trade a working screen for a dead one purely to
improve reporting, and it would inflate the crash-free-users metric that release
decisions are made on. Non-fatals are grouped, counted and alertable in the same
console, which is all the visibility a handled error needs.
**Trade-off:** Non-fatals are rate-limited by the SDK (a per-session cap) and are
less prominent in the console than crashes, so a high-volume handled error can be
sampled away and a serious one can be overlooked. Fatals also carry a full native
stack; a non-fatal carries the JS stack of the `Error` we hand over, so coercing
a non-`Error` value costs the original throw site.

## 2026-08-25 — The user identifier is an opaque internal id, enforced by a guard
**Chose:** `setCrashUser` takes an opaque id and silently drops values that look
like PII (contain `@` or whitespace, or read as an E.164 phone number), warning
in `__DEV__`
**Over:** Documenting the rule and trusting call sites, or throwing on a bad value
**Why:** Crash reports are retained by a third party, are readable by anyone with
console access, and are not covered by the app's own deletion path — an email or
name written there is a data-protection problem that no later code change undoes.
A comment in a spec does not survive a hurried call site, so the rule is code. It
does not throw, because a telemetry call must not be able to break the sign-in
flow that made it.
**Trade-off:** The guard is a heuristic on shape, not on meaning: it cannot tell
an opaque id from a username, so PII in a form it does not recognize still gets
through. And it fails silently in production — an id wrongly classified as PII
detaches every subsequent report from its user, with only the dev-time warning to
catch it.

## 2026-08-25 — Every call swallows its own failure
**Chose:** A `run` helper that catches synchronous throws and attaches a `.catch`
to any promise the native call returns; `setCrashReportingEnabled` resolves
rather than rejects on failure
**Over:** Letting errors propagate, or returning a success flag for callers to check
**Why:** These functions are called from `catch` blocks, sign-out paths and
settings toggles. An observer that can fail the thing it observes is worse than
no observer — a Crashlytics failure turning a handled error into an unhandled one
is the exact inversion this module exists to prevent. Swallowing also means no
call site needs a guard for Jest or for a build without the Firebase config.
**Trade-off:** A misconfigured integration is invisible: reports silently go
nowhere and the app looks healthy. There is no signal short of noticing that the
console is empty.

## 2026-08-25 — The native module is resolved per call, not memoized
**Chose:** `loadApi()` runs its `require` on every call
**Over:** Resolving once at module scope and caching the result (or the failure)
**Why:** A static top-level import would evaluate the native module during the
first import of this file, before the default Firebase app is necessarily
initialized, and a cached miss would then disable reporting for the whole
process — precisely for the early-startup errors that are most worth having.
Resolving per call means the module heals as soon as Firebase is up.
**Trade-off:** A `require` on every telemetry call rather than one. It hits
Metro's module cache and is cheap, but it is not free, and the module's
availability is no longer a single observable fact — two calls a millisecond
apart can legitimately behave differently.

## 2026-08-25 — Only the modular API is used
**Chose:** `getCrashlytics()` / `recordError(crashlytics, …)` from the modular surface
**Over:** The namespaced `firebase.crashlytics().recordError(…)` form
**Why:** The namespaced API is deprecated from v22 and logs a warning on every
call; the modular form is what the package will keep.
**Trade-off:** Each call threads an instance through, so the wrapper's internal
`CrashlyticsApi` type has to name every function's `crashlytics` first argument.
