# feature-flags — decisions

## 2026-08-25 — Activate at startup, fetch for the next launch
**Chose:** `initializeFeatureFlags()` publishes defaults, calls `activate()` to
promote what a *previous* launch downloaded, then starts an un-awaited
`fetchConfig()` whose result is never activated in this session
**Over:** `fetchAndActivate()` at startup, or subscribing to `onConfigUpdate`
for real-time flag delivery
**Why:** A flag that changes mid-session changes the app under someone's hands:
a screen re-renders into a different layout between two taps, a list's page size
changes between two pages, and a bug report describes an app that no longer
exists. Fixing the values for the whole session makes a session reproducible.
Awaiting a fetch at startup has the second problem — it puts the network on the
critical path to the first screen, so a slow connection becomes a slow launch,
and a failed one still ends at the same defaults.
**Trade-off:** Freshness, deliberately. A change published in the console
reaches a user on the **second** launch after publishing at the earliest: launch
one downloads it, launch two activates it. There is no way to push an urgent
change quickly, so a flag is not a kill switch — anything needing immediate
effect has to be enforced server-side on the request itself.

## 2026-08-25 — `initializeFeatureFlags()` is idempotent, and nothing else can activate
**Chose:** A module-level latch, so the second and later calls resolve with the
first call's promise and do not activate; no `activate`, `fetchAndActivate` or
`refresh` is exported
**Over:** Letting the caller decide how often to initialize, and exporting a
manual refresh for a pull-to-refresh or an app-foreground handler
**Why:** The one-launch delay above is only a guarantee if activation happens
once. A second `activate()` — from a duplicate call in a remounting layout, or
from a well-meaning "refresh flags on foreground" — would promote whatever the
background fetch had since downloaded, which is exactly the mid-session flip the
design exists to prevent. Making the *module* enforce it, rather than
documenting "call this once", means the guarantee does not depend on every
future call site reading the spec.
**Trade-off:** The latch is process-global state that cannot be reset, so a test
needs a fresh module registry to exercise startup, and the module cannot support
a legitimate future case — a debug menu that reloads flags on demand — without
reopening this decision.

## 2026-08-25 — `minimumFetchIntervalMillis` of one hour, and zero in development
**Chose:** One hour in production, `0` when `__DEV__`, with a 30-second fetch
timeout
**Over:** The SDK's 12-hour default, or a much shorter interval in both
**Why:** The throttle decides whether a given launch refreshes the cache at all,
and it compounds with the one-launch activation delay. At the SDK's 12 hours, a
user who opens the app several times a day still refreshes twice a day, so a
flag change can take well over a day to reach them. One hour keeps propagation
to roughly "the next launch an hour from now" while still skipping the network
on the repeated cold starts that happen within a single sitting. Zero in
development is because waiting an hour to see a flag change is not a workflow;
Firebase throttles the *server* side for a device that fetches too often, which
is a development-only annoyance and a production risk, so the aggressive setting
stays behind `__DEV__`. The 30-second timeout is generous on purpose: nothing
waits on this fetch, so a slow network should be given the chance to finish
rather than be cut off and leave the cache another launch behind.
**Trade-off:** More network calls, and more battery and data, than the SDK
default. Development and production also no longer fetch on the same schedule,
so a throttling problem is one of the things that will not reproduce locally.

## 2026-08-25 — A value whose source is `static` falls back to the in-app map
**Chose:** `read()` checks `getSource()` and returns `FEATURE_FLAG_DEFAULTS[key]`
when the SDK reports `static`
**Over:** Trusting `asBoolean()` / `asNumber()` / `asString()` for every read
**Why:** `static` means the SDK holds no value for the key — the in-app defaults
have not been published yet, or the key is not one it knows — and in that state
its getters answer `false`, `0` and `''` rather than failing. Those are
plausible-looking values, so without the check a read taken before
`initializeFeatureFlags()` finishes would silently disagree with the defaults
the app ships, and the bug would look like a flag that was off for some users.
Keeping the shipped map as the answer means the two paths agree.
**Trade-off:** A flag legitimately published as `false`, `0` or `""` is
indistinguishable from an unset one at the point where it matters most, and the
module carries two sources of truth for a default — the in-app map and whatever
the SDK holds — that have to be kept in step by `initializeFeatureFlags()`
publishing the map.

