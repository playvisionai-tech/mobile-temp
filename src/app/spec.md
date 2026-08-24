# Routing — current behavior

## What this module does

Expo Router's file tree. Every file here maps a URL to a screen. Leaf routes are
one-line re-exports of a feature screen and own no behavior; the two `_layout`
files own the navigator structure and the auth/onboarding guard.

## Route inventory

`(app)` is a group, so it does not appear in the URL.

| URL | File | Renders |
|---|---|---|
| — | `_layout.tsx` | Root `Stack` + provider tree (owns behavior) |
| — | `(app)/_layout.tsx` | `Tabs` + route guard (owns behavior) |
| `/` | `(app)/index.tsx` | `FeedScreen` from `@/features/feed/feed-screen` |
| `/style` | `(app)/style.tsx` | `StyleScreen` from `@/features/style-demo/style-screen` |
| `/settings` | `(app)/settings.tsx` | `SettingsScreen` from `@/features/settings/settings-screen` |
| `/feed/[id]` | `feed/[id].tsx` | `PostDetailScreen` from `@/features/feed/post-detail-screen` |
| `/feed/add-post` | `feed/add-post.tsx` | `AddPostScreen` from `@/features/feed/add-post-screen` |
| `/login` | `login.tsx` | `LoginScreen` from `@/features/auth/login-screen` |
| `/onboarding` | `onboarding.tsx` | `OnboardingScreen` from `@/features/onboarding/onboarding-screen` |
| any unmatched | `[...messing].tsx` | `NotFoundScreen` (defined inline) |
| — | `+html.tsx` | Web-only static HTML shell |

## Behavior

- `unstable_settings.initialRouteName` is `'(app)'`, so a deep link into a
  nested route still has the tab shell beneath it rather than opening bare.
- The root `Stack` registers `(app)`, `onboarding` and `login` with
  `headerShown: false`; each screen draws its own header if it needs one.
- The root layout hides the splash screen from `onLayout` on the
  `GestureHandlerRootView`, guarded by a ref so it fires once.
- `loadSelectedTheme()` runs at module scope, before first render, so the app
  does not flash the wrong theme.
- The `(app)` guard runs in a fixed order, and the order is load-bearing:
  first-run → `/onboarding`; then `!isLoaded` → render nothing; then
  `!isSignedIn` → `/login`. Returning `null` while Clerk restores the session
  from the token cache is what stops an already-signed-in user being bounced to
  `/login`.
- Three tabs — Feed, Style, Settings — each with a `tabBarButtonTestID`
  (`feed-tab`, `style-tab`, `settings-tab`). `.maestro/app/tabs.yaml` selects
  tabs by those IDs, so renaming one breaks E2E.
- The Feed tab sets `headerRight` to a `Link` to `/feed/add-post`. This is the
  only screen-level UI defined in this module.

## Provider tree

Outermost to innermost, from `_layout.tsx`:

`ClerkProvider` → `GestureHandlerRootView` → `KeyboardProvider` →
`ThemeProvider` → `APIProvider` → `BottomSheetModalProvider` → routes, with
`FlashMessage` mounted as a sibling of the routes.

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
