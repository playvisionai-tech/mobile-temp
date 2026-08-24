# Clerk

**There is no Clerk CLI here and no auth commands.** Nothing runs from a
terminal — auth is exercised by running the app.

## Where it lives
- `@clerk/expo` + `@clerk/react` (dependencies).
- `ClerkProvider` with `tokenCache` from `@clerk/expo/token-cache`
  (`expo-secure-store`-backed) in `src/app/_layout.tsx`.
- Sign-in: `useSignIn()` in `src/features/auth/login-screen.tsx`.
- Route gating: `useAuth()` in `src/app/(app)/_layout.tsx`.
- Sign-out: `useAuth().signOut()` in
  `src/features/settings/settings-screen.tsx`.
- Request tokens: `getClerkInstance()` in `src/lib/api/client.tsx`.
- Keys: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (required),
  `EXPO_PUBLIC_CLERK_API_URL`, `EXPO_PUBLIC_CLERK_JWT_TEMPLATE` (optional) —
  validated in `env.ts`, sample values in `.env.example`.

`src/lib/auth/` is a pre-Clerk MMKV token store and is unused; see
`src/lib/auth/spec.md` before touching it.

## Read before changing auth
`src/features/auth/spec.md` and `decisions.md`, then `src/lib/auth/spec.md`.

## Exercising it
Sign in through the app on a simulator (`agents/rules/argent.md`, skill
`argent-test-ui-flow`), or via the Maestro flows in `.maestro/auth/`.
Unit tests mock `@clerk/expo` — see
`src/features/auth/__tests__/login-screen.test.tsx`.
