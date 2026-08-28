# Routing — current behavior

## What this module does

Expo Router's file tree. Every file here maps a URL to a screen. Leaf routes are
one-line re-exports of a feature screen and own no behavior; the two `_layout`
files own the navigator structure and the auth/onboarding guard.

## Route inventory

`(app)` is a group, so it does not appear in the URL. The **Name** column is the
key in `ROUTES` from `@/lib/navigation` — the registry every call site
navigates through instead of writing the URL out. A route with no name is one
nothing navigates to by path.

| URL | Name | File | Renders |
|---|---|---|---|
| — | — | `_layout.tsx` | Root `Stack` + provider tree (owns behavior) |
| — | — | `(app)/_layout.tsx` | Native bottom tabs + route guard (owns behavior) |
| `/` | `ROUTES.home` | `(app)/index.tsx` | `FeedScreen` from `@/features/feed/feed-screen` |
| `/style` | `ROUTES.style` | `(app)/style.tsx` | `StyleScreen` from `@/features/style-demo/style-screen` |
| `/settings` | `ROUTES.settings` | `(app)/settings.tsx` | `SettingsScreen` from `@/features/settings/settings-screen` |
| `/feed/[id]` | `ROUTES.post(id)` | `feed/[id].tsx` | `PostDetailScreen` from `@/features/feed/post-detail-screen` |
| `/feed/add-post` | `ROUTES.addPost` | `feed/add-post.tsx` | `AddPostScreen` from `@/features/feed/add-post-screen` |
| `/login` | `ROUTES.login` | `login.tsx` | `LoginScreen` from `@/features/auth/login-screen` |
| `/onboarding` | `ROUTES.onboarding` | `onboarding.tsx` | `OnboardingScreen` from `@/features/onboarding/onboarding-screen` |
| any unmatched | — | `[...messing].tsx` | `NotFoundScreen` (defined inline) |
| — | — | `+html.tsx` | Web-only static HTML shell |

Moving or renaming a route means changing the file, this table, and the entry in
`@/lib/navigation` — the registry is a second place the path is written down,
and it is the one the type-checker guards.

## Behavior

- `unstable_settings.initialRouteName` is `'(app)'`, so a deep link into a
  nested route still has the tab shell beneath it rather than opening bare.
- The root `Stack` registers `(app)`, `onboarding` and `login` with
  `headerShown: false`; each screen draws its own header if it needs one.
- The root layout hides the splash screen from `onLayout` on the
  `GestureHandlerRootView`, guarded by a ref so it fires once.
- `loadSelectedTheme()` runs at module scope, before first render, so the app
  does not flash the wrong theme.
- `initializeFeatureFlags()` also runs at module scope, fire-and-forget. It
  activates the Remote Config values fetched on the *previous* launch and starts
  a fetch that applies to the *next* one, so flags never change mid-session.
  Reads fall back to the in-app defaults until it settles, and it never rejects.
- `RootLayout` calls `useScreenTracking()` from `@/lib/analytics`, which logs a
  `screen_view` on every router path change. Native automatic screen reporting
  is disabled in the root `firebase.json`, so this hook is the only source of
  screen analytics.
- `RootLayout` calls `useNotificationRegistration()` and
  `useNotificationDeepLinks()` from `@/lib/notifications`. The first asks for
  notification permission and takes an FCM device token on mount; the second
  subscribes to all three ways a message reaches the app and navigates for the
  two that are a tap: background-then-tapped, and cold-started by the tap. A
  message arriving while the app is in the foreground is received and
  deliberately **not** navigated — neither platform draws a notification while
  the app is in front, so nothing was tapped and moving a user who is mid-task
  would be the app acting on its own. Nothing renders it in-app either.
  The deep-link hook can only live here: it needs the root navigator, and a
  notification can start the app from any state, signed out included. A
  notification names a destination that `@/lib/notifications` validates against
  `ROUTES`; `login` and `onboarding` are not reachable that way. Both hooks are
  no-ops without the native module, and what they send is that module's
  behavior, described in `src/lib/notifications/spec.md`.
