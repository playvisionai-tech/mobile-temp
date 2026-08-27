# Auth — decisions

## 2026-08-20 — Migrated to Clerk for authentication
**Chose:** @clerk/expo
**Over:** Custom JWT + MMKV token storage (previous implementation)
**Why:** Clerk handles session management, MFA, device verification, and token refresh out of the box. Reduces custom auth code surface area.
**Trade-off:** Additional dependency; vendor lock-in for auth; requires Clerk account and publishable key.

## 2026-08-20 — Removed custom token storage
**Chose:** Rely on Clerk SDK for session persistence
**Over:** MMKV storage for access/refresh tokens
**Why:** Clerk manages secure token storage internally; avoids duplicating token logic.
**Trade-off:** Less control over storage mechanism; must trust Clerk's security model.

## 2026-08-21 — Clerk as the only source of session truth
**Chose:** Read session state directly from Clerk (`useAuth()`, `getClerkInstance()`) and delete `features/auth/use-auth-store.tsx`
**Over:** Keeping a Zustand `isSignedIn` store mirrored from Clerk callbacks
**Why:** The store held a copy of state Clerk already owns, which is the duplication CLAUDE.md forbids ("never the same data in both"). Two sources drift: a 401 sign-out from the API interceptor never reached the store, so the guard could still believe the user was signed in.
**Trade-off:** No synchronous, module-scope way to read "am I signed in" any more. Every consumer must be inside `ClerkProvider` and must handle the `isLoaded === false` window explicitly — the `(app)` guard now renders `null` during session restore instead of deciding immediately.

## 2026-08-21 — Future sign-in API (`signIn.password()` + `finalize()`)
**Chose:** `signIn.password({ emailAddress, password })` followed by `signIn.finalize({ navigate })`
**Over:** The legacy `signIn.create({ identifier, password })` + `setActive({ session })` flow
**Why:** The future API returns `{ error }` instead of throwing, so failures are ordinary values rather than control flow, and `finalize()` activates the session and navigates in one step — with `create()` alone the status reaches `complete` with no active session and the route guard bounces the user back to `/login`.
**Trade-off:** A newer, less widely documented API surface that is still evolving, and it is error-prone in a specific way: `try/catch` around `signIn.password()` silently catches nothing, so every call site must branch on the returned `error`. Pinning `@clerk/expo` matters more as a result.

## 2026-08-26 — Telemetry identity follows Clerk's auth state, from a mounted component
**Chose:** A `TelemetryIdentity` component in this slice that watches `useAuth()` and calls `setAnalyticsUser` / `setCrashUser` from an effect, mounted once under `ClerkProvider` in `src/app/_layout.tsx`
**Over:** (a) calling both setters in the login screen's success path and in the settings sign-out handler; (b) a hook called from the `(app)` route guard, which already reads `useAuth()`
**Why:** A session appears and disappears in three ways, and only one of them is a button press: Clerk restores a session from the token cache on cold start, and `src/lib/api/client.tsx` signs the user out on a 401. (a) covers neither, so a returning user's crashes stay anonymous and a 401 leaves the previous user's id attached to everything that follows. (b) is inside the guard's early returns — it renders `null` during session restore and a `<Redirect>` when signed out, so an effect there would not run in exactly the states that matter. Watching the state itself is the only form that has no gap.
**Trade-off:** Telemetry is now a mount in the root layout rather than a call in the code path that caused it, so nothing at the login screen shows that signing in identifies the user — the connection is only visible from this slice. It also spends a component and an effect on something that renders nothing, and it inherits Clerk's `isLoaded` window: for the first frames of a cold start the id is unset, so a crash during session restore is still anonymous.
