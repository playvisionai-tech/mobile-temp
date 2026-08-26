# Auth — current behavior

## What this feature does
Email/password sign-in backed by Clerk. Clerk owns session state end to end:
there is no local auth store. Once a session exists, Clerk's token cache
persists it across app restarts and `src/lib/api/client.tsx` attaches its JWT
to outgoing API requests. The feature also owns the telemetry identity — the
one place that tells analytics and crash reporting which account is signed in.

## Behavior
- The login screen renders `components/login-form.tsx`: a Name field plus Email
  and Password, built from `@/components/ui` primitives. Name carries no
  validation of its own, so leaving it blank submits cleanly.
- The form is validated on change by `@tanstack/react-form` against a Zod
  schema — email required and well-formed, password required and at least 6
  characters. The submit button shows a loading state for as long as submission
  is in flight — the form awaits the `onSubmit` it is given, so the spinner spans
  the screen's Clerk call rather than stopping the moment the handler is
  invoked.
- Submitting calls `signIn.password({ emailAddress, password })` from Clerk's
  `useSignIn()`. That call resolves with `{ error }` instead of throwing, so the
  screen branches on the returned `error` rather than using try/catch.
- On error, a flash error message is shown with the `login.failed` string. The
  user stays on the login screen; nothing else is reset.
- On success, when `signIn.status === 'complete'`, the screen calls
  `signIn.finalize({ navigate })`, which activates the session and does
  `router.replace(decorateUrl(ROUTES.home))`. Without `finalize()` the status
  reaches `complete` but no session is activated and the route guard bounces
  back.
- The destination comes from the `ROUTES` registry in `@/lib/navigation`; this
  screen writes no path literal. Clerk's `decorateUrl` appends its handshake
  params and is typed `(url: string) => string`, so the decorated result is
  cast back to `Href` at the `router.replace` call.
- The `(app)` route guard reads `isSignedIn` / `isLoaded` from Clerk's
  `useAuth()`. While `!isLoaded` it renders nothing, so an already-signed-in
  user is not redirected during Clerk's async session restore. When loaded and
  signed out, it redirects to `/login`. A first-time user is sent to
  `/onboarding` before either check.
- Sign-out lives in the settings feature; it calls Clerk's `signOut()`, and the
  route guard reacts to `isSignedIn` flipping to false.
- On a 401 API response the client interceptor calls `signOut()` once and
  rejects the promise. It does not retry the request and does not touch the
  React Query cache.

### Telemetry identity
- `telemetry-identity.tsx` exports `TelemetryIdentity`, a component that renders
  nothing and is mounted once by `src/app/_layout.tsx`, inside `ClerkProvider`.
- It reads `useAuth()` and mirrors the session into both telemetry wrappers:
  `setAnalyticsUser` from `@/lib/analytics` and `setCrashUser` from
  `@/lib/crash-reporting`, always with the same value.
- Signed in → Clerk's opaque `userId`. Signed out → `null`, which clears the id
  in both. So a crash report or an event carries the account that produced it,
  and a signed-out session carries nothing.
- While `isLoaded` is false it does nothing at all. Clerk reports `undefined`
  during session restore, which is neither an id to set nor a sign-out to
  clear; clearing there would wipe a returning user's id on every cold start.
- The trigger is Clerk's auth state, never the login screen's success path.
  A session also appears when the token cache restores one on a cold start, and
  disappears when the 401 interceptor signs the user out — neither goes through
  the login button, and both are covered because this watches Clerk itself.
- It re-identifies only when the id actually changes; a re-render at the same
  session sends nothing.
- **Only the opaque `userId` is ever passed.** No email, name, or any other
  value a human could read — see the PII rule in `src/lib/analytics/spec.md`.
  Both wrappers drop a value that looks like PII, so sending one would silently
  lose the identity rather than leak it, but the rule holds at this call site
  first.

## Entry points
- Route: `src/app/login.tsx` → `features/auth/login-screen.tsx`
- Route guard: `src/app/(app)/_layout.tsx` (Clerk `useAuth()`)
- Telemetry identity: `<TelemetryIdentity />` from
  `@/features/auth/telemetry-identity`, mounted in `src/app/_layout.tsx`
- Navigation: `ROUTES` from `@/lib/navigation`
- Session state: Clerk only — `ClerkProvider` in `src/app/_layout.tsx` is
  configured with `tokenCache` from `@clerk/expo/token-cache`. There is no
  Zustand auth store.

## Platform differences
- None in this feature's code. Session persistence goes through
  `expo-secure-store` (iOS Keychain / Android encrypted storage) via Clerk's
  token cache, which requires a dev-client build — the app does not run in
  Expo Go.

## Out of scope
- Sign-up, password reset, and email verification — not implemented here.
- User properties, traits or any telemetry attribute beyond the user id.
  `TelemetryIdentity` sets an id and nothing else.
- Social login (Google, Apple) — not implemented.
- Biometric unlock — deferred.
