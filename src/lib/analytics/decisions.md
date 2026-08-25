# analytics — decisions

## 2026-08-25 — Screens are logged from the router, not by the native SDK
**Chose:** `google_analytics_automatic_screen_reporting_enabled: false` in the
root `firebase.json`, with `useScreenTracking()` logging `screen_view` from
`usePathname()`
**Over:** Leaving the native automatic screen reporting on, alone or alongside
the hook
**Why:** Automatic reporting names a screen after the native view controller /
activity it sees. A React Native app is a *single* one for its whole lifetime, so
every logical screen in the app would report under one name and the screen
report would say nothing. The navigation state that identifies the real screen
exists only in JavaScript, so the router is the only place that can name it.
Leaving both on would also double-count: a real `screen_view` from the hook plus
a meaningless one from the SDK.
**Trade-off:** Screen tracking is now app code that can be forgotten. If nobody
mounts `useScreenTracking()` in the root layout, screen reporting is silently
empty — with automatic reporting there would at least have been *some* data. It
also means screen names are route paths rather than class names, so a route
rename shows up as a new screen in historical reports.

## 2026-08-25 — A closed event registry rather than free-form event names
**Chose:** `ANALYTICS_EVENTS` in `events.ts` as the single declaration of every
event and its parameters, with `trackEvent` typed against it and validating
against it again at runtime
**Over:** `trackEvent(name: string, params?: Record<string, unknown>)` and a
convention documented in the spec
**Why:** Analytics degrades by drift, not by breakage: `post_open`,
`post_opened` and `postOpened` all "work", and the dashboard is quietly useless
six months later. Firebase also caps a project at 500 distinct event names, and
a typo permanently spends one. Declaring the events in one file makes the set
reviewable, makes a rename a compile error at every call site, and gives the
runtime enough information to reject what the compiler could not see.
**Trade-off:** Every new event is a change to a shared file — a small
coordination cost, and a temptation to reach for a generic `custom_event` row to
avoid it. Deriving both the types and the validation from one `as const` object
also costs some conditional-type machinery that is harder to read than a plain
interface.

## 2026-08-25 — Parameter kinds are declared, and unknown or ill-typed parameters are dropped
**Chose:** Each parameter declares a kind — `'string'`, `'number'`, `'boolean'`,
or a closed set of literals — and `trackEvent` strips anything undeclared or
mismatched, keeping the event
**Over:** Trusting the TypeScript types alone, or dropping the whole event when a
parameter is wrong
**Why:** The types stop at the compiler: a value read from an API response, a
call site in an untyped file, or an `as any` all reach the SDK unchecked, and
what leaks that way is exactly the free text and PII this module must keep out.
Dropping the offending parameter rather than the event preserves the count that
funnels and retention are built on — losing the event would corrupt the metric
in order to protect a dimension.
**Trade-off:** A dropped parameter is invisible in production; a call site that
sends a mistyped value sees a healthy-looking event with a missing dimension, and
only the `__DEV__` warning stands between that and a silently wrong report.

## 2026-08-25 — Strings must be machine tokens; PII shape is refused
**Chose:** A `'string'` parameter is dropped unless it is 1–100 characters with
no whitespace, no `@`, and not an E.164 phone number; `setAnalyticsUser` drops
an id of the same shape and warns in `__DEV__`
**Over:** Documenting the PII rule and trusting call sites, or throwing on a bad
value
**Why:** The forbidden values have recognizable shapes, and the cheapest useful
signal is whitespace: ids, slugs, route templates and enum members do not have
spaces in them, and free-text user input almost always does. A comment in a spec
does not survive a hurried call site, so the rule is code. It does not throw,
because a telemetry call must not be able to break the sign-in flow that made it.
**Trade-off:** The guard is a heuristic on shape, not on meaning. PII in a form
it does not recognize — a username, a postcode, a base64 blob under 100
characters — still gets through, and a legitimate value that happens to contain a
space is silently discarded. It also rules out ever sending a deliberately
human-readable label as a parameter.

## 2026-08-25 — The PII guard is duplicated rather than shared with crash-reporting
**Chose:** A local `looksLikePii` in this module, identical in intent to the one
in `src/lib/crash-reporting/`
**Over:** Extracting a shared helper into `src/lib/` for both to import
**Why:** The two modules answer to different vendors and different retention
rules, and their guards are already diverging — this one also rejects free text
in event parameters, which has no meaning for a crash report. Coupling them would
mean every future tightening for one had to be argued for both. The duplicated
code is three lines of regular expression.
**Trade-off:** Two copies to update if the definition of "looks like PII" is
genuinely improved, and nothing makes them stay in step; a fix applied to one is
easy to forget in the other.

## 2026-08-25 — Numeric route segments collapse to `[id]` in the screen name
**Chose:** `toScreenName` rewrites `/feed/12` to `/feed/[id]` before logging
**Over:** Logging the resolved pathname as the screen name
**Why:** Firebase treats each distinct `screen_name` as its own row; a detail
route with a live id would create one screen per record, blowing past the useful
cardinality of the screen report and burying the screens that matter. The route
*template* is what an analyst is actually asking about.
**Trade-off:** The specific record a user was looking at is no longer in the
screen report — a funnel that legitimately needs it must send it as a declared
event parameter instead. And the rule is shape-based: a non-numeric slug segment
(`/user/ada`) is not collapsed and would still explode the cardinality.

## 2026-08-25 — Every call swallows its own failure, and the native module is resolved per call
**Chose:** A `run` helper that catches synchronous throws and attaches a `.catch`
to any promise the native call returns; `loadApi()` runs its `require` on every
call; `setAnalyticsEnabled` resolves rather than rejects
**Over:** Letting errors propagate, and resolving the module once at module scope
**Why:** These functions are called from screens, effects and sign-out paths. An
observer that can fail the thing it observes is worse than no observer, and
swallowing means no call site needs a guard for Jest or for a build without the
Firebase config. Resolving per call matters for the same reason it does in
`crash-reporting`: a static import would evaluate the native module before the
default Firebase app is necessarily initialized, and a cached miss would then
disable analytics for the whole process.
**Trade-off:** A misconfigured integration is invisible — events silently go
nowhere and the app looks healthy. And a `require` on every call is cheap, not
free, so module availability is no longer a single observable fact.

## 2026-08-25 — Only the modular API is used
**Chose:** `getAnalytics()` / `logEvent(analytics, …)` from the modular surface,
with a locally declared `AnalyticsApi` type for the slice we call
**Over:** The namespaced `firebase.analytics().logEvent(…)` form, or importing
the package's own overloaded signatures
**Why:** The namespaced API is deprecated from v22 and logs a warning on every
call. The package's `logEvent` is also a wall of per-event overloads for
Google's recommended events; our registry is the app's own contract, so the
wrapper types itself against the one generic form underneath them.
**Trade-off:** Each call threads an instance through, and the local
`AnalyticsApi` type is a hand-maintained copy of five signatures that will not
fail loudly if the package changes them — only at the next type-check of a call
we happen to make.
