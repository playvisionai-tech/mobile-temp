# notifications — decisions

## 2026-08-27 — Android permission goes through `PermissionsAndroid`, not through the package
**Chose:** `PermissionsAndroid.request(POST_NOTIFICATIONS)` from React Native
core on Android 33+, and the package's `requestPermission()` on iOS only
**Over:** Calling the package's `requestPermission()` on both platforms, which
is what its API shape invites
**Why:** Its Android implementation is a stub. In
`android/src/main/java/io/invertase/firebase/messaging/NativeRNFBTurboMessaging.java`
(v26.3.2) the whole of `requestPermission` is `promise.resolve(1)` — it returns
`AUTHORIZED` unconditionally, shows no dialog and consults no permission state.
Since Android 13 (API 33) posting a notification needs the `POST_NOTIFICATIONS`
runtime grant, so trusting that return value means the app believes it has
permission, never prompts, and posts nothing — a silent no-op on every current
device, and one that looks fine in code review. `PermissionsAndroid` is part of
`react-native`, so this costs no dependency. The package's `hasPermission()` is
*not* a stub — it reads `NotificationManagerCompat.areNotificationsEnabled()` —
so it is still what reports the current state on both platforms.
**Trade-off:** The module now has a platform branch that a single call would
have hidden, and it is coupled to an implementation detail of a third-party
package rather than to its documented contract — if a later version implements
the Android side properly, this branch is redundant rather than wrong, and
nothing will fail to tell us. The package's own docs also now deprecate
`requestPermission()` in favour of `react-native-permissions` or
`expo-notifications`; both are new dependencies and neither was approved, so
iOS stays on the deprecated call, which still works and is what v26 ships.

## 2026-08-27 — `blocked` is a state of its own, not a kind of `denied`
**Chose:** A four-member status — `granted`, `denied`, `blocked`,
`unavailable` — rather than a boolean or a pass-through of Firebase's
`AuthorizationStatus`
**Over:** Returning `boolean`, or re-exporting the SDK's numeric status
**Why:** The difference between "said no" and "said no and cannot be asked
again" is the difference between two entirely different pieces of product
behavior: one can ask later, the other has to send the user to the system
settings app. On iOS the system prompt is shown **once ever**, so
`AuthorizationStatus.DENIED` after a request is permanent in-app; on Android
`never_ask_again` is the same thing. A boolean erases that distinction at the
one point where it is knowable. Firebase's own numbers were rejected because
they are iOS-shaped — Android never produces `PROVISIONAL` or `EPHEMERAL` —
and because they would put the vendor's enum in every call site, which is what
the wrapper exists to prevent. `unavailable` is separate again: it means the
question was never asked, which is what a caller sees in Jest and in a build
with no Firebase config.
**Trade-off:** Four cases to handle where most call sites only care whether
they got a token, and two of them (`denied` vs `blocked`) cannot be told apart
on iOS before the first prompt — `NOT_DETERMINED` is reported as `denied`,
which is true but understates it. Callers that only want a yes/no now have to
write the comparison themselves.

## 2026-08-27 — A notification payload names a destination; it never carries one
**Chose:** `data.route` is a key into a hard-coded allow-list in `targets.ts`,
whose values are built from `ROUTES` in `@/lib/navigation`
**Over:** (a) treating `data.route` as a path and handing it to the router;
(b) validating a path against the `ROUTES` values by comparison; (c) using
Expo Router's URL deep-linking and letting the payload carry a `link`
**Why:** The payload is attacker-shaped input: it comes over the network, and
in the general case the sender is not necessarily us. (a) makes every route in
the app — and every string that merely looks like one — reachable from outside.
(b) is better but still lets the payload determine the shape of what is
navigated to, and it cannot express a parameterized route without
concatenation, which is where path traversal comes back. Naming inverts the
trust: the payload's only power is to select from a list this app wrote, and a
name that is not on it means "just open the app". (c) hands the same problem to
a different layer and adds a URL parser to the attack surface. The allow-list
also makes the deep-linkable surface reviewable in one screen, and leaving
`login` and `onboarding` off it is then a visible, deliberate omission rather
than an absence.
**Trade-off:** The backend and the app now share a contract that no type
system checks — a sender using a name this app does not carry gets a silent
"open the app" and no diagnostic. Every new deep-linkable destination is a code
change and a release, not a payload change, so a campaign cannot link to
something the shipped app does not already know about. And the parameter rule
(`^[\w-]{1,64}$`) is deliberately strict: a legitimate id containing a dot or a
slash would be refused.

## 2026-08-27 — Both hooks are mounted in the root layout, and permission is asked at startup
**Chose:** `useNotificationRegistration()` and `useNotificationDeepLinks()` in
`src/app/_layout.tsx`, alongside `useScreenTracking()`
**Over:** (a) mounting registration in `(app)/_layout.tsx`, so it runs only for
a signed-in user past onboarding; (b) a priming screen that explains the value
before the system prompt
**Why:** The deep-link hook has only one possible home — it needs the root
navigator, and a notification can start the app from any state, including
signed out. Registration was the genuine fork. (a) is the better *timing*: an
Android 13 prompt on the very first launch, before the user has seen anything,
is the pattern that gets refused, and a refusal on Android 13+ that turns into
`never_ask_again` is unrecoverable in-app. It was rejected because the token is
**device-scoped, not user-scoped** — it exists to address this installation,
and the backend associates it with an account when there is one — so gating it
behind sign-in delays it for no technical reason, and because this app's
startup side effects already live in the root layout by an existing decision
(`src/app/decisions.md`, 2026-08-25). (b) is the right answer and is out of
scope: it needs a screen, copy and a settings toggle, and a settings toggle was
excluded from this change by name.
**Trade-off:** The prompt lands at the worst moment for conversion, and the
`blocked` state it can produce is permanent without a trip to system settings —
so this choice costs real grant rate until a priming step exists. It is the
first thing to revisit when notifications get a user-facing surface.

