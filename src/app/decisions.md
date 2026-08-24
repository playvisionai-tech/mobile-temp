# Routing — decisions

`src/app/` is Expo Router's file tree. Every file here is a re-export, so the
*behavior* behind a route is described by the spec of the feature it points at
(`src/features/<f>/spec.md`) — this directory has no `spec.md` of its own and
a duplicate one would only go stale. Navigation structure, route grouping and
guard ordering are still real architectural choices with no other home, and
they live here.

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

## 2026-08-24 — Routing decisions live here, in `src/app/decisions.md`
**Chose:** Treat `src/app/` as a decisions-only module: `scripts/check-specs.js` requires a `decisions.md` here and no `spec.md`
**Over:** Recording routing decisions in the nearest feature's `decisions.md`, or in a repo-level architecture document
**Why:** AGENTS.md says to put a decision where the code it constrains lives, and no feature owns the navigator — the `(app)` guard constrains auth, onboarding and every tab at once. Filing it under one feature hides it from the others; filing it in a repo-level doc puts it where nobody editing `_layout.tsx` will look.
**Trade-off:** `src/app/` is now a module in a system that otherwise means "feature or lib module", and it is the one asymmetric member (decisions, no spec) — the module map in `scripts/spec-modules.js` has to special-case it. Some overlap with feature decisions is unavoidable: the session-restore window is argued in `src/features/auth/decisions.md` because that is where the trade-off was made, and only its routing consequence is stated here.
