import type * as AnalyticsModule from '@/lib/analytics';
import {
  setAnalyticsEnabled,
  setAnalyticsUser,
  toScreenName,
  trackEvent,
  trackScreen,
  useScreenTracking,
} from '@/lib/analytics';

import { renderHook } from '@/lib/test-utils';

const INSTANCE = { __instance: true };

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => INSTANCE),
  logEvent: jest.fn(),
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => '/feed'),
}));

const native = jest.requireMock<Record<string, jest.Mock>>('@react-native-firebase/analytics');
const router = jest.requireMock<{ usePathname: jest.Mock }>('expo-router');

/** Runtime-only entry point: what a JavaScript caller, or an `any`, can reach. */
const trackUnchecked = trackEvent as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => void;

const originalDev = __DEV__;

function setDev(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', { value, configurable: true, writable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  router.usePathname.mockReturnValue('/feed');
  setDev(false);
});

afterEach(() => {
  setDev(originalDev);
});

describe('the registry', () => {
  it('rejects an event name it does not declare', () => {
    // @ts-expect-error 'checkout' is not in ANALYTICS_EVENTS.
    trackEvent('checkout', { value: 1 });
  });

  it('rejects a parameter the event does not declare', () => {
    // @ts-expect-error post_opened declares post_id only.
    trackEvent('post_opened', { post_id: 1, email: 'ada@example.com' });
  });

  it('rejects a value outside a declared literal set', () => {
    // @ts-expect-error 'sms' is not one of the auth methods.
    trackEvent('login', { method: 'sms' });
  });

  it('rejects a value of the wrong scalar type', () => {
    // @ts-expect-error post_id is a number.
    trackEvent('post_opened', { post_id: '12' });
  });

  it('requires the parameters of an event that declares them', () => {
    // @ts-expect-error login declares method.
    trackEvent('login');
  });
});

describe('trackEvent', () => {
  it('logs a declared event with its parameters', () => {
    trackEvent('login', { method: 'oauth' });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'login', { method: 'oauth' });
  });

  it('logs an event that declares no parameters without any', () => {
    trackEvent('logout');

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'logout', {});
  });

  it('passes numbers and booleans through', () => {
    trackEvent('post_created', { title_length: 12, body_length: 0 });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'post_created', {
      title_length: 12,
      body_length: 0,
    });
  });

  it('accepts a machine-readable string parameter', () => {
    trackEvent('request_failed', { endpoint: '/posts/[id]', status: 500 });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'request_failed', {
      endpoint: '/posts/[id]',
      status: 500,
    });
  });

  it('swallows a throwing native call', () => {
    native.logEvent.mockImplementationOnce(() => {
      throw new Error('native blew up');
    });

    expect(() => trackEvent('logout')).not.toThrow();
  });
});

