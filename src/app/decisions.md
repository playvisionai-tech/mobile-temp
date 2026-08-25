# Routing — decisions

`src/app/` is Expo Router's file tree. The *behavior* behind a route is
described by the spec of the feature it points at (`src/features/<f>/spec.md`);
`src/app/spec.md` is the route inventory beside this file — which URLs exist and
which screen each renders — and deliberately not a copy of those specs.
Navigation structure, route grouping and guard ordering are architectural
choices with no other home, and they live here.

Entries below the 2026-08 line predate this file. They were reconstructed from
the code and from the commits that introduced each choice (referenced inline);
nothing here is invented rationale.

## 2024-01-25 — One `(app)` group guarded by its layout (`9948ea2`)
**Chose:** Put every authenticated screen under the `(app)` route group and do the auth check once, in `(app)/_layout.tsx`
**Over:** A redirect check inside each protected screen, or a single guard at the root layout covering all routes
**Why:** A group layout is the only place a check runs before any child renders, so a protected screen cannot briefly mount for a signed-out user. Guarding at the root instead would have to exempt `/login` and `/onboarding`, which are children of the same tree — the exemption list is the thing that rots.
**Trade-off:** The group name leaks into paths in the source tree but not the URL, which surprises people; and everything that must be reachable while signed out has to sit outside `(app)` — currently `login`, `onboarding`, `+html`, and the `[...messing]` catch-all. Adding a public route means remembering that, and nothing enforces it.

## 2024-01-25 — `initialRouteName: '(app)'` (`9948ea2`)
**Chose:** Pin the root stack's initial route to the `(app)` group
**Over:** Letting Expo Router pick the first route alphabetically
**Why:** Deep links and dev reloads land on an arbitrary screen otherwise, and the back stack from a deep link should unwind to the app, not to `/login`.
**Trade-off:** `unstable_settings` is, as named, an unstable API — an Expo Router upgrade can change its shape, and it is easy to miss because nothing fails loudly when it stops being honoured.

## 2024-11-13 — Tabs carry `tabBarButtonTestID` (`a794a72`)
**Chose:** Give each `Tabs.Screen` an explicit `tabBarButtonTestID` (`feed-tab`, `style-tab`, `settings-tab`)
**Over:** Targeting tabs by their visible title in Maestro flows
**Why:** Titles are user-facing copy: they are translated and they change. A flow that taps "Settings" breaks the moment the app runs in Arabic or the copy is reworded.
**Trade-off:** Two names per tab to keep in sync, and the testIDs ship in production builds. Renaming a tab route now means updating `.maestro/` too — the coupling is real, it is just explicit instead of accidental.

## 2026-06-02 — Splash hidden from the root layout's `onLayout` (`8f6b739`)
**Chose:** `SplashScreen.preventAutoHideAsync()` at module scope, then `SplashScreen.hide()` from the root `GestureHandlerRootView`'s `onLayout`, guarded by a ref so it fires once
**Over:** Hiding the splash from an effect, or letting it auto-hide
**Why:** `onLayout` is the first point at which the tree has actually been laid out, so the splash covers the whole mount instead of uncovering a blank frame. The ref guard matters because `onLayout` fires again on rotation and on keyboard-driven resizes.
**Trade-off:** The splash is tied to the root view laying out, not to the app being *ready* — the `(app)` guard can still render `null` while Clerk restores the session, so a brief empty screen after the splash is possible. Fixing that would mean holding the splash until `isLoaded`, which couples the root layout to auth.

## 2026-08-24 — `src/app/` is a full module: route inventory plus decisions
**Chose:** Treat `src/app/` like every other module — `scripts/check-specs.js` requires both a `spec.md` (the route inventory) and a `decisions.md` here
**Over:** (a) recording routing decisions in the nearest feature's `decisions.md` or a repo-level architecture document; (b) making `src/app/` decisions-only, with no `spec.md`, on the grounds that routes are re-exports
**Why:** AGENTS.md says to put a decision where the code it constrains lives, and no feature owns the navigator — the `(app)` guard constrains auth, onboarding and every tab at once. Filing it under one feature hides it from the others; filing it in a repo-level doc puts it where nobody editing `_layout.tsx` will look. Option (b) was taken first and reversed before this branch landed: it rested on "every file here is a re-export", which is false. Four of the eleven files are not — both `_layout.tsx` files, the inline `NotFoundScreen` in `[...messing].tsx`, and `+html.tsx` — and the navigator shape, provider order and guard sequence are observable behavior that no feature spec describes. An inventory of which URLs exist is also the thing a newcomer actually needs and cannot get by reading eleven one-line files.
**Trade-off:** `src/app/spec.md` can drift into restating feature behavior; it is scoped to *what routes exist and what they render*, and the feature specs stay authoritative for screen behavior. The drift rule now also fires on `src/app`, so moving a route means touching the inventory in the same commit — deliberate, since a stale route table is worse than none. Some overlap with feature decisions is unavoidable: the session-restore window is argued in `src/features/auth/decisions.md` because that is where the trade-off was made, and only its routing consequence is stated here.

