# Firebase client config

One Firebase app per environment, per platform. `env.ts` picks the directory
from `EXPO_PUBLIC_APP_ENV` and `app.config.ts` passes it to
`ios.googleServicesFile` / `android.googleServicesFile`.

| Environment | Bundle id / package |
|---|---|
| `development` | `com.obytes.development` |
| `preview` | `com.obytes.preview` |
| `production` | `com.obytes` |

**The files here are placeholders.** They are structurally valid so
`pnpm prebuild:*` succeeds, but every key is fake — nothing reports to Firebase
until they are replaced with real downloads from the Firebase console
(Project settings → Your apps → download `GoogleService-Info.plist` /
`google-services.json`). The bundle id inside each file must match the table
above or the native build fails.

These are **client** config files, not Admin service-account keys, so they are
committed deliberately. A Firebase Admin private key must never enter this repo.

Collection defaults (analytics auto-collection, Crashlytics, ad-id) are set in
the root `firebase.json`, not here.

## iOS linkage

`app.config.ts` passes `{ ios: { disableSPM: true } }` to the
`@react-native-firebase/app` plugin and sets
`['expo-build-properties', { ios: { useFrameworks: 'static' } }]`. Both are
load-bearing, and the two failures they fix are worth knowing:

1. **SPM + static linkage is unsupported.** `firebase-ios-sdk`'s Swift Package
   products are automatic libraries, so each React Native Firebase pod embeds
   its own copy and they collide as duplicate symbols. Opting out of SPM keeps
   CocoaPods resolving Firebase; the alternative was moving the whole app to
   dynamic linkage, which changes every other pod too.
2. **Static *libraries* cannot import Firebase's Swift pods.**
   `FirebaseCrashlytics`, `FirebaseRemoteConfig` and friends depend on
   `GoogleUtilities`/`nanopb`, which define no modules. Static *frameworks*
   carry module maps, so `useFrameworks: 'static'` resolves it without
   `use_modular_headers!` in a Podfile that prebuild regenerates anyway.

Removing either one breaks `pod install`, not the JavaScript.
