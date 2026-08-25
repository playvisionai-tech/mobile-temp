import type * as FeatureFlags from '@/lib/feature-flags';

import { initializeFeatureFlags, useFeatureFlag } from '@/lib/feature-flags';
import { act, renderHook } from '@/lib/test-utils';

type ValueSource = 'remote' | 'default' | 'static';

type FakeValue = {
  asBoolean: () => boolean;
  asNumber: () => number;
  asString: () => string;
  getSource: () => ValueSource;
};

type FeatureFlagsModule = typeof FeatureFlags;

const NATIVE_MODULE = '@react-native-firebase/remote-config';

/**
 * The instance the fake `getRemoteConfig` hands back. `settings` and
 * `defaultConfig` are plain properties here, exactly as they are setters on the
 * real modular instance, so assigning to them is observable.
 */
const mockInstance: {
  settings?: { minimumFetchIntervalMillis: number; fetchTimeoutMillis: number };
  defaultConfig?: Record<string, string | number | boolean>;
} = {};

const mockNative = {
  getRemoteConfig: jest.fn(() => mockInstance),
  activate: jest.fn(() => Promise.resolve(true)),
  fetchConfig: jest.fn(() => Promise.resolve()),
  getValue: jest.fn((_instance: unknown, _key: string): FakeValue => staticValue()),
};

jest.mock('@react-native-firebase/remote-config', () => mockNative);

/** A `Value` whose source is `static`: the SDK holds nothing for this key. */
function staticValue(): FakeValue {
  return remoteValue('', 'static');
}

/** A `Value` carrying `raw`, as the SDK would report it after an activation. */
function remoteValue(raw: string | number | boolean, source: ValueSource = 'remote'): FakeValue {
  return {
    asBoolean: () => raw === true || raw === 'true' || raw === 1,
    asNumber: () => (typeof raw === 'number' ? raw : Number(raw)),
    asString: () => String(raw),
    getSource: () => source,
  };
}

/** Answer `getValue` per key, and fall back to `static` for anything else. */
function withValues(values: Record<string, FakeValue>): void {
  mockNative.getValue.mockImplementation(
    (_instance: unknown, key: string) => values[key] ?? staticValue(),
  );
}

/**
 * Run `body` against a package that loaded but exposes no modular API — the
 * shape `loadApi` sees on a build with no Firebase config.
 */
function withUnusableNativeModule(body: (flags: FeatureFlagsModule) => void): void {
  const { getRemoteConfig } = mockNative;
  mockNative.getRemoteConfig = undefined as unknown as typeof getRemoteConfig;
  try {
    body(loadFeatureFlags());
  }
  finally {
    mockNative.getRemoteConfig = getRemoteConfig;
  }
}

/**
 * A fresh copy of the module. `initializeFeatureFlags` is idempotent for the
 * life of the process, so every test that touches startup needs its own
 * instance rather than a shared one carrying the previous test's state.
 *
 * The `useFeatureFlag` tests deliberately use the statically imported module
 * instead: an isolated registry hands the module its own copy of React, which
 * the test renderer's hook dispatcher does not recognize.
 */
function loadFeatureFlags(): FeatureFlagsModule {
  let loaded: FeatureFlagsModule | undefined;
  jest.isolateModules(() => {
    loaded = require('@/lib/feature-flags') as FeatureFlagsModule;
  });
  return loaded as FeatureFlagsModule;
}

const originalDev = __DEV__;

function setDev(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', { value, configurable: true, writable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete mockInstance.settings;
  delete mockInstance.defaultConfig;
  mockNative.getRemoteConfig.mockImplementation(() => mockInstance);
  mockNative.activate.mockImplementation(() => Promise.resolve(true));
  mockNative.fetchConfig.mockImplementation(() => Promise.resolve());
  mockNative.getValue.mockImplementation(() => staticValue());
  setDev(false);
});

afterEach(() => {
  setDev(originalDev);
});

describe('the defaults map', () => {
  it('is what a read returns before anything has been fetched', () => {
    const { FEATURE_FLAG_DEFAULTS, getFeatureFlagValue } = loadFeatureFlags();

    expect(getFeatureFlagValue('example_new_feed_layout_enabled'))
      .toBe(FEATURE_FLAG_DEFAULTS.example_new_feed_layout_enabled);
    expect(getFeatureFlagValue('example_feed_page_size'))
      .toBe(FEATURE_FLAG_DEFAULTS.example_feed_page_size);
  });

  it('rejects a key it does not declare', () => {
    const { getFeatureFlagValue } = loadFeatureFlags();

    // @ts-expect-error 'checkout_v2' is not in FEATURE_FLAG_DEFAULTS.
    getFeatureFlagValue('checkout_v2');
  });

  it('rejects a non-boolean flag in isFeatureEnabled', () => {
    const { isFeatureEnabled } = loadFeatureFlags();

    // @ts-expect-error example_feed_page_size is a number, not a switch.
    isFeatureEnabled('example_feed_page_size');
  });

  it('widens a literal default so the flag is not typed as its default', () => {
    // `false as const` must not make the flag's type `false` — the server can
    // change it — so the read type is `boolean`. This fails to compile if the
    // widening is lost.
    const enabled: boolean = loadFeatureFlags()
      .getFeatureFlagValue('example_new_feed_layout_enabled');
    const shipped: (typeof FeatureFlags.FEATURE_FLAG_DEFAULTS)['example_new_feed_layout_enabled']
      = false;

    expect([enabled, shipped]).toStrictEqual([false, false]);
  });
});

