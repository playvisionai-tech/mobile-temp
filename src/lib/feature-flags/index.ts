import type {
  RemoteConfig,
  RemoteConfigSettings,
  Value,
} from '@react-native-firebase/remote-config';
import type {
  BooleanFeatureFlagKey,
  FeatureFlagKey,
  FeatureFlagValue,
} from './flags';

import { useSyncExternalStore } from 'react';

import { FEATURE_FLAG_DEFAULTS } from './flags';

export * from './flags';

/**
 * The slice of the Remote Config modular API this wrapper uses. Declaring it
 * here rather than deriving it from the package keeps the surface we depend on
 * visible in one place, and lets `loadApi` type its `require` result.
 *
 * `defaultConfig` and `settings` are not functions in the modular API — they
 * are property setters on the instance, matching the Firebase JS v9 shape.
 */
type RemoteConfigApi = {
  getRemoteConfig: () => RemoteConfig;
  activate: (remoteConfig: RemoteConfig) => Promise<boolean>;
  fetchConfig: (remoteConfig: RemoteConfig) => Promise<void>;
  getValue: (remoteConfig: RemoteConfig, key: string) => Value;
};

/**
 * How stale a cached config may be before a launch is allowed to fetch again.
 *
 * A change published in the console reaches a user on the *second* launch after
 * publishing at the earliest, because this module fetches for the next launch
 * and never activates mid-session. One hour keeps the second half of that delay
 * short without fetching on every cold start; see `decisions.md`.
 */
const MINIMUM_FETCH_INTERVAL_MILLIS = 60 * 60 * 1000;

/** In development, never throttle: waiting an hour to see a flag change is not a workflow. */
const MINIMUM_FETCH_INTERVAL_DEV_MILLIS = 0;

/**
 * How long one fetch may run. Generous, because nothing waits on it — the
 * result is for the next launch — so a slow network should be given the chance
 * to finish rather than be cut off and leave the cache another launch behind.
 */
const FETCH_TIMEOUT_MILLIS = 30 * 1000;

/**
 * `getValue` reports where a value came from. `static` means the SDK holds no
 * value for the key at all — it has not been given our defaults yet, or the key
 * is not one we declared — and its `asBoolean()`/`asNumber()` would answer
 * `false`/`0` rather than what this app ships. Those reads fall back to
 * `FEATURE_FLAG_DEFAULTS` instead.
 */
const STATIC_SOURCE = 'static';

/** Set once the startup sequence has finished, successfully or not. */
let initialization: Promise<void> | null = null;

/** `useFeatureFlag` subscribers, notified once when activation lands. */
const listeners = new Set<() => void>();

/**
 * Resolve the native module, or `null` when it is not there — Jest, a build
 * without the Firebase config, or any point before the default app has been
 * initialized. Deliberately not memoized: a failure here is often "too early",
 * not "never", and caching the miss would pin the app to its defaults for the
 * rest of the process.
 */
function loadApi(): RemoteConfigApi | null {
  try {
    const api = require('@react-native-firebase/remote-config') as RemoteConfigApi | undefined;
    return typeof api?.getRemoteConfig === 'function' ? api : null;
  }
  catch {
    return null;
  }
}

function settings(): RemoteConfigSettings {
  return {
    minimumFetchIntervalMillis: __DEV__
      ? MINIMUM_FETCH_INTERVAL_DEV_MILLIS
      : MINIMUM_FETCH_INTERVAL_MILLIS,
    fetchTimeoutMillis: FETCH_TIMEOUT_MILLIS,
  };
}

function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Publish the in-app defaults, promote the values fetched on a previous launch,
 * and start a fetch for the next one.
 *
 * The order is the design. `activate()` promotes what was already sitting in
 * the cache, so the values a user gets are the ones downloaded last time —
 * fixed for the whole session before the first screen renders. The fetch that
 * follows is deliberately **not** awaited and its result is **never** activated
 * here, so no flag can change under a user mid-session.
 */