## 2026-08-24 — Native bottom tabs over the expo-router JS `<Tabs>`
**Chose:** `react-native-bottom-tabs` + `@bottom-tabs/react-navigation`, mounted through `withLayoutContext`
**Over:** (a) keeping the JS `<Tabs>`; (b) `expo-router/unstable-native-tabs`, already present at zero cost; (c) `@react-navigation/bottom-tabs/unstable`
**Why:** A real `TabView` / `BottomNavigationView` gets system animations off the JS thread, native blur and haptics, and iOS 26 Liquid Glass. (b) was the tempting option — no dependency, no rebuild — but its entry point is literally `expo-router/unstable-native-tabs` and has carried that prefix across SDK 54, 55, 56 and 57, so the import path and props are still moving; `react-native-bottom-tabs` is at 1.4.0 under semver. (c) is blocked outright: it needs `react-native-screens` ≥ 4.25 and SDK 54 pins us to ~4.16. We also have upstream commits in the Callstack library, so the usual "who fixes it when it breaks" objection to a 1.5%-adoption native dependency is much weaker here than it would be for another team.
**Trade-off:** A native module, so every dev client must be rebuilt, and it is absent from Expo's `bundledNativeModules.json` — nobody pins it for us and each SDK upgrade must re-verify it by hand (it is exact-pinned for that reason). The navigator has **no header options at all**, which is why the Feed tab's `headerRight` moved into `FeedScreen`. Icons can no longer be React components. Styling is constrained: `tabBarStyle` takes only `backgroundColor`, and on iOS 26 the system owns the tint entirely. Android caps out at 5 tabs.

## 2026-08-24 — The navigator is not wrapped; the icons are
**Chose:** Import `@bottom-tabs/react-navigation` directly in `(app)/_layout.tsx`, and put the platform icon split behind `getTabIcon()` in `components/ui/tab-icons.tsx`
**Over:** Wrapping the navigator itself in `components/ui/` or `lib/`
**Why:** The add-dependency skill exempts "providers mounted once" from the wrapper rule, and Expo Router requires the navigator to be declared in the layout — a wrapper around a single mount site adds a file and hides nothing. The icons are the opposite case: without a wrapper the SF Symbol / Material glyph split would be smeared across three `Tabs.Screen` options, and the planned move to image assets would touch every one of them.
**Trade-off:** `@bottom-tabs/react-navigation` now has an import site outside a wrapper, so the isolation proof in the skill covers `react-native-bottom-tabs` and `@react-native-vector-icons` but not the navigator package. That is deliberate and recorded here rather than left to look like an oversight.

## 2026-08-25 — Telemetry is started from the root layout, not from a provider
**Chose:** Call `initializeFeatureFlags()` at module scope in `_layout.tsx` and `useScreenTracking()` inside `RootLayout`
**Over:** (a) A `<TelemetryProvider>` in the provider tree; (b) initializing inside each lib module on first import; (c) native automatic screen reporting, with no router involvement at all
**Why:** Neither concern renders anything or holds React state that a consumer reads, so a provider would add a tree level and a context for nothing. (b) makes start-up order depend on which module something imports first, which is exactly the bug class that made `loadSelectedTheme()` a module-scope call here. (c) cannot work: a React Native app is one native view controller, so Firebase's automatic screen tracking sees one screen for the whole session — the router is the only thing that knows what screen a user is on, and `usePathname` is only available under the router.
**Trade-off:** `_layout.tsx` gains two more things that run before the tree mounts, and screen tracking is now coupled to Expo Router's path shape — `toScreenName()` in `@/lib/analytics` normalizes `/feed/12` to `/feed/[id]` so a route rename, not a parameter value, is what changes an event name. Firebase's own screen-view auto-collection stays off in `firebase.json`; turning it back on would double-count.