describe('initializeFeatureFlags — the startup sequence', () => {
  it('publishes the in-app defaults before activating', async () => {
    const { FEATURE_FLAG_DEFAULTS, initializeFeatureFlags: initialize } = loadFeatureFlags();
    let defaultsWhenActivated: Record<string, unknown> | undefined;
    mockNative.activate.mockImplementation(() => {
      defaultsWhenActivated = mockInstance.defaultConfig;
      return Promise.resolve(true);
    });

    await initialize();

    expect(defaultsWhenActivated).toStrictEqual({ ...FEATURE_FLAG_DEFAULTS });
    expect(mockNative.activate).toHaveBeenCalledTimes(1);
  });

  it('activates the previous launch, then fetches for the next one', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();
    const order: string[] = [];
    mockNative.activate.mockImplementation(() => {
      order.push('activate');
      return Promise.resolve(true);
    });
    mockNative.fetchConfig.mockImplementation(() => {
      order.push('fetch');
      return Promise.resolve();
    });

    await initialize();

    expect(order).toStrictEqual(['activate', 'fetch']);
  });

  it('never activates what the startup fetch downloads', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();

    await initialize();
    // Let the fire-and-forget fetch settle. A second activate here would be the
    // mid-session flip this module exists to prevent.
    await new Promise(resolve => setImmediate(resolve));

    expect(mockNative.activate).toHaveBeenCalledTimes(1);
  });

  it('resolves without waiting for the fetch to finish', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();
    // A fetch that never settles — a dead network holding the connection open.
    mockNative.fetchConfig.mockImplementation(() => new Promise<void>(() => {}));

    await expect(initialize()).resolves.toBeUndefined();
    expect(mockNative.fetchConfig).toHaveBeenCalledTimes(1);
  });

  it('applies the production fetch interval and timeout', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();

    await initialize();

    expect(mockInstance.settings).toStrictEqual({
      minimumFetchIntervalMillis: 60 * 60 * 1000,
      fetchTimeoutMillis: 30 * 1000,
    });
  });

  it('does not throttle fetches in development', async () => {
    setDev(true);
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();

    await initialize();

    expect(mockInstance.settings?.minimumFetchIntervalMillis).toBe(0);
  });

  it('does the startup work once, however many times it is called', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();

    await initialize();
    await initialize();
    await initialize();

    expect(mockNative.activate).toHaveBeenCalledTimes(1);
    expect(mockNative.fetchConfig).toHaveBeenCalledTimes(1);
  });

  it('shares one promise between concurrent callers', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();

    await Promise.all([initialize(), initialize()]);

    expect(mockNative.activate).toHaveBeenCalledTimes(1);
  });
});

describe('initializeFeatureFlags — when startup fails', () => {
  it('resolves when activation fails, leaving reads on the defaults', async () => {
    const { getFeatureFlagValue, initializeFeatureFlags: initialize } = loadFeatureFlags();
    mockNative.activate.mockImplementation(() => Promise.reject(new Error('no network')));

    await expect(initialize()).resolves.toBeUndefined();
    expect(getFeatureFlagValue('example_feed_page_size')).toBe(20);
    // The fetch is never reached when activation threw first.
    expect(mockNative.fetchConfig).not.toHaveBeenCalled();
  });

  it('swallows a failing fetch rather than rejecting or leaking it', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();
    mockNative.fetchConfig.mockImplementation(() => Promise.reject(new Error('offline')));
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    await expect(initialize()).resolves.toBeUndefined();
    await new Promise(resolve => setImmediate(resolve));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });

  it('resolves when the native module throws on access', async () => {
    const { initializeFeatureFlags: initialize } = loadFeatureFlags();
    mockNative.getRemoteConfig.mockImplementation(() => {
      throw new Error('default app not initialized');
    });

    await expect(initialize()).resolves.toBeUndefined();
    expect(mockNative.activate).not.toHaveBeenCalled();
  });

  it('resolves when the native module is unusable', async () => {
    let startup: Promise<void> | undefined;
    withUnusableNativeModule((flags) => {
      startup = flags.initializeFeatureFlags();
    });

    await expect(startup).resolves.toBeUndefined();
    expect(mockNative.activate).not.toHaveBeenCalled();
  });

  it('resolves when requiring the native module throws', async () => {
    jest.resetModules();
    jest.doMock(NATIVE_MODULE, () => {
      throw new Error('native module not linked');
    });

    let flags: FeatureFlagsModule | undefined;
    jest.isolateModules(() => {
      flags = require('@/lib/feature-flags') as FeatureFlagsModule;
    });

    await expect(flags!.initializeFeatureFlags()).resolves.toBeUndefined();
    expect(flags!.getFeatureFlagValue('example_feed_page_size')).toBe(20);

    jest.doMock(NATIVE_MODULE, () => mockNative);
    jest.resetModules();
  });
});