- `RootLayout` also mounts `<TelemetryIdentity />` from
  `@/features/auth/telemetry-identity` as the first child of `ClerkProvider`.
  It renders nothing; it sets the analytics and Crashlytics user id from Clerk's
  session, so events and crashes carry the account that produced them. It sits
  inside the provider because it reads `useAuth()`, and above `Providers` so it
  follows the session for the whole tree — including the cold-start restore and
  the API client's 401 sign-out, neither of which passes through `/login`. What
  it sends is the auth feature's behavior, described in
  `src/features/auth/spec.md`.
- The `(app)` guard runs in a fixed order, and the order is load-bearing:
  first-run → `ROUTES.onboarding`; then `!isLoaded` → render nothing; then
  `!isSignedIn` → `ROUTES.login`. Returning `null` while Clerk restores the
  session from the token cache is what stops an already-signed-in user being
  bounced to `/login`.
- No file here writes a route path as a literal. The guard's two `<Redirect>`s
  and the catch-all's "Go to home screen!" `<Link>` all take their `href` from
  `ROUTES`, so a path that does not exist fails to compile. `Link`, `Stack`,
  `useRouter` and `useLocalSearchParams` still come straight from `expo-router`
  — only the path strings are registered.
- The tab bar is native: a SwiftUI `TabView` on iOS and a Material
  `BottomNavigationView` on Android, from `react-native-bottom-tabs` via
  `withLayoutContext`. It is not the JS tab bar `expo-router` ships.
- Three tabs — Feed, Style, Settings — each with a `tabBarButtonTestID`
  (`feed-tab`, `style-tab`, `settings-tab`). `.maestro/app/tabs.yaml` selects
  tabs by those IDs, so renaming one breaks E2E.
- Tab icons come from `getTabIcon()` in `@/components/ui/tab-icons`, not from
  the SVG components in `components/ui/icons/`. A native tab bar cannot render
  a React element.
- **This module defines no screen-level UI.** The native navigator has no
  header slot, so the "Create" link that used to sit in the Feed tab's
  `headerRight` now lives inside `FeedScreen`.
- A deep link from a notification is navigated with `router.navigate`, and it is
  subject to the `(app)` guard like any other navigation: a target inside the
  group still redirects a signed-out user to `/login`.
- The startup side effects at module scope in `_layout.tsx` — `loadSelectedTheme()`,
  `initializeFeatureFlags()` and `SplashScreen.preventAutoHideAsync()` — are
  fire-and-forget. Their promises are explicitly discarded and no render waits on
  them, so a slow or failed one cannot hold up the first frame.

## Provider tree

Outermost to innermost, from `_layout.tsx`:

`ClerkProvider` → `GestureHandlerRootView` → `KeyboardProvider` →
`ThemeProvider` → `APIProvider` → `BottomSheetModalProvider` → routes, with
`FlashMessage` mounted as a sibling of the routes and `TelemetryIdentity` as a
sibling of `GestureHandlerRootView`, directly under `ClerkProvider`.

## Known deviations from the guide

`AGENTS.md` says routes hold "a re-export and nothing else". Four of the eleven
files here do not:

- both `_layout.tsx` files, which is unavoidable — a navigator has to be
  declared somewhere, and Expo Router requires it to be here;
- `[...messing].tsx`, which defines `NotFoundScreen` inline rather than in a
  feature;
- `+html.tsx`, which is web-only Expo Router plumbing.

The layouts are the accepted exception. The catch-all is not — it would be a
feature screen if anyone moved it. Its param is also spelled `messing`, which
reads like a typo for `missing`; renaming it is a URL-visible change, so it has
been left alone.

## Out of scope

- No `spec.md` obligations for the feature screens themselves — each feature
  documents its own behavior. This file only records what routes exist and what
  they point at.
- Navigator choices and guard ordering are decisions, not behavior; they live in
  `decisions.md` beside this file.
