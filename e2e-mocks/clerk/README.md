# Clerk mock (device E2E only)

A fake `@clerk/expo` that Metro swaps in when `MOCK_AUTH=1`, so the
**authenticated half of the app** — the feed, the tab bar, settings — can be
driven on a real emulator without a real Clerk publishable key.

## Why this exists

`.env` ships `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here`.

- With that literal placeholder, `ClerkProvider` throws at render.
- With a *format-valid* fake key, the app mounts but Clerk never resolves
  `isLoaded`, because that resolution depends on a network handshake with a
  Clerk instance that does not exist. `src/app/(app)/_layout.tsx` then sits
  forever on its `if (!isLoaded) return null` branch and renders a blank
  screen.

Either way everything behind the auth guard is unreachable on device. This mock
returns `isLoaded: true` from the first frame and starts signed in.

## Running it

```bash
MOCK_AUTH=1 pnpm start
```

Then build/run the dev client as usual (`pnpm android`). Metro prints a
`⚠️  MOCK_AUTH=1` banner on startup; if you do not see it, the flag did not
reach the bundler and you are running the real Clerk.

With the flag **unset**, `metro.config.js` returns exactly the config it
returned before this mock existed. Normal dev and release paths are unchanged.

## What it fakes

Only the surface the app actually imports — verified against the five call
sites, not guessed:

| Export | Used by | Behavior |
| --- | --- | --- |
| `ClerkProvider` | `src/app/_layout.tsx` | Renders `children`; ignores `publishableKey` and `tokenCache` |
| `useAuth()` | `(app)/_layout.tsx`, `(app)/_layout.web.tsx`, `settings-screen.tsx` | `{ isLoaded: true, isSignedIn, userId, sessionId, signOut, getToken }` |
| `useSignIn()` | `features/auth/login-screen.tsx` | `{ isLoaded: true, signIn, setActive }` |
| `getClerkInstance()` | `src/lib/api/client.tsx` | `{ session, user, signOut }`; `session` is `null` while signed out |
| `tokenCache` | `src/app/_layout.tsx` | No-op `getToken` / `saveToken` / `clearToken` |

Session state is a module-level singleton in `session-state.ts`, published to
React through `useSyncExternalStore`. No store library, no dependency added.

### Flows you can actually drive

- **Starts signed in.** The tab bar and feed render immediately.
- **Sign out** (Settings → Logout) flips `useAuth().isSignedIn` to `false`; the
  guard redirects to `/login`.
- **Sign in** from that login screen: `signIn.password()` resolves
  `{ error: null }` and moves `signIn.status` to `'complete'`, then
  `signIn.finalize({ navigate })` activates the session and invokes the
  callback with an identity `decorateUrl`, landing you back in `(app)`. The
  round trip can be repeated as many times as you like.
- Blank email or password returns an `{ error }` instead, so the failure
  branch (`login.failed` toast) is reachable too.

Two deliberate divergences from the real client, both load-bearing:

1. `signIn` is a **single stable object** whose `status` is a getter.
   `login-screen.tsx` reads `signIn.status` off a reference captured in a
   `useCallback` closure, immediately after awaiting `signIn.password(...)`. A
   fresh object per render would still read the old status and never reach
   `finalize()`.
2. `finalize()` activates the session **before** calling `navigate`, the
   reverse of the real client's ordering. The callback is a `router.replace()`
   into `(app)`, whose guard reads `isSignedIn` on the very next render —
   activating afterwards would let the guard bounce the user back to `/login`.

## Production guard

`metro.config.js` **throws at config load** if `MOCK_AUTH` is set while
`NODE_ENV=production` or `EXPO_PUBLIC_APP_ENV=production`. It fails before
Metro reads a single module, so a bundle is never produced. A mocked auth
bypass that shipped would make every build trust an unauthenticated client;
this is a hard refusal, not a warning.

## What this does NOT prove

Anything green while `MOCK_AUTH=1` says nothing about real authentication.
In particular it does **not** exercise:

- **Real token attach.** `session.getToken()` returns the constant
  `'mock-jwt-token'`. The axios interceptor in `lib/api/client.tsx` runs and
  sets an `Authorization` header, but the JWT is not signed, not scoped, and
  ignores `EXPO_PUBLIC_CLERK_JWT_TEMPLATE`. A backend that validates the token
  will reject every request.
- **Real 401 sign-out.** The response interceptor's `getClerk().signOut()` path
  is only reachable if something genuinely returns 401. It is never driven by a
  real expired or revoked session.
- **Real session restore.** `tokenCache` is a no-op, so nothing is persisted to
  expo-secure-store. State lives in module memory and resets on every reload
  and cold start — the app is simply signed in again from scratch. The actual
  restore-from-cache path, and the `isLoaded` race the guard's comment warns
  about, are exactly what this mock removes.
- **Real credential validation, MFA, device verification, or session
  expiry.** Any non-empty email/password is accepted.

Those paths need a real publishable key against a real Clerk instance.

## Why not `__mocks__/`

The repo root already has `__mocks__/`, which Jest auto-applies as manual mocks
for `node_modules` packages. A Clerk mock placed there would be picked up by
the entire unit suite automatically and silently override the per-test
`jest.mock('@clerk/expo', ...)` calls in `login-screen.test.tsx`,
`settings-screen.test.tsx`, `client.test.tsx` and both `_layout.test.tsx`
files — changing what those tests assert without anyone editing them.

`e2e-mocks/` is loaded by nothing but the Metro resolver, and only behind an
explicit flag. Jest never sees it.
