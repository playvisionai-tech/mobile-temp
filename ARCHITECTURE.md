# Architecture

Start here. This file is the map: what the app is made of, how the pieces fit,
and where the detail lives. It links out rather than repeating — if a rule is
stated in full somewhere else, this file points at it instead of copying it.

Everything below was read out of the code. Where the code and a rule file
disagree, the code wins and the disagreement is recorded under
[Known deviations](#known-deviations-and-debt).

## The shape of the app

An Expo app organized in **vertical feature slices**. A capability owns its
screens, its components, its data hooks and its docs, in one folder.

| Directory | What it is for |
|---|---|
| `src/app/` | Expo Router's file tree. Leaf routes are one-line re-exports; the two `_layout.tsx` files own the navigator and the route guard. |
| `src/features/<f>/` | One folder per capability: `auth`, `feed`, `onboarding`, `settings`, `style-demo`. Screens, feature-local `components/`, `api.ts`, tests, `spec.md`, `decisions.md`. |
| `src/components/ui/` | The design system. One shared inventory, one barrel (`index.tsx`) — the only barrel file the project allows. |
| `src/lib/` | Cross-cutting infra, one module per subdirectory: `analytics`, `api`, `auth`, `crash-reporting`, `feature-flags`, `hooks`, `i18n`, `storage`, `utils`. `test-utils.tsx` is the one loose file left at the top and belongs to no module. |
| `src/translations/` | `en.json` and `ar.json`. All user-facing copy. |
| `.maestro/` | E2E flows grouped by user journey (`auth/`, `app/`), with reusable steps in `utils/`. |

Two boundaries hold the slices apart: features never import from each other
(they share through `src/components/ui/` or `src/lib/`), and routes carry no
business logic. See [`agents/rules/architecture-core.md`](agents/rules/architecture-core.md)
for both rules and how far each is actually enforced.

## Runtime stack

Verified against `package.json` and the files that wire each one up.

| Concern | Package | Wired in |
|---|---|---|
| Routing | `expo-router` ~6 | `src/app/`, entry is `expo-router/entry` |
| Auth | `@clerk/expo` ^4, `@clerk/react` ^6 | `ClerkProvider` in `src/app/_layout.tsx` |
| Token persistence | `expo-secure-store` (via Clerk's `tokenCache`) | `src/app/_layout.tsx` |
| Server state | `@tanstack/react-query` ^5 + `react-query-kit` | `src/lib/api/provider.tsx`, `src/features/feed/api.ts` |
| HTTP | `axios` | `src/lib/api/client.tsx` (request + response interceptors) |
| Client persistence | `react-native-mmkv` ~4 | `src/lib/storage/index.tsx`, `src/lib/hooks/` |
| Styling | `uniwind` + Tailwind v4 | `src/global.css`, `metro.config.js` |
| Animation | `react-native-reanimated` ~4, `react-native-worklets`, `moti` | `src/components/ui/` |
| Lists | `@shopify/flash-list` 2 | `src/components/ui/list.tsx`, `src/features/feed/feed-screen.tsx` |
| i18n | `i18next` + `react-i18next` + `expo-localization` | `src/lib/i18n/` |
| Forms | `@tanstack/react-form` + `zod` | feature screens, `src/components/ui/form-utils` |
| Analytics | `@react-native-firebase/analytics` 26 | `src/lib/analytics/`, screen tracking mounted in `src/app/_layout.tsx` |
| Crash reporting | `@react-native-firebase/crashlytics` 26 | `src/lib/crash-reporting/` |
| Feature flags | `@react-native-firebase/remote-config` 26 | `src/lib/feature-flags/`, initialized in `src/app/_layout.tsx` |
| Config | `zod` schema in `env.ts` | `app.config.ts`, imported as `env` |

The app depends on native modules (Clerk, SecureStore, MMKV, Reanimated,
Nitro), so **it cannot run in Expo Go** — see
[README → Running the app](README.md#️-running-the-app).

## Provider tree

From `src/app/_layout.tsx`, outermost to innermost:

```
ClerkProvider
└── GestureHandlerRootView      (also carries the `dark` class and onLayout)
    └── KeyboardProvider
        └── ThemeProvider       (@react-navigation/native, from useThemeConfig)
            └── APIProvider     (QueryClientProvider)
                └── BottomSheetModalProvider
                    ├── Stack   → (app) | onboarding | login
                    └── FlashMessage
```

Two things run at module scope, before the tree mounts: `loadSelectedTheme()`
so the app does not flash the wrong theme, and
`SplashScreen.preventAutoHideAsync()`. The splash is hidden from the root
`GestureHandlerRootView`'s `onLayout`, guarded by a ref so it fires once.

`src/app/(app)/_layout.tsx` guards the authenticated tree in a fixed,
load-bearing order: first-run → `/onboarding`; `!isLoaded` → render nothing;
`!isSignedIn` → `/login`. The `null` branch exists because Clerk restores the
session from SecureStore asynchronously. Rationale and trade-offs:
[`src/app/decisions.md`](src/app/decisions.md).

## Data flow

**Server state → React Query.** One `QueryClient` in `src/lib/api/provider.tsx`.
Features declare hooks with `react-query-kit` next to the screens that use them
(`src/features/feed/api.ts`), and every call goes through the single axios
instance in `src/lib/api/client.tsx`. That client does two things and nothing
else: a request interceptor attaches the Clerk session JWT, and a response
interceptor calls `signOut()` on a 401 and lets the route guard redirect. No
hand-rolled `fetch` anywhere. Detail: [`src/lib/api/spec.md`](src/lib/api/spec.md).

**Session state → Clerk.** There is no local auth store. Clerk owns
sign-in, session and sign-out; `tokenCache` from `@clerk/expo/token-cache`
persists the session in `expo-secure-store`. Detail:
[`src/features/auth/spec.md`](src/features/auth/spec.md).

**Durable client state → MMKV.** `src/lib/storage/index.tsx` creates the instance;
`src/lib/hooks/use-selected-theme.tsx` and `use-is-first-time.tsx` are the only
consumers. MMKV is chosen because it reads synchronously, so the theme and the
first-run flag are available before the first render. It holds **no tokens**.

**Zustand is aspirational.** `AGENTS.md` and the rule files say "client state →
Zustand". Today the package is a dependency and nothing uses it: the only
reference in `src/` is a type-only import in `src/lib/utils/index.ts`, feeding a
`createSelectors` helper that has no store to select from. Treat the rule as
the intended shape for the first store that needs it, not as a description of
the code.

## The spec system

Every module carries two documents, and tooling enforces it.

- **`spec.md`** — what the module does *today*, present tense. When behavior
  changes, rewrite it in the same change. Never append "we added X".
- **`decisions.md`** — why it is that way and what was rejected. Append-only,
  dated, and only for genuine trade-offs.

What counts as a module is defined in one place —
[`scripts/spec-modules.js`](scripts/spec-modules.js) — and both enforcers read
it, so they cannot drift apart:

| | Modules |
|---|---|
| Namespaces (each subdirectory is a module) | `src/features/*`, `src/lib/*` |
| Single modules | `src/components/ui`, `src/app` |
| Not modules | loose files directly in `src/features/` or `src/lib/` |

Three enforcers, same map:

- `pnpm check-specs` ([`scripts/check-specs.js`](scripts/check-specs.js)) —
  diffs staged changes (or the working tree, or `--base <ref>`) and fails when a
  changed module is missing a document, or when its code changed and its
  `spec.md` did not.
- ESLint `local/spec-required` ([`scripts/eslint-rule-spec.js`](scripts/eslint-rule-spec.js),
  registered at the bottom of `eslint.config.mjs`) — the same requirement in the
  editor, for `src/features/**`, `src/lib/**` and `src/components/ui/**`.
- [`.github/workflows/drift-check.yml`](.github/workflows/drift-check.yml) —
  runs the identical script against `origin/<base>` on every pull request.

New module? Start from [`.templates/spec.md`](.templates/spec.md).

## Where to read next

| For | Read |
|---|---|
| The working agreement — do's, don'ts, definition of done | [`AGENTS.md`](AGENTS.md) |
| Slices, cross-feature imports, barrels, UI-kit promotion | [`agents/rules/architecture-core.md`](agents/rules/architecture-core.md) |
| EAS profiles, `env.ts`, `EXPO_PUBLIC_` variables | [`agents/rules/architecture-build-config.md`](agents/rules/architecture-build-config.md) |
| `Platform.select`, native modules, permissions | [`agents/rules/architecture-platform-boundaries.md`](agents/rules/architecture-platform-boundaries.md) |
| Test placement, Maestro flows, test helpers | [`agents/rules/testing-rules.md`](agents/rules/testing-rules.md) |
| Styling and i18n standards | [`agents/rules/quality-standards.md`](agents/rules/quality-standards.md) |
| CI workflows and spec freshness | [`agents/rules/ci-cd-rules.md`](agents/rules/ci-cd-rules.md) |
| Driving a simulator through Argent MCP | [`agents/rules/argent.md`](agents/rules/argent.md) |
| Every command, by topic | [`agents/commands.md`](agents/commands.md) |
| Dev build, prebuild, environments, Clerk key | [`README.md` → Running the app](README.md#️-running-the-app) |

Per-module specs, all of which exist today:

| Module | Spec |
|---|---|
| Routing (route inventory) | [`src/app/spec.md`](src/app/spec.md) · [decisions](src/app/decisions.md) |
| UI kit (component inventory) | [`src/components/ui/spec.md`](src/components/ui/spec.md) · [decisions](src/components/ui/decisions.md) |
| Auth | [`src/features/auth/spec.md`](src/features/auth/spec.md) · [decisions](src/features/auth/decisions.md) |
| Feed | [`src/features/feed/spec.md`](src/features/feed/spec.md) · [decisions](src/features/feed/decisions.md) |
| Onboarding | [`src/features/onboarding/spec.md`](src/features/onboarding/spec.md) · [decisions](src/features/onboarding/decisions.md) |
| Settings | [`src/features/settings/spec.md`](src/features/settings/spec.md) · [decisions](src/features/settings/decisions.md) |
| Style demo | [`src/features/style-demo/spec.md`](src/features/style-demo/spec.md) · [decisions](src/features/style-demo/decisions.md) |
| Analytics | [`src/lib/analytics/spec.md`](src/lib/analytics/spec.md) · [decisions](src/lib/analytics/decisions.md) |
| API client | [`src/lib/api/spec.md`](src/lib/api/spec.md) · [decisions](src/lib/api/decisions.md) |
| Crash reporting | [`src/lib/crash-reporting/spec.md`](src/lib/crash-reporting/spec.md) · [decisions](src/lib/crash-reporting/decisions.md) |
| Feature flags | [`src/lib/feature-flags/spec.md`](src/lib/feature-flags/spec.md) · [decisions](src/lib/feature-flags/decisions.md) |
| Auth library (unused) | [`src/lib/auth/spec.md`](src/lib/auth/spec.md) · [decisions](src/lib/auth/decisions.md) |
| Hooks | [`src/lib/hooks/spec.md`](src/lib/hooks/spec.md) · [decisions](src/lib/hooks/decisions.md) |
| i18n | [`src/lib/i18n/spec.md`](src/lib/i18n/spec.md) · [decisions](src/lib/i18n/decisions.md) |

## Known deviations and debt

Stated here rather than hidden, so nobody rediscovers them as surprises.

- **Nothing blocks a cross-feature import.** `eslint.config.mjs` configures no
  `import/no-restricted-paths`. The boundary is real but it is held by review.
- **Routes are not all re-exports.** Both `_layout.tsx` files own real behavior
  (accepted — a navigator has to be declared somewhere), `[...messing].tsx`
  defines `NotFoundScreen` inline (not accepted; it would be a feature screen if
  anyone moved it), and `+html.tsx` is web-only Expo Router plumbing. The
  catch-all's param is also spelled `messing`, which reads like a typo for
  `missing`; renaming it changes a URL, so it has been left alone.
- **Zustand is a dependency with no store**, and `createSelectors` in
  `src/lib/utils/index.ts` is a helper with nothing to help. See
  [Data flow](#data-flow).
- **`src/lib/auth/` is dead code.** A pre-Clerk MMKV token store that nothing
  imports; its own spec says so.
- **Tests are thin.** Several directories that hold behavior still have no
  `__tests__/` folder. The placement convention in
  [`agents/rules/testing-rules.md`](agents/rules/testing-rules.md) is correct;
  coverage is not there yet. The absence of a root `__tests__/` is not part of
  this gap — that is the rule: every test sits beside the file it covers, and
  cross-cutting coverage is a Maestro flow.
- **The Firebase config files in `firebase/` are placeholders.** They are
  structurally valid so every `pnpm prebuild:*` succeeds, but every key is fake,
  so nothing reports to Firebase until they are replaced with real downloads
  from the console. See [`firebase/README.md`](firebase/README.md).
- **Nothing sets the telemetry user id yet.** `setCrashUser` / `setAnalyticsUser`
  exist and are tested, but no sign-in or sign-out path calls them, so events and
  crashes are anonymous. Wiring them is a change to `src/features/auth/`.
- **`nativewind-env.d.ts` is still referenced from `tsconfig.json`** even though
  styling moved to uniwind. Harmless, and not yet cleaned up.
- **There is no single CI pipeline.** The workflows in `.github/workflows/` are
  independent jobs that run in parallel. The ordered sequence
  (`lint → type-check → translations → test → check-specs`) exists only as the
  local `pnpm check-all`.