describe('trackEvent — runtime sanitizing', () => {
  it('drops a parameter the event does not declare, and still logs the event', () => {
    trackUnchecked('post_opened', { post_id: 12, email: 'ada@example.com' });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'post_opened', { post_id: 12 });
  });

  it.each([
    ['free text', 'pull to refresh'],
    ['an email', 'ada@example.com'],
    ['a phone number', '+15550109999'],
    ['an empty string', ''],
    ['an over-long string', 'a'.repeat(101)],
  ])('drops a string parameter that is %s', (_label, value) => {
    trackUnchecked('request_failed', { endpoint: value, status: 500 });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'request_failed', { status: 500 });
  });

  it.each([
    ['a value outside the literal set', { method: 'sms' }],
    ['a non-string where a literal is declared', { method: 7 }],
  ])('drops %s', (_label, params) => {
    trackUnchecked('login', params);

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'login', {});
  });

  it.each([
    ['a non-number', '12'],
    ['a non-finite number', Number.NaN],
  ])('drops %s where a number is declared', (_label, value) => {
    trackUnchecked('post_opened', { post_id: value });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'post_opened', {});
  });

  it('drops a non-boolean where a boolean is declared', () => {
    trackUnchecked('onboarding_completed', { skipped: 'yes' });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'onboarding_completed', {});
  });

  it('keeps a boolean where a boolean is declared', () => {
    trackEvent('onboarding_completed', { skipped: false });

    expect(native.logEvent).toHaveBeenCalledWith(INSTANCE, 'onboarding_completed', {
      skipped: false,
    });
  });

  it('refuses an event name that is not in the registry', () => {
    trackUnchecked('checkout_started', { value: 99 });

    expect(native.logEvent).not.toHaveBeenCalled();
  });

  it('warns about a dropped event and a dropped parameter in development', () => {
    setDev(true);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    trackUnchecked('checkout_started');
    trackUnchecked('post_opened', { post_id: 1, title: 'Hello world' });
    trackUnchecked('post_opened', { post_id: 'twelve' });

    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('stays quiet about the same drops in production', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    trackUnchecked('checkout_started');
    trackUnchecked('post_opened', { post_id: 1, title: 'Hello world' });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('trackScreen', () => {
  it('defaults the screen class to the screen name', () => {
    trackScreen('/feed');

    expect(native.logScreenView).toHaveBeenCalledWith(INSTANCE, {
      screen_name: '/feed',
      screen_class: '/feed',
    });
  });

  it('uses an explicit screen class when given one', () => {
    trackScreen('/feed', 'FeedScreen');

    expect(native.logScreenView).toHaveBeenCalledWith(INSTANCE, {
      screen_name: '/feed',
      screen_class: 'FeedScreen',
    });
  });

  it('falls back to the name when the screen class is blank', () => {
    trackScreen('/feed', '   ');

    expect(native.logScreenView).toHaveBeenCalledWith(INSTANCE, {
      screen_name: '/feed',
      screen_class: '/feed',
    });
  });

  it('truncates a name and class past the Firebase limit', () => {
    trackScreen('/'.concat('a'.repeat(120)), 'C'.repeat(120));

    const params = native.logScreenView.mock.calls[0][1];
    expect(params.screen_name).toHaveLength(100);
    expect(params.screen_class).toHaveLength(100);
  });

  it.each([['an empty name', ''], ['a blank name', '   ']])('ignores %s', (_label, value) => {
    trackScreen(value);

    expect(native.logScreenView).not.toHaveBeenCalled();
  });

  it('swallows a rejection from the native call', async () => {
    native.logScreenView.mockReturnValueOnce(Promise.reject(new Error('no native')));

    expect(() => trackScreen('/feed')).not.toThrow();
    await Promise.resolve();
  });
});

describe('setAnalyticsUser', () => {
  it('sets an opaque internal id', () => {
    setAnalyticsUser('usr_01H8XYZ');

    expect(native.setUserId).toHaveBeenCalledWith(INSTANCE, 'usr_01H8XYZ');
  });

  it('clears the id on sign-out', () => {
    setAnalyticsUser(null);

    expect(native.setUserId).toHaveBeenCalledWith(INSTANCE, null);
  });

  it.each([
    ['an email', 'ada@example.com'],
    ['a display name', 'Ada Lovelace'],
    ['a phone number', '+1 555 010 9999'],
  ])('ignores %s', (_label, value) => {
    setAnalyticsUser(value);

    expect(native.setUserId).not.toHaveBeenCalled();
  });

  it('warns about a PII-looking id in development', () => {
    setDev(true);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    setAnalyticsUser('ada@example.com');

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('swallows a rejection from the native call', async () => {
    native.setUserId.mockReturnValueOnce(Promise.reject(new Error('no native')));

    expect(() => setAnalyticsUser('usr_1')).not.toThrow();
    await Promise.resolve();
  });
});

describe('setAnalyticsEnabled', () => {
  it.each([true, false])('toggles collection to %p', async (enabled) => {
    await setAnalyticsEnabled(enabled);

    expect(native.setAnalyticsCollectionEnabled).toHaveBeenCalledWith(INSTANCE, enabled);
  });

  it('resolves when the native call rejects', async () => {
    native.setAnalyticsCollectionEnabled.mockReturnValueOnce(Promise.reject(new Error('no native')));

    await expect(setAnalyticsEnabled(true)).resolves.toBeUndefined();
  });
});

describe('toScreenName', () => {
  it.each([
    ['/feed', '/feed'],
    ['/feed/12', '/feed/[id]'],
    ['/feed/12/comments/3', '/feed/[id]/comments/[id]'],
    ['/', '/'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(toScreenName(pathname)).toBe(expected);
  });
});

describe('useScreenTracking', () => {
  it('logs a screen view for the current path', () => {
    renderHook(() => useScreenTracking());

    expect(native.logScreenView).toHaveBeenCalledWith(INSTANCE, {
      screen_name: '/feed',
      screen_class: '/feed',
    });
  });

  it('collapses a dynamic segment out of the screen name', () => {
    router.usePathname.mockReturnValue('/feed/12');

    renderHook(() => useScreenTracking());

    expect(native.logScreenView).toHaveBeenCalledWith(INSTANCE, {
      screen_name: '/feed/[id]',
      screen_class: '/feed/[id]',
    });
  });

  it('does not log again when the path is unchanged', () => {
    const { rerender } = renderHook(() => useScreenTracking());

    rerender(undefined);

    expect(native.logScreenView).toHaveBeenCalledTimes(1);
  });

  it('logs again when the path changes', () => {
    const { rerender } = renderHook(() => useScreenTracking());

    router.usePathname.mockReturnValue('/settings');
    rerender(undefined);

    expect(native.logScreenView).toHaveBeenCalledTimes(2);
    expect(native.logScreenView).toHaveBeenLastCalledWith(INSTANCE, {
      screen_name: '/settings',
      screen_class: '/settings',
    });
  });

  it('logs nothing before the router reports a path', () => {
    router.usePathname.mockReturnValue('');

    renderHook(() => useScreenTracking());

    expect(native.logScreenView).not.toHaveBeenCalled();
  });
});

describe('without the native module', () => {
  it('no-ops when the package exposes no modular entry point', async () => {
    const getAnalytics = native.getAnalytics;
    // @ts-expect-error deliberately breaking the mock to simulate a stub build.
    native.getAnalytics = undefined;

    try {
      trackEvent('logout');
      trackScreen('/feed');
      setAnalyticsUser('usr_1');
      await expect(setAnalyticsEnabled(true)).resolves.toBeUndefined();

      expect(native.logEvent).not.toHaveBeenCalled();
      expect(native.logScreenView).not.toHaveBeenCalled();
      expect(native.setUserId).not.toHaveBeenCalled();
      expect(native.setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
    }
    finally {
      native.getAnalytics = getAnalytics;
    }
  });

  it('no-ops when the package cannot be required at all', () => {
    let analytics: typeof AnalyticsModule;

    jest.isolateModules(() => {
      jest.doMock('@react-native-firebase/analytics', () => {
        throw new Error('native module missing');
      });
      analytics = require('@/lib/analytics');
    });

    expect(() => analytics!.trackEvent('logout')).not.toThrow();
    expect(() => analytics!.trackScreen('/feed')).not.toThrow();
    expect(() => analytics!.setAnalyticsUser('usr_1')).not.toThrow();
    return expect(analytics!.setAnalyticsEnabled(true)).resolves.toBeUndefined();
  });

  it('recovers once the native module becomes available', () => {
    const getAnalytics = native.getAnalytics;
    // @ts-expect-error deliberately breaking the mock to simulate a late init.
    native.getAnalytics = undefined;
    trackEvent('logout');
    native.getAnalytics = getAnalytics;

    trackEvent('logout');

    expect(native.logEvent).toHaveBeenCalledTimes(1);
  });
});
