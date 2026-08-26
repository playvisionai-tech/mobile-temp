# analytics — current behavior

## What this feature does
The app's only wrapper around `@react-native-firebase/analytics`. It exposes a
closed registry of events, four functions to report against it, and a hook that
logs a screen view on every router navigation. The registry is the point of the
module: a call site cannot invent an event name or pass a parameter the event
does not declare, in TypeScript or at runtime. Every call is a silent no-op when
the native module is not there, so callers report telemetry without branching on
the environment and without a `try`/`catch` of their own.
`@react-native-firebase/analytics` is imported here and nowhere else in `src/`.

## The registry
- `src/lib/analytics/events.ts` declares every event the app may send, as
  `ANALYTICS_EVENTS`: event name → parameter name → parameter *kind*.
- A kind is `'string'`, `'number'`, `'boolean'`, or a closed set of string
  literals (`['email', 'oauth']`). A literal set is the preferred form.
- Both the TypeScript types and the runtime validation are derived from that one
  declaration, so they cannot drift apart. `AnalyticsEventName` is the union of
  declared names; `AnalyticsEventParams<Name>` is the parameter object of one
  event.
- Adding an event means adding a row. There is no escape hatch for an
  undeclared one.
- Events declared today: `login`, `sign_up`, `logout`, `onboarding_completed`,
  `feed_refreshed`, `post_opened`, `post_created`, `theme_changed`,
  `language_changed`, `request_failed`.

## The PII rule
**No emails, names, phone numbers, tokens or free-text user input ever go into
an event parameter, a user id, or a screen name.** Analytics data is retained by
a third party, is readable by anyone with console access, and is not covered by
the app's own deletion path.

The rule is enforced structurally first and by heuristic second:
- **Declare enums, not strings.** A parameter declared as a literal set can only
  ever hold one of those literals — free text fails to compile and is dropped at
  runtime. Declare `'string'` only for a machine value: an id, a slug, a route
  template, an error code.
- **Send shape, not content.** `post_created` carries `title_length` and
  `body_length`, never the title or the body.
- **String values must look like machine tokens.** A `'string'` parameter is
  dropped unless it is 1–100 characters with no whitespace, no `@`, and not an
  E.164 phone number. Whitespace is what separates a slug from prose, so a value
  with a space in it is treated as free text and refused.
- **User ids are opaque.** See `setAnalyticsUser` below.

The heuristics are a backstop, not a validator: an opaque id that happens to be
someone's handle still passes. The registry is the real guarantee.

## Behavior
- `trackEvent(name, params)` logs a registry event. The name and parameters are
  checked by the compiler, and again at runtime so a JavaScript caller or an
  `any` cannot widen the surface. An event that declares no parameters is called
  with the name alone: `trackEvent('logout')`.
- Runtime sanitizing **drops, never throws**: a parameter that is undeclared,
  missing, or of the wrong kind is removed and the event is still sent, because
  a partial event is more useful than a hole in the funnel. An event name that
  is not in the registry is dropped whole. Each drop logs a `console.warn` in
  `__DEV__` and is silent in production.
- `trackScreen(screenName, screenClass?)` logs a `screen_view` through the
  SDK's `logScreenView`. `screenClass` defaults to the screen name — a React
  Native app is one native view controller, so leaving the class to the SDK
  files every screen under the same name. Both values are trimmed and truncated
  to Firebase's 100-character limit; a blank name logs nothing.
- `setAnalyticsUser(userId)` sets the Analytics user id. It must be an opaque
  internal id. A value that looks like PII — it contains `@`, contains
  whitespace, or reads as an E.164 phone number — is **dropped**, with a
  `__DEV__` warning. `null` clears the id and is the sign-out path.
- `setAnalyticsEnabled(enabled)` toggles collection and resolves when the native
  call settles. It resolves — never rejects — when the module is absent or the
  native call fails.
- `useScreenTracking()` reads `usePathname()` from Expo Router and logs a screen
  view whenever the path changes. It logs nothing before the router reports a
  path, and nothing on a re-render at the same path.
- `toScreenName(pathname)` is what the hook logs: numeric path segments collapse
  to `[id]`, so `/feed/12` is reported as `/feed/[id]` and the report groups by
  screen rather than by row.
- **Nothing throws into the caller.** A missing native module, a throwing native
  call and a rejected native promise are all swallowed; returned promises are
  given a `.catch` so a failure cannot surface as an unhandled rejection.
- The native module is resolved on **every** call and the result is not cached.
  A call made before the default Firebase app is initialized no-ops, and the
  next call after initialization works.
- `trackScreen` and `setAnalyticsUser` hand `run` an async callback. `run`
  swallows both a synchronous throw and a rejected promise, so neither can
  surface at the call site or leave an unhandled rejection behind.

## Entry points
- `trackEvent`, `trackScreen`, `setAnalyticsUser`, `setAnalyticsEnabled`,
  `useScreenTracking`, `toScreenName`, and the registry types from
  `@/lib/analytics`.
- **This module mounts nothing.** `useScreenTracking` is exported for the root
  layout (`src/app/_layout.tsx`) to call; the module does not wire itself in.
- `setAnalyticsUser` is called from one place: `TelemetryIdentity` in
  `src/features/auth/`, which passes Clerk's opaque `userId` and `null` on
  sign-out. This module neither knows nor asks who the user is.

## Platform differences
- None in this module. iOS and Android divergence is handled inside the Firebase
  SDK.
- Automatic native screen reporting is **off**
  (`google_analytics_automatic_screen_reporting_enabled: false` in the root
  `firebase.json`) on both platforms. `useScreenTracking` is the only source of
  `screen_view`; see `decisions.md`.

## Out of scope
- Consent management. `setAnalyticsConsent`, ad-storage and analytics-storage
  consent modes are not exposed, and nothing here reads a consent banner.
- User properties (`setUserProperty` / `setUserProperties`), the app instance id,
  session timeout, and `resetAnalyticsData`.
- E-commerce helpers (`logPurchase`, `logAddToCart`, …). An e-commerce event
  would be declared in the registry like any other.
- Persisting the `setAnalyticsEnabled` choice. The module forwards the toggle;
  whoever owns the user-facing setting owns storing it.
- Redacting PII from a screen name. Route paths are ours; a route that put user
  text in the URL would defeat the guard.
- Debug-view / DebugView verification, and any assertion that events actually
  arrive in the Firebase console.
