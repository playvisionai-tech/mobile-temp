import type * as CrashReporting from '@/lib/crash-reporting';
import {
  logCrashBreadcrumb,
  recordError,
  setCrashReportingEnabled,
  setCrashUser,
} from '@/lib/crash-reporting';

const INSTANCE = { __instance: true };

jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: jest.fn(() => INSTANCE),
  log: jest.fn(),
  recordError: jest.fn(),
  setUserId: jest.fn(() => Promise.resolve(null)),
  setAttributes: jest.fn(() => Promise.resolve(null)),
  setCrashlyticsCollectionEnabled: jest.fn(() => Promise.resolve(null)),
}));

const native = jest.requireMock('@react-native-firebase/crashlytics') as Record<string, jest.Mock>;

const originalDev = __DEV__;

function setDev(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', { value, configurable: true, writable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setDev(originalDev);
});

afterEach(() => {
  setDev(originalDev);
});

describe('recordError', () => {
  it('reports an Error as a non-fatal, untouched', () => {
    const error = new Error('boom');

    recordError(error);

    expect(native.recordError).toHaveBeenCalledWith(INSTANCE, error);
    expect(native.setAttributes).not.toHaveBeenCalled();
  });

  it('coerces a thrown string into an Error', () => {
    recordError('request failed');

    expect(native.recordError.mock.calls[0][1]).toEqual(new Error('request failed'));
  });

  it('serializes a thrown object into the message', () => {
    recordError({ status: 500 });

    expect(native.recordError.mock.calls[0][1].message).toBe('{"status":500}');
  });

  it('falls back to String() when the value cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    recordError(circular);

    expect(native.recordError.mock.calls[0][1].message).toBe('[object Object]');
  });

  it('falls back to String() when serializing yields undefined', () => {
    recordError(undefined);

    expect(native.recordError.mock.calls[0][1].message).toBe('undefined');
  });

  it('attaches context as stringified custom keys', () => {
    recordError(new Error('boom'), { screen: 'feed', retries: 2, cached: false });

    expect(native.setAttributes).toHaveBeenCalledWith(INSTANCE, {
      screen: 'feed',
      retries: '2',
      cached: 'false',
    });
  });

  it('skips the custom keys call for empty context', () => {
    recordError(new Error('boom'), {});

    expect(native.setAttributes).not.toHaveBeenCalled();
    expect(native.recordError).toHaveBeenCalled();
  });

  it('still records the error when attaching context rejects', async () => {
    native.setAttributes.mockReturnValueOnce(Promise.reject(new Error('no native')));

    recordError(new Error('boom'), { screen: 'feed' });
    await Promise.resolve();

    expect(native.recordError).toHaveBeenCalled();
  });

  it('swallows a throwing native call', () => {
    native.recordError.mockImplementationOnce(() => {
      throw new Error('native blew up');
    });

    expect(() => recordError(new Error('boom'))).not.toThrow();
  });
});

describe('setCrashUser', () => {
  it('sets an opaque internal id', () => {
    setCrashUser('usr_01H8XYZ');

    expect(native.setUserId).toHaveBeenCalledWith(INSTANCE, 'usr_01H8XYZ');
  });

  it('clears the id on sign-out', () => {
    setCrashUser(null);

    expect(native.setUserId).toHaveBeenCalledWith(INSTANCE, '');
  });

  it.each([
    ['an email', 'ada@example.com'],
    ['a display name', 'Ada Lovelace'],
    ['a phone number', '+1 555 010 9999'],
  ])('ignores %s', (_label, value) => {
    setDev(false);

    setCrashUser(value);

    expect(native.setUserId).not.toHaveBeenCalled();
  });

  it('warns about a PII-looking id in development', () => {
    setDev(true);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    setCrashUser('ada@example.com');

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays quiet about a PII-looking id in production', () => {
    setDev(false);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    setCrashUser('ada@example.com');

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('swallows a rejection from the native call', async () => {
    native.setUserId.mockReturnValueOnce(Promise.reject(new Error('no native')));

    expect(() => setCrashUser('usr_1')).not.toThrow();
    await Promise.resolve();
  });
});

describe('logCrashBreadcrumb', () => {
  it('forwards the message to the crash log', () => {
    logCrashBreadcrumb('opened feed');

    expect(native.log).toHaveBeenCalledWith(INSTANCE, 'opened feed');
  });
});

describe('setCrashReportingEnabled', () => {
  it.each([true, false])('toggles collection to %p', async (enabled) => {
    await setCrashReportingEnabled(enabled);

    expect(native.setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(INSTANCE, enabled);
  });

  it('resolves when the native call rejects', async () => {
    native.setCrashlyticsCollectionEnabled.mockReturnValueOnce(Promise.reject(new Error('no native')));

    await expect(setCrashReportingEnabled(true)).resolves.toBeUndefined();
  });
});

describe('without the native module', () => {
  it('no-ops when the package exposes no modular entry point', async () => {
    const getCrashlytics = native.getCrashlytics;
    // @ts-expect-error deliberately breaking the mock to simulate a stub build.
    native.getCrashlytics = undefined;

    try {
      recordError(new Error('boom'));
      setCrashUser('usr_1');
      logCrashBreadcrumb('hello');
      await expect(setCrashReportingEnabled(true)).resolves.toBeUndefined();

      expect(native.recordError).not.toHaveBeenCalled();
      expect(native.setUserId).not.toHaveBeenCalled();
      expect(native.log).not.toHaveBeenCalled();
      expect(native.setCrashlyticsCollectionEnabled).not.toHaveBeenCalled();
    }
    finally {
      native.getCrashlytics = getCrashlytics;
    }
  });

  it('no-ops when the package cannot be required at all', () => {
    let reporting: typeof CrashReporting;

    jest.isolateModules(() => {
      jest.doMock('@react-native-firebase/crashlytics', () => {
        throw new Error('native module missing');
      });
      reporting = require('@/lib/crash-reporting');
    });

    expect(() => reporting!.recordError(new Error('boom'))).not.toThrow();
    expect(() => reporting!.setCrashUser('usr_1')).not.toThrow();
    expect(() => reporting!.logCrashBreadcrumb('hello')).not.toThrow();
    return expect(reporting!.setCrashReportingEnabled(true)).resolves.toBeUndefined();
  });

  it('recovers once the native module becomes available', () => {
    const getCrashlytics = native.getCrashlytics;
    // @ts-expect-error deliberately breaking the mock to simulate a late init.
    native.getCrashlytics = undefined;
    logCrashBreadcrumb('too early');
    native.getCrashlytics = getCrashlytics;

    logCrashBreadcrumb('ready now');

    expect(native.log).toHaveBeenCalledTimes(1);
    expect(native.log).toHaveBeenCalledWith(INSTANCE, 'ready now');
  });
});
