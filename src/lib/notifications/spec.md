# notifications — current behavior

## What this module does
The app's only wrapper around `@react-native-firebase/messaging`. It covers two
things and nothing else: **getting permission and a device token**, and
**navigating when a notification is opened**. Every function resolves rather
than throws, and every one is a no-op when the native module is not there, so a
caller never branches on the environment.
`@react-native-firebase/messaging` is imported here and nowhere else in `src/`.

The module reaches that package through `require()` at call time, typed by
`MessagingApi` — a `Pick` of the package's own module type naming the eight
modular exports used. Nothing a caller can observe depends on this: it is what
makes an upstream rename or signature change a compile error here instead of a
runtime one.

## Nothing here proves a notification was delivered
The Firebase config files in `firebase/<env>/` are placeholders with fabricated
keys (see `firebase/README.md`). FCM registers against a project that does not
exist, so **`getDeviceToken()` answers `null` on every build in this repo** and
no message can arrive. That is the designed-for case, not a broken one: the
permission flow, the `null`-token path and the payload validation all run and
are observable, and the delivery half cannot be exercised until real
credentials are in place.

## Permission
`NotificationPermissionStatus` is `'granted' | 'denied' | 'blocked' |
'unavailable'`.

- `granted` — notifications may be posted.
- `denied` — refused, but the user can still be asked again.
- `blocked` — refused in a way no further call can change. Only the system
  settings app can. This is a real state to design for, not an error.
- `unavailable` — the question could not be asked: no native module, or the
  native call failed.

- `requestNotificationPermission()` asks, and returns the outcome.
  - **Android 33+**: requests `POST_NOTIFICATIONS` through React Native's own
    `PermissionsAndroid`. `never_ask_again` maps to `blocked`.
  - **Android below 33**: there is nothing to request — the grant is implicit
    at install — so it reports whether notifications are currently enabled.
  - **iOS**: the package's `requestPermission()`. `AUTHORIZED`, `PROVISIONAL`
    and `EPHEMERAL` are all `granted`; `NOT_DETERMINED` is `denied` because the
    prompt has not been shown yet and asking can still work; `DENIED` is
    `blocked`, because iOS shows its prompt **once ever**.
  - Calling it twice does not guarantee two prompts. Both platforms show one at
    most once, so a second call after a refusal returns the refusal with no UI.
- `getNotificationPermissionStatus()` reports the current state **without**
  prompting, through the SDK's `hasPermission()`. On Android that reflects
  whether notifications are enabled at all, which covers both the API 33 grant
  and a user switching them off on any version.
- **Android's permission does not go through the package.** Its Android
  `requestPermission()` resolves `AUTHORIZED` unconditionally and shows nothing
  — see `decisions.md`. Using it would be a silent no-op on every device from
  Android 13 onward.

## The device token
- `getDeviceToken()` returns the FCM registration token, or `null` — for a
  failed call, an absent native module, or an empty string.
- `registerForPushNotifications()` asks for permission and, only if it is
  granted, fetches the token and hands it to the upload. It resolves
  `{ status, token }` in every case, including refusal and failure.
- `subscribeToTokenRefresh()` re-uploads on rotation and returns an
  unsubscribe. A rotated token invalidates the previous one, so registering
  only at startup would silently stop delivery the first time FCM rotates.
- **A device token is sensitive** — anyone holding one can push to that device.
  It is never logged, never sent to analytics or Crashlytics, and never
  snapshotted. The `__DEV__` breadcrumbs name the platform and app version only.

### The upload is a stub, on purpose
There is no backend endpoint yet, so `uploadDeviceToken` logs in `__DEV__` and
does nothing else. It does not call a URL. The contract it will satisfy is
already fixed, so wiring it is one function body:

```
POST {EXPO_PUBLIC_API_URL}/devices/push-token
Authorization: Bearer <Clerk session token>
body:     DeviceTokenRegistration = { token, platform, appVersion }
201/204:  stored, associated with the caller's account
401:      not signed in — drop it, the next launch re-sends
```

The endpoint must be idempotent on `token`: registration runs on every cold
start and again on every rotation, so the same value arrives repeatedly. The
request goes through the client in `@/lib/api`, never a hand-rolled `fetch`.

## Opening a notification
A tapped notification reaches the app three different ways, and they are three
separate APIs rather than one event. `useNotificationDeepLinks()` handles all
three:

| Situation | API | What happens |
|---|---|---|
| App in the foreground | `onMessage` | Observed; **never navigates** |
| App backgrounded, then tapped | `onNotificationOpenedApp` | Navigates |
| App not running, started by the tap | `getInitialNotification` | Navigates |

- The **foreground** case does not navigate because nothing was tapped: neither
  platform displays a notification while the app is in front, so moving a user
  who is mid-task would be the app acting on its own. Rendering an in-app
  notification is out of scope — see below.
- The **cold-start** case is delivered as *initial state*, once, and no
  subscription reports it. An integration that only listens for the
  background-tap event opens on the wrong screen every time the app was not
  already running.
