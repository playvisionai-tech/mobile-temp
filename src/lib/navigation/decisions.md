# navigation — decisions

## 2026-08-26 — A route registry, even though `typedRoutes` is on
**Chose:** A named `ROUTES` map, checked once at its definition with
`satisfies RouteRegistry`
**Over:** Writing path strings at each call site and relying on
`experiments.typedRoutes: true` to check them
**Why:** `typedRoutes` does not check paths in this app. The generated union in
`.expo/types/router.d.ts` contains a bare `` `/${string}` `` member, contributed by
the `[...messing]` catch-all route, so every string beginning with `/` is a
valid `Href`. Verified directly: `const bad: Href = '/nope-not-a-route'`
compiles clean today. Any app with a catch-all route has this hole, and this app
needs its catch-all to render a not-found screen.

Params *are* still checked — `{ pathname: '/feed/[id]', params: { wrong: 1 } }`
errors — so the gap is paths specifically, and only in the string form of
`Href`. The registry is not redundant with `typedRoutes`; it is the only place a
bad path can be caught, because it is checked **once at the definition** instead
of never at the call sites.
**Trade-off:** One more indirection between a screen and the router, and a new
route now has to be added in two places. It also cannot catch a path that is
stale rather than malformed: if a route file is deleted and
`.expo/types/router.d.ts` is not regenerated, the old literal keeps compiling.

## 2026-08-26 — Constrain with `Route`, not with `Href`
**Chose:** ``StaticRoute = Exclude<Route, `${string}[${string}]${string}`>`` for
the string members, and `(...args: never[]) => Href` for the function member
**Over:** `satisfies Record<string, Href>`, the obvious spelling
**Why:** `satisfies Href` on a string would check nothing, for the reason above
— the wildcard lives in `Href`'s string arm. `Route` is expo-router's own
`Exclude<Extract<Href, object>['pathname'], RelativePathString |
ExternalPathString>`: the pathnames of the *object* members, which are all
literals. That is the narrowest route type the generated file offers, and it is
public API rather than something re-derived here. Dynamic patterns are then
excluded from it because `/feed/[id]` is a template — navigating to it as a bare
string would land on a literal `[id]` segment.

The object form of `Href` has no such hole, so the function member is checked
against `Href` directly and gets pathname and params in one check.
**Trade-off:** `Route` is documented `@hidden` in expo-router's source. It is
exported and stable across the version in `package.json`, but it is closer to
that library's internals than `Href` is, and a future release could reshape it.
If it disappears, the replacement is one line: inline its definition here.

## 2026-08-26 — Type-level assertions live in the test file
**Chose:** `@ts-expect-error` cases in `__tests__/navigation.test.ts`, checked
by `pnpm type-check` rather than by Jest
**Over:** Asserting only the runtime values, or keeping a scratch file that
someone compiles by hand
**Why:** A test that only checks `ROUTES.login === '/login'` passes just as
happily against `satisfies Record<string, string>`, which catches nothing —
it would miss the entire point of the module. An unused `@ts-expect-error` is
itself a compile error, so each case fails the build the day the constraint
stops constraining. Keeping them beside the value assertions means the reason
the module exists is visible to whoever next edits it.
**Trade-off:** Jest reports those cases as passing without checking anything;
the real assertion runs in a different command. The test bodies still assert the
runtime value so the case is not empty, but a reader has to know that the
comment, not the `expect`, is the point.

## 2026-08-26 — CI regenerates the route types instead of the assertions giving them up
**Chose:** A step in `.github/workflows/type-check.yml` that regenerates
`.expo/types/router.d.ts` before `tsc`, via
`expo-router/build/typed-routes`'s `regenerateDeclarations`
**Over:** (i) rewriting the `@ts-expect-error` cases so they do not depend on
generated types, or (ii) committing `.expo/types/router.d.ts`
**Why:** The three directives failed CI as *unused*, which is the failure
reporting a real hole rather than a flaw in them. Verified by deleting `.expo/`
locally and re-running `tsc`: the same three `TS2578`s appear, and a probe
`const badRoute: Route = '/nope-not-a-route'` compiles clean, because with the
file absent `Href` falls back to its permissive default and `Route` degrades to
`string`. On a fresh checkout — which is every CI run — tsc was checking **no**
route path or param anywhere in the app, not just here.

Measured what regenerating actually buys, with and without the file present:
`{ pathname: '/feed/[id]', params: { wrong: 1 } }` and
`{ pathname: '/nope-not-a-route' }` are both caught with it and both silently
accepted without it. So the step restores real checking repo-wide, on every
object-form `Href` in the codebase, and this module stops being the only
beneficiary.

Option (i) was rejected because the only assertions that survive without
generated types are ones about `StaticRoute`'s exclusion logic in the abstract —
they would prove the mechanism while proving nothing about whether the paths in
`ROUTES` are real, and would pass just as happily if every one of them were
wrong. Option (ii) was rejected because a committed copy goes stale silently:
delete a route, forget to regenerate, and the file keeps asserting the old path
exists — the worst failure mode of the three, since it is the one that does not
announce itself.
**Trade-off:** No supported typegen command exists in Expo SDK 54 — `expo
--help` lists `start, export, run:ios, run:android, prebuild, install,
customize, config, serve` and nothing else, and `@expo/cli`'s own generator is
reachable only through a running Metro dev server. So the step drives an
**internal** entry point, documented in expo-router's source as "imported via
`@expo/cli`" and carrying a version handshake (`version = 52`). An SDK bump can
move it. Both ways it can break were checked, and neither is silent: if it
writes nothing, the step polls for its own output and exits non-zero naming the
cause, rather than leaving tsc to report three confusing `TS2578`s; if it writes
a file with no routes in it — forced here by pointing it at a missing app root —
the empty union rejects every real route usage in `src/`, so tsc fails with
errors in `(app)/_layout.tsx`, `[...messing].tsx` and `post-card.tsx` rather
than passing. The permissive fallback only applies when the file is absent
entirely, which is the case the poll covers. If the entry point does move,
the fallback is
`getTypedRoutesDeclarationFile` from `expo-router/build/typed-routes/generate`,
which produces byte-identical output synchronously but needs three internal
imports instead of one.

**This does not close the `/${string}` hole** — that is a property of the
generated union itself, and `<Link href="/nope">` still compiles everywhere
after this change. Checking string paths remains this module's job; see the
first decision above.