## 2026-08-27 — A foreground message is observed and deliberately not acted on
**Chose:** Subscribe to `onMessage`, log in `__DEV__`, and navigate nowhere
**Over:** (a) not subscribing at all; (b) navigating on a foreground message
the same way as on a tap
**Why:** (b) is wrong on the facts: neither platform displays a notification
while the app is in the foreground, so there was no tap — navigating would mean
the app moving a user who is mid-task because a server sent something. (a)
looks equivalent but is not: the subscription is the seam where a foreground
presentation would attach, and its absence reads as an oversight rather than as
the deliberate third case. Drawing something for the user is exactly the
"foreground notification rendering" that this change was scoped to exclude.
**Trade-off:** A message arriving in the foreground is, from the user's point
of view, lost — they are given no indication it happened. That is the visible
cost of leaving foreground rendering out, and it is the gap a banner component
would fill.

## 2026-08-27 — `messaging_auto_init_enabled` is left at its default
**Chose:** Change nothing in the root `firebase.json`
**Over:** Setting `messaging_auto_init_enabled: false` and calling
`setAutoInitEnabled(true)` only once permission is granted
**Why:** With auto-init on, the SDK can obtain an FCM token before the user has
been asked anything, which is a device-scoped identifier created without
consent — a real argument for turning it off. It was left alone because that is
a consent-management decision with app-wide reach, of a piece with the
analytics and Crashlytics collection flags that sit in the same file, and this
change was scoped to permission, token and deep link. Deciding it here would
settle a broader question by side effect.
**Trade-off:** Until it is revisited, a user who refuses the permission prompt
may still have had a token minted for them. Nothing sends it anywhere — the
upload is a stub, and `registerForPushNotifications` returns before asking for a
token when permission is not granted — but it exists on the device.

## 2026-08-27 — Failures are swallowed and reported in the return value
**Chose:** `attempt`/`attach` helpers that answer a fallback on a missing
module, a synchronous throw or a rejected promise; every exported function
resolves
**Over:** Letting the SDK's errors propagate to the caller
**Why:** This follows the `run` helper in `@/lib/analytics` and
`@/lib/crash-reporting` for the same reason those have it: the module is
mounted in the root layout, so a throw takes the whole app down, and the most
likely failure in this repo is the expected one — the Firebase config files are
placeholders, so `getToken` genuinely does fail on every build here. A wrapper
whose normal case crashed the app would be unusable. Unlike telemetry, though,
these calls have results a caller needs, so the helper returns a fallback
rather than returning nothing.
**Trade-off:** The same one telemetry pays: a misconfigured integration is
invisible. `null` token and `unavailable` are returned identically whether the
cause is Jest, a missing native module, or real credentials that stopped
working — the caller cannot tell a healthy "not applicable" from a genuine
outage, and only the `__DEV__` breadcrumbs distinguish them.

## 2026-08-27 — Adding messaging means adding a fourth iOS codegen patch
**Chose:** `patches/@react-native-firebase__messaging@26.3.2.patch`, registered
in `pnpm-workspace.yaml`, stripping `::Builder` from both
`ModuleConstants<JS::NativeRNFBTurboMessaging::Constants::Builder>` declarations
in `ios/RNFBMessaging/RNFBMessagingModule.mm`
**Over:** (a) taking the package unpatched; (b) waiting for an upstream release
that fixes the signature; (c) not adding the package at all
**Why:** 26.3.2 declares its TurboModule constants with a template signature
React Native 0.81 no longer generates, and the Objective-C++ then fails to
compile. `c4314c2` (2026-08-26) fixed exactly this for `app`, `crashlytics` and
`remote-config` — iOS had never compiled in this repo before it. Messaging
carries the identical defect, so (a) is not "unpatched but working", it is
reintroducing the build failure that was fixed the day before, and it would not
have shown up in CI, which never builds native. (b) leaves iOS broken for an
unknown period on someone else's release schedule. (c) was not available: the
package is the approved stack for this feature.
**Trade-off:** A fourth hand-maintained patch, pinned to the exact version by
its filename and by the hash in the lockfile. A version bump invalidates it and
`pnpm install` fails loudly — which is the good failure — but somebody then has
to re-derive it, and the patch must be dropped rather than reapplied once
upstream fixes the signature, with nothing to signal when that happens. The
patch also touches only the `.mm`; the `::Builder` constructor definitions in
the generated header are legitimate and stay, so "zero `Constants::Builder`
under the package" is the wrong check — the right one is zero
`ModuleConstants<…::Builder>`, which is what the other three satisfy too.