- Navigation waits for the root navigator. On a cold start the message is known
  before there is anything to navigate, so the target is held and flushed the
  moment the navigator mounts.
- `router.navigate` is used, not `push`, so a repeated tap does not stack
  duplicate screens.

## The payload is untrusted
A push payload arrives from the network and nothing validates it on the way in.
`resolveNotificationTarget(data)` therefore never *builds* a route from it — the
payload only **names** one:

```json
{ "data": { "route": "post", "id": "42" } }
```

- `data.route` names a key in an allow-list of destinations. The allow-list
  resolves the name through `ROUTES` in `@/lib/navigation`; no path string is
  ever written or concatenated here.
- Destinations today: `home`, `settings`, `style`, `addPost`, `post` (which
  needs an `id`).
- `login` and `onboarding` are deliberately **not** reachable. They are where
  the `(app)` guard sends a user, and a push that could open either would be a
  way to fake a sign-out.
- A route parameter must match `^[\w-]{1,64}$`. Slashes, dots and whitespace
  are refused, so a value cannot climb out of the segment it fills.
- Only string values are read from `data`; anything else — a number, a parsed
  object, `null` — is dropped rather than coerced.
- The name is looked up with `Object.hasOwn`, so `constructor`, `toString` and
  `__proto__` resolve to nothing.
- Anything that does not resolve answers `null`, and `null` means **just open
  the app**. An unknown route, a missing route, a bad parameter and a payload
  that is not an object are all ordinary, not errors.

## Entry points
- `useNotificationRegistration`, `useNotificationDeepLinks`,
  `requestNotificationPermission`, `getNotificationPermissionStatus`,
  `getDeviceToken`, `registerForPushNotifications`, `subscribeToTokenRefresh`,
  `resolveNotificationTarget` and the types, from `@/lib/notifications`.
- **This module mounts nothing itself.** Both hooks are mounted by
  `src/app/_layout.tsx`, which is also the only place they can be: the deep-link
  hook needs the root navigator.

## Platform differences
- Permission is the whole of it, and it is described above. The split lives in
  this module; no feature or component sees a `Platform` check for it.
- **The native side is set up by autolinking, not by the config plugin.**
  `POST_NOTIFICATIONS`, `com.google.android.c2dm.permission.RECEIVE` and the
  messaging services and receiver all come from the library's own AAR manifests
  through the Gradle manifest merge. None of them is declared anywhere in this
  repo, and `aapt2 dump permissions` on the built debug APK shows both
  permissions present.
- The `@react-native-firebase/messaging` config plugin is in `app.config.ts`,
  but its **only** job is the Android `default_notification_icon` and
  `default_notification_color` meta-data. No icon is configured, so it currently
  writes nothing: `expo config --type introspect` contains zero occurrences of
  either key or of `POST_NOTIFICATIONS`. It contributes nothing on iOS in this
  configuration. The entry is kept for the icon/colour hook and so the plugin
  list matches the installed packages.
- iOS additionally needs an APNs key uploaded to the Firebase project and the
  Push Notifications capability on a real device. Neither is set up here, and
  neither can be with placeholder credentials.

## Out of scope
- **Foreground notification rendering.** A message arriving while the app is in
  front is observed and dropped. Nothing draws a banner, a toast or an in-app
  alert.
- **Badges and unread counts.** Nothing sets an app-icon badge or tracks a
  read state.
- **Notification categories, channels and rich media.** No custom Android
  channel is created, no iOS category or action button is registered, and no
  image or attachment is handled.
- **The Android notification icon.** No `default_notification_icon` is
  configured, and the config plugin warns about it on every `expo config` /
  `prebuild` run: *"For Android 8.0 and above, it is necessary to set the
  notification icon to ensure correct display."* A delivered notification would
  therefore render with the full-colour app icon instead of the white
  silhouette Android 8+ expects. This is a real gap, left open deliberately:
  the silhouette is an asset someone has to design, and picking one is not a
  call this change should make. Fixing it means adding the asset and passing
  `['@react-native-firebase/messaging', { android: { notificationIcon, notificationColor } }]`
  in `app.config.ts`. Nothing here has been able to display a notification, so
  the wrong icon has not been observed — it is read off the plugin's own rule.
- **A settings toggle.** There is no user-facing switch for notifications, and
  nothing persists a preference. `blocked` sends the user to the system
  settings app; nothing here links them there.
- **Background message handling.** `setBackgroundMessageHandler` is not
  registered, so a data-only message does not wake the app to run JavaScript.
- **Topics.** `subscribeToTopic` / `unsubscribeFromTopic` are not exposed.
- **Consent-gated auto-init.** `messaging_auto_init_enabled` is left at its
  default, so the SDK may obtain a token before permission is asked. Changing
  that is a consent decision — see `decisions.md`.
- **Proving delivery.** Nothing here can, and nothing here claims to.
