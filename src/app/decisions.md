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

## 2026-08-26 — Route paths go through a registry (narrows 2026-08-24 — "The navigator is not wrapped; the icons are")
**Chose:** Import route *path strings* from `ROUTES` in `@/lib/navigation` at every call site in `src/app/`, and keep importing `Link`, `useRouter`, `Stack` and `useLocalSearchParams` straight from `expo-router`
**Over:** (a) leaving the paths as string literals, as the 2026-08-24 entry left them; (b) wrapping the whole of `expo-router` behind a `lib/navigation` façade so no file imports it directly
**Why:** The 2026-08-24 entry reasoned that expo-router needed no wrapper, and for the components it named that still holds — this entry narrows it rather than reversing it. What that entry did not have is that **`typedRoutes` does not type-check path strings in this app.** The generated union in `.expo/types/router.d.ts` carries a bare `` `/${string}` `` member, contributed by the `[...messing]` catch-all, so `const bad: Href = '/nope-not-a-route'` compiles clean. Params *are* still checked. Both verified by probe against `tsc`. So the safety we assumed we were getting from `typedRoutes` was never there for pathnames, and a typo'd path was a runtime 404 that nothing caught. The registry closes exactly that hole and nothing else: it types its entries against expo-router's `Route`, which has no `` `/${string}` `` member, at one definition site.
**Not done, and why:** no wrapper around `Link`, `useRouter` or `Stack`. Those would be pass-throughs — `agents/skills/add-dependency/wrappers.md` calls that shape out by name (`export const List = NFlashList`), and it buys nothing here because the components were never the unsafe part. Option (b) also loses expo-router's own JSX typing at the boundary for no gain.
**Trade-off:** One more indirection between a screen and its destination — reading `(app)/_layout.tsx` no longer tells you where the guard sends a signed-out user without opening a second file — and the registry is now a second place a path is written down, so moving a route means updating it or the build breaks. Against that: a path typo is a compile error instead of a runtime 404, and `src/app/spec.md`'s inventory now has a name column that a call site actually references, so a stale route table gets noticed. `ROUTES.post(id)` is a function rather than a string because `/feed/[id]` is a template; that asymmetry between static and dynamic entries is the cost of getting params checked at the same site.

## 2026-08-27 — Notification deep links are handled in the root layout, and cannot be handled anywhere else
**Chose:** Mount `useNotificationDeepLinks()` — and, alongside it, `useNotificationRegistration()` — in `RootLayout`, and let a notification's destination be resolved by `@/lib/notifications` against `ROUTES` rather than by a route file
**Over:** (a) handling the tap inside whichever feature the notification points at; (b) registering an Expo Router URL deep link and letting the payload carry a path
**Why:** A notification can start the app from any state, including cold from a quit process and including signed out, so no feature is mounted when the tap has to be honoured — (a) has no code running to receive it. The root layout is the first place with a router, which is what the hook actually needs: on a cold start the message is known *before* the navigator exists, so the target has to be held and flushed once it mounts. That is a navigator concern, not a feature one, which is why it sits beside `useScreenTracking()` rather than in a slice. (b) was rejected for the reason argued in `src/lib/notifications/decisions.md`: a payload that carries a path decides where the app goes, and the payload is untrusted. Naming a destination from an allow-list inverts that, and the allow-list omits `login` and `onboarding` precisely because the `(app)` guard owns who goes there.
**Trade-off:** `_layout.tsx` gains two more hooks that run before anything renders, and the root layout is now the place where a startup deep link can race the guard: a notification target inside `(app)` navigates, and the guard then redirects a signed-out user to `/login`, losing the destination. That is correct behavior and poor continuity — restoring it after sign-in would need somewhere to park the pending target, which nothing does today. Permission is also asked at first launch as a consequence of mounting registration here; that trade-off is argued where it was made, in `src/lib/notifications/decisions.md`.