async function start(): Promise<void> {
  const api = loadApi();
  if (api === null) {
    return;
  }

  try {
    const remoteConfig = api.getRemoteConfig();

    // Defaults first: activate() must not be able to leave a key unanswered,
    // and the setter updates the instance synchronously, so reads made before
    // the native call lands already see this app's baseline.
    remoteConfig.settings = settings();
    remoteConfig.defaultConfig = { ...FEATURE_FLAG_DEFAULTS };

    await api.activate(remoteConfig);

    // For the next launch. Not awaited, so a slow or dead network cannot hold
    // up startup, and not activated, so it cannot change this session.
    api.fetchConfig(remoteConfig).catch(() => {});
  }
  catch {
    // Remote Config is unavailable or misconfigured. Every read falls back to
    // FEATURE_FLAG_DEFAULTS, which is a correct app, just not a configured one.
  }
}

/**
 * Prepare Remote Config for the session. Call once, as early as possible —
 * ideally awaited before the first screen renders, so nothing reads a flag that
 * is about to change.
 *
 * Resolves rather than rejects on every failure, including a missing native
 * module: a configuration problem must not stop the app from booting.
 *
 * Idempotent by design, not just for safety. A second call would run
 * `activate()` again and promote whatever the background fetch had since
 * downloaded — the mid-session flip this module exists to prevent — so later
 * calls resolve with the first call's result and do nothing else.
 */
export async function initializeFeatureFlags(): Promise<void> {
  initialization ??= start().then(notify);
  return initialization;
}

/** Read one value through the SDK, falling back to the shipped default. */
function read<TKey extends FeatureFlagKey>(key: TKey): FeatureFlagValue<TKey> {
  // The declared default *is* the flag's value type, just narrower: the map is
  // `as const`, so this reads as `false` where the flag's type is `boolean`.
  // The compiler cannot follow that relation through the generic, so the
  // widening `FeatureFlagValue` performs at the type level is asserted here.
  const fallback = FEATURE_FLAG_DEFAULTS[key] as unknown as FeatureFlagValue<TKey>;

  try {
    const api = loadApi();
    if (api === null) {
      return fallback;
    }

    const value = api.getValue(api.getRemoteConfig(), key);
    if (value.getSource() === STATIC_SOURCE) {
      return fallback;
    }

    switch (typeof fallback) {
      case 'boolean':
        return value.asBoolean() as FeatureFlagValue<TKey>;
      case 'number': {
        // A remote value that is not a number at all reads as NaN, which would
        // poison arithmetic far from here. The default is the safer answer.
        const parsed = value.asNumber();
        return (Number.isFinite(parsed) ? parsed : fallback) as FeatureFlagValue<TKey>;
      }
      default: {
        // Remote Config cannot distinguish "set to empty" from "not set", so an
        // empty string is treated as absent rather than as a deliberate blank.
        const parsed = value.asString();
        return (parsed.length > 0 ? parsed : fallback) as FeatureFlagValue<TKey>;
      }
    }
  }
  catch {
    return fallback;
  }
}

/**
 * The current value of a flag. Synchronous and total: it always returns a value
 * of the declared type, and never throws, whatever state Remote Config is in.
 *
 * **Not an authorization check.** See `spec.md` — the value is client-visible,
 * user-tamperable, and belongs to product toggles only.
 */
export function getFeatureFlagValue<TKey extends FeatureFlagKey>(
  key: TKey,
): FeatureFlagValue<TKey> {
  return read(key);
}

/**
 * Whether an on/off flag is on. Accepts only flags declared with a boolean
 * default; anything else is a compile error.
 *
 * **Not an authorization check** — see `getFeatureFlagValue`.
 */
export function isFeatureEnabled(key: BooleanFeatureFlagKey): boolean {
  return read(key);
}

/**
 * The value of a flag, for a React call site. Returns the same value
 * `getFeatureFlagValue` would, and re-renders exactly once — when the startup
 * activation lands — for a component that mounted before initialization
 * finished. After that the value is fixed for the session.
 */
export function useFeatureFlag<TKey extends FeatureFlagKey>(key: TKey): FeatureFlagValue<TKey> {
  // The same reader serves the client and the static-render snapshot: reads are
  // synchronous and total, so there is nothing for a server pass to do
  // differently.
  const snapshot = () => read(key);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