describe('reading a flag', () => {
  it('returns an activated remote value', () => {
    const { getFeatureFlagValue, isFeatureEnabled } = loadFeatureFlags();
    withValues({
      example_new_feed_layout_enabled: remoteValue(true),
      example_feed_page_size: remoteValue(50),
    });

    expect(isFeatureEnabled('example_new_feed_layout_enabled')).toBe(true);
    expect(getFeatureFlagValue('example_feed_page_size')).toBe(50);
  });

  it('returns a value the SDK reports as coming from the in-app defaults', () => {
    const { isFeatureEnabled } = loadFeatureFlags();
    withValues({ example_new_feed_layout_enabled: remoteValue(false, 'default') });

    expect(isFeatureEnabled('example_new_feed_layout_enabled')).toBe(false);
  });

  it('falls back when the SDK holds nothing for the key', () => {
    const { getFeatureFlagValue } = loadFeatureFlags();
    // `static` is what the SDK reports before defaults are published, and its
    // asNumber() would answer 0 — not what this app ships.
    withValues({ example_feed_page_size: remoteValue(0, 'static') });

    expect(getFeatureFlagValue('example_feed_page_size')).toBe(20);
  });

  it('falls back when a numeric flag holds something that is not a number', () => {
    const { getFeatureFlagValue } = loadFeatureFlags();
    withValues({ example_feed_page_size: remoteValue('not-a-number') });

    expect(getFeatureFlagValue('example_feed_page_size')).toBe(20);
  });

  it('falls back when the native read throws', () => {
    const { getFeatureFlagValue } = loadFeatureFlags();
    mockNative.getValue.mockImplementation(() => {
      throw new Error('bridge is gone');
    });

    expect(getFeatureFlagValue('example_feed_page_size')).toBe(20);
  });

  it('falls back when the native module is unusable', () => {
    withUnusableNativeModule((flags) => {
      expect(flags.isFeatureEnabled('example_new_feed_layout_enabled')).toBe(false);
      expect(flags.getFeatureFlagValue('example_feed_page_size')).toBe(20);
    });
  });

  it('resolves the module on every call, so a late module still works', () => {
    const { getFeatureFlagValue } = loadFeatureFlags();
    withValues({ example_feed_page_size: remoteValue(30) });

    expect(getFeatureFlagValue('example_feed_page_size')).toBe(30);
    withValues({ example_feed_page_size: remoteValue(40) });
    expect(getFeatureFlagValue('example_feed_page_size')).toBe(40);
  });
});

describe('a string flag', () => {
  /**
   * The seeded flags are a boolean and a number, so the string path is
   * exercised against an injected declaration — which is what happens the day
   * someone adds a string flag to `flags.ts`.
   */
  function loadWithStringFlag(): { getFeatureFlagValue: (key: string) => unknown } {
    jest.resetModules();
    jest.doMock('@/lib/feature-flags/flags', () => ({
      FEATURE_FLAG_DEFAULTS: { example_banner_variant: 'control' },
    }));

    let flags: FeatureFlagsModule | undefined;
    jest.isolateModules(() => {
      flags = require('@/lib/feature-flags') as FeatureFlagsModule;
    });

    return flags as unknown as { getFeatureFlagValue: (key: string) => unknown };
  }

  afterEach(() => {
    jest.dontMock('@/lib/feature-flags/flags');
    jest.resetModules();
  });

  it('returns the remote string', () => {
    withValues({ example_banner_variant: remoteValue('treatment') });

    expect(loadWithStringFlag().getFeatureFlagValue('example_banner_variant'))
      .toBe('treatment');
  });

  it('treats an empty remote string as unset', () => {
    withValues({ example_banner_variant: remoteValue('') });

    expect(loadWithStringFlag().getFeatureFlagValue('example_banner_variant'))
      .toBe('control');
  });
});

/**
 * These use the statically imported module rather than `loadFeatureFlags()`, so
 * the hook and the test renderer share one React. That module's startup latch
 * is untouched until the second test here trips it.
 */
describe('useFeatureFlag', () => {
  it('returns the current value', () => {
    withValues({ example_feed_page_size: remoteValue(25) });

    const { result } = renderHook(() => useFeatureFlag('example_feed_page_size'));

    expect(result.current).toBe(25);
  });

  it('re-renders on activation, and leaves an unmounted subscriber alone', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    // The subscriber that stays mounted, and one that goes away before the
    // notification is sent.
    const { result } = renderHook(() => useFeatureFlag('example_new_feed_layout_enabled'));
    const { unmount } = renderHook(() => useFeatureFlag('example_new_feed_layout_enabled'));

    expect(result.current).toBe(false);
    unmount();

    withValues({ example_new_feed_layout_enabled: remoteValue(true) });
    await act(async () => {
      await initializeFeatureFlags();
    });

    expect(result.current).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