## 2026-08-25 — Flags are typed against the defaults map, and `isFeatureEnabled` takes booleans only
**Chose:** `FEATURE_FLAG_DEFAULTS` as the single declaration, with literal
defaults widened to their primitive, and a `BooleanFeatureFlagKey` union
restricting `isFeatureEnabled`
**Over:** `isFeatureEnabled(key: string)` with the defaults documented in the
spec
**Why:** A flag key is a string that exists in two places — this app and a
console — and the failure mode is a typo that reads as "off" forever while
looking like a working integration. Deriving the key union and the value type
from the shipped defaults means a flag cannot be read without being declared
with a default, which is the same thing as saying the app must always know how
to behave without the network. Widening the literal matters because `as const`
would otherwise type a flag defaulting to `false` as `false`, making the one
branch that flag exists to enable unreachable.
**Trade-off:** Every new flag is a change to a shared file and a compile-time
coupling to the console; a flag cannot be added to the console and read the same
day without shipping a build. The widening also needs a conditional type that is
harder to read than the map it operates on.

## 2026-08-25 — Reads are synchronous and never signal failure
**Chose:** `getFeatureFlagValue` / `isFeatureEnabled` return a value
synchronously, swallow every error, and resolve the native module per call
**Over:** Returning `undefined` or a `{ value, isReady }` pair when Remote
Config has not settled, or throwing when it is unavailable
**Why:** These are read in render, where an async or failable answer would push
a loading state into every call site that wants a flag — and the honest answer
is never "unknown": the app always has a default it is prepared to run on. One
total function keeps a flag check a single expression. Resolving per call
matters for the same reason it does in `analytics` and `crash-reporting`: a
static import would evaluate the native module before the default Firebase app
is necessarily initialized, and a cached miss would pin the app to its defaults
for the rest of the process.
**Trade-off:** A misconfigured integration is invisible — the app runs happily
on defaults and looks healthy, and there is no signal anywhere that Remote
Config never loaded. A `require` on every read is also cheap rather than free.

## 2026-08-25 — `useFeatureFlag` subscribes rather than reading once
**Chose:** `useSyncExternalStore` over a module-level listener set that
`initializeFeatureFlags()` notifies once
**Over:** `useFeatureFlag` returning `getFeatureFlagValue(key)` directly, and
relying on the root layout to await initialization before rendering
**Why:** The values are fixed for the session, so a plain read is correct for
everything mounted after startup — but the module cannot make the root layout
await it, and a splash screen or an error boundary that renders during
initialization would otherwise be stuck on defaults with no way to catch up. One
notification at activation covers that without giving the module any ability to
change a flag later.
**Trade-off:** A store, a subscriber set and a subscription in every call site,
for a value that changes at most once and usually zero times — real machinery
for a narrow window. It also makes `useFeatureFlag` and `getFeatureFlagValue`
subtly different: the hook can observe the activation, the function can only
observe whatever is true when it is called.

## 2026-08-25 — Only the modular API is used
**Chose:** `getRemoteConfig()` / `activate(rc)` / `fetchConfig(rc)` /
`getValue(rc, key)` from the modular surface, with a locally declared
`RemoteConfigApi` type for the slice we call, and defaults and settings assigned
as properties on the instance
**Over:** The namespaced `firebase.remoteConfig().fetch()` form
**Why:** The namespaced API is deprecated from v22 and logs a warning on every
call. The modular surface has no `setDefaults` function — matching Firebase JS
v9, defaults and settings are property setters on the instance, which is why
this module assigns `remoteConfig.defaultConfig` and `remoteConfig.settings`
rather than calling anything. Those setters update the instance synchronously
and forward to native in the background, so a read taken immediately after the
assignment already sees the shipped defaults.
**Trade-off:** The local `RemoteConfigApi` type is a hand-maintained copy of
four signatures that will not fail loudly if the package changes them — only at
the next type-check. Assigning to a setter also means there is nothing to await:
the module cannot confirm the native side accepted the defaults, only that the
JavaScript instance did.
