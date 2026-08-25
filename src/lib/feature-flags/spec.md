# feature-flags — current behavior

## What this feature does
The app's only wrapper around `@react-native-firebase/remote-config`. It exposes
a closed map of flags with the defaults the app ships with, one startup call,
and three readers. The values a session uses are fixed before the first screen
renders and do not change until the app is launched again, so a flag cannot flip
under a user's fingers mid-session. Every read is synchronous and total: it
returns a value of the declared type, never throws, and never needs the caller
to branch on whether Firebase is configured.
`@react-native-firebase/remote-config` is imported here and nowhere else in
`src/`.

## Remote Config is not authorization
**Never gate access, entitlements, or anything a user could profit from
bypassing on a flag.** A Remote Config payload is delivered to the device in
full, is readable by anyone who inspects the app or its traffic, and is served
from a local cache that the user's device controls. A flag says *which product
experience to render*; it never says *what this user is allowed to do*. That
answer belongs to the server, on the request that performs the action.

The API is kept to product toggles to hold the line: values are `boolean`,
`number` or `string`, there is no notion of a user or a role, and nothing here
is awaited by a call site that could mistake it for a permission check.

## The flag map
- `src/lib/feature-flags/flags.ts` declares `FEATURE_FLAG_DEFAULTS`: every flag
  the app may read, mapped to the value it takes when Remote Config has nothing
  to say. The map is `as const`, and the keys are the keys published in the
  Firebase console.
- These defaults ship inside the binary, so first launch, offline launch, a
  build with no Firebase config and Jest all behave like a correct app rather
  than an unconfigured one.
- A key that is not declared cannot be read — a console-only flag is a compile
  error at the call site, not a silent `false`.
- Literal defaults are widened to their primitive: declaring `false` types the
  flag as `boolean`, because the point of the flag is that the server can change
  it.
- Flags declared today are **placeholders**: `example_new_feed_layout_enabled`
  (`false`) and `example_feed_page_size` (`20`). This repository is a template;
  nothing reads them and no behavior is built on them.

## Behavior
- `initializeFeatureFlags()` runs the startup sequence, in this order:
  1. publish `FEATURE_FLAG_DEFAULTS` as the SDK's in-app defaults, and apply the
     fetch settings;
  2. `activate()` — promote the values downloaded on a **previous** launch, so
     the session's values are settled before anything renders;
  3. start a fetch **for the next launch**, which is not awaited and whose
     result is never activated in this session.
- **Nothing activates mid-session.** The module exposes no way to promote the
  background fetch, and `initializeFeatureFlags()` is idempotent for the life of
  the process: a second call resolves with the first call's result and does not
  activate again. A change published in the console therefore reaches a user on
  the second launch after publishing, at the earliest.
- `initializeFeatureFlags()` **resolves rather than rejects on every failure** —
  a missing or unlinked native module, an uninitialized Firebase app, a rejected
  `activate()`, a fetch that fails or never settles. A configuration problem
  cannot stop the app from booting. After a failure every read falls back to
  `FEATURE_FLAG_DEFAULTS`.
- The fetch's rejection is caught, so a failed background fetch cannot surface
  as an unhandled rejection.
- `getFeatureFlagValue(key)` returns the flag's current value, typed as the
  widened type of its default.
- `isFeatureEnabled(key)` returns a `boolean` and accepts **only** flags
  declared with a boolean default. Asking whether a numeric flag is "enabled"
  does not compile.
- `useFeatureFlag(key)` returns the same value for a React call site. A
  component that mounted before initialization finished re-renders exactly once,
  when activation lands; after that the value is fixed for the session.
- **Reads fall back to the shipped default** when the SDK reports the value's
  source as `static` — meaning it holds nothing for that key, because defaults
  have not been published yet or the key is unknown to it. Without that check
  such a read would answer `false` / `0` / `''` instead of what the app ships.
- A numeric flag whose remote value is not a number reads as the default rather
  than `NaN`. An empty string reads as the default, because Remote Config cannot
  distinguish "set to empty" from "not set".
- **Nothing throws into the caller.** A missing native module, a throwing
  `require`, and a throwing native read are all swallowed and answered with the
  default.
- The native module is resolved on **every** call and the result is not cached.
  A read made before the default Firebase app is initialized falls back, and the
  next read after initialization works.

## Entry points
- `FEATURE_FLAG_DEFAULTS`, `initializeFeatureFlags`, `getFeatureFlagValue`,
  `isFeatureEnabled`, `useFeatureFlag`, and the `FeatureFlagKey` /
  `FeatureFlagValue` / `BooleanFeatureFlagKey` types, from `@/lib/feature-flags`.
- **This module wires itself in nowhere.** `initializeFeatureFlags()` is
  exported for the root layout to await during startup; the module does not
  mount or schedule itself.

## Platform differences
- None in this module. iOS and Android divergence is handled inside the Firebase
  SDK.

## Out of scope
- Activating a fetch mid-session, `fetchAndActivate`, and the `onConfigUpdate`
  real-time listener. All three would change flags under a running session,
  which is the one thing this module is built to prevent.
- Targeting inputs: `setCustomSignals`, user properties, and any per-user
  conditions. Conditions are configured in the Firebase console against
  Analytics audiences, not from here.
- Reading `lastFetchStatus`, `fetchTimeMillis`, or exposing whether the current
  values came from the network — nothing in the app asks, and surfacing it would
  invite branching on freshness.
- `getAll`, `setDefaultsFromResource`, `reset`, and `setLogLevel`.
- JSON-valued flags. Values are `boolean`, `number` or `string`; a structured
  payload would need a parse-and-validate step this module does not have.
- Persisting or overriding a flag locally — there is no debug menu to force a
  value on a device.
