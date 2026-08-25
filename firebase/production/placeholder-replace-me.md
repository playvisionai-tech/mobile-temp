# ⚠️ The Firebase config in this directory is FAKE

`GoogleService-Info.plist` and `google-services.json` here are placeholders.
Every API key, app id and project id in them is made up. They exist only so
`pnpm prebuild:production` and the native builds succeed.

**Firebase reports nothing while these files are in place.** Analytics events,
Crashlytics reports and Remote Config fetches all fail silently — no crash, no
error, an empty dashboard.

Replace both files with real downloads from the Firebase console for the
com.obytes app, then delete this file.

See `firebase/README.md`.
