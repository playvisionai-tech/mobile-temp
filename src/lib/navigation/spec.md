# navigation — current behavior

## What this module does
Names every route in the app. `ROUTES` is the one place a route path string is
written; call sites navigate by name — `router.push(ROUTES.settings)`,
`router.push(ROUTES.post(post.id))` — and never type a path themselves.

Its purpose is type-checking, not indirection. The map is checked against
`RouteRegistry` with `satisfies`, so a path that has no file in `src/app/`, or a
param the route does not declare, is a compile error **at this definition**.
Because `expo-router`'s generated `Href` type does not reject a bad path string
(see `decisions.md`), this file is the only place in the codebase where such a
mistake is caught at all.

## The registry
`src/lib/navigation/index.ts` exports:

| Key | Value | Route file |
|---|---|---|
| `home` | `'/'` | `src/app/(app)/index.tsx` |
| `login` | `'/login'` | `src/app/login.tsx` |
| `onboarding` | `'/onboarding'` | `src/app/onboarding.tsx` |
| `settings` | `'/settings'` | `src/app/(app)/settings.tsx` |
| `style` | `'/style'` | `src/app/(app)/style.tsx` |
| `addPost` | `'/feed/add-post'` | `src/app/feed/add-post.tsx` |
| `post(id)` | `{ pathname: '/feed/[id]', params: { id } }` | `src/app/feed/[id].tsx` |

- Static routes are plain strings; `post` is a function because `/feed/[id]`
  takes a param, and the object form is what carries params to the router.
- `post` accepts `string | number` — the same width the generated types give
  `id` — and passes it through unchanged. It does no encoding and no coercion.
- The map is `as const`, so each value keeps its literal type and cannot be
  reassigned.
- `/_sitemap` and the `[...messing]` catch-all are deliberately absent: neither
  is somewhere the app navigates to on purpose.

## What the type catches
`RouteRegistry` is `Readonly<Record<string, StaticRoute | HrefFactory>>`.

- `StaticRoute` is `Route` from `expo-router` — the pathnames of `Href`'s
  *object* members, which unlike its string members contain no `/${string}`
  wildcard — with dynamic patterns (`` `${string}[${string}]${string}` ``)
  excluded, since `/feed/[id]` is a template and not a destination.
- `HrefFactory` is `(...args: never[]) => Href`, so a function member is checked
  on its **return value**: pathname and params both, against the generated
  union.

Three things therefore fail to compile in this file:

- a path with no route — `home: '/nope'`;
- a param the route does not declare — `post: id => ({ pathname: '/feed/[id]',
  params: { wrong: id } })`, which is missing the required `id`;
- a dynamic pattern used as a static string — `post: '/feed/[id]'`.

`__tests__/navigation.test.ts` asserts all three with `@ts-expect-error`. Those
are live assertions: an unused `@ts-expect-error` is itself a compile error, so
if the registry ever stops catching one of them, `pnpm type-check` fails.

## This depends on generated types, and CI generates them
Everything above is only true when `.expo/types/router.d.ts` exists. That file
is generated and gitignored, and it is what declaration-merges the real route
union into `expo-router`. Without it `Href` falls back to its permissive default,
`Route` degrades to `string`, and `StaticRoute` excludes nothing.

`.github/workflows/type-check.yml` therefore regenerates it before running
`tsc`, so the guarantee holds in CI and not just on a machine that has run the
app. The three `@ts-expect-error` directives double as the check on that step:
if typegen ever stops working, they go unused and the build fails loudly rather
than passing while checking nothing.

## What this covers that `typedRoutes` alone does not
With the route types present, `tsc` already checks the **object** form of an
`Href` everywhere in the app — both its pathname and its params. What it does
not check is the **string** form: the generated union contains a `/${string}`
member, so `<Link href="/nope-not-a-route">` compiles anywhere. The two
mechanisms are complementary, and together they cover both forms:

| Form | Checked by |
|---|---|
| `{ pathname, params }` | the generated types, everywhere |
| `'/some/path'` | this registry, once, at its definition |

## Adding a route
1. Add the file under `src/app/` and record it in `src/app/spec.md`.
2. Run the app so Expo regenerates `.expo/types/router.d.ts` — the new path is
   not in `Route` until it does. CI regenerates it on every run; a local
   checkout does not, so a stale `.expo/` is a local-only failure mode.
3. Add the key here and to the table above.

Adding a key before step 2 fails type-check, which is the intended order.

## Out of scope
- **Navigation itself.** This module exports data, imports nothing from
  `expo-router` at runtime, and never calls `router`. Callers use `useRouter()`
  or `<Link>` directly.
- **Guards.** Who may reach a route is decided by `src/app/(app)/_layout.tsx`;
  a name in this map implies no access.
- **Screen behavior**, which stays in each feature's own `spec.md`.
