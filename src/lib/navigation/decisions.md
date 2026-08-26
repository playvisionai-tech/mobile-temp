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
