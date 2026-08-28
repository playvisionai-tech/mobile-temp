import { PermissionsAndroid, Platform } from 'react-native';

import {
  getDeviceToken,
  getNotificationPermissionStatus,
  registerForPushNotifications,
  requestNotificationPermission,
  subscribeToTokenRefresh,
  useNotificationDeepLinks,
  useNotificationRegistration,
} from '@/lib/notifications';
import { act, renderHook, waitFor } from '@/lib/test-utils';

const INSTANCE = { __instance: true };

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => INSTANCE),
  getToken: jest.fn(() => Promise.resolve('fcm-token')),
  onTokenRefresh: jest.fn(() => jest.fn()),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  hasPermission: jest.fn(() => Promise.resolve(1)),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
}));

const mockNavigate = jest.fn();
const mockRouter = { navigate: mockNavigate };

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => mockRouter),
  useRootNavigationState: jest.fn(() => ({ key: 'root' })),
}));

jest.mock('env', () => ({
  __esModule: true,
  default: { EXPO_PUBLIC_VERSION: '9.0.0' },
}));

const native = jest.requireMock<Record<string, jest.Mock>>('@react-native-firebase/messaging');
const router = jest.requireMock<Record<string, jest.Mock>>('expo-router');

/** Run the case as a modern Android device, where the runtime grant applies. */
function onAndroid(sdk: number) {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(sdk);
}

/**
 * Every case starts from a healthy native module. A `mockResolvedValue` in one
 * test outlives `clearAllMocks`, so the defaults are re-stated rather than
 * merely cleared — otherwise a refusal in one case silently becomes the
 * baseline for the next.
 */
function resetNativeMocks() {
  native.getMessaging.mockImplementation(() => INSTANCE);
  native.getToken.mockResolvedValue('fcm-token');
  native.onTokenRefresh.mockImplementation(() => jest.fn());
  native.requestPermission.mockResolvedValue(1);
  native.hasPermission.mockResolvedValue(1);
  native.getInitialNotification.mockResolvedValue(null);
  native.onNotificationOpenedApp.mockImplementation(() => jest.fn());
  native.onMessage.mockImplementation(() => jest.fn());
}

const originalDev = __DEV__;

function setDev(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', { value, configurable: true, writable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetNativeMocks();
  // The module's breadcrumbs are __DEV__-only; keep them out of the run except
  // where a case is specifically about them.
  setDev(false);
  router.useRootNavigationState.mockReturnValue({ key: 'root' });
  router.useRouter.mockReturnValue(mockRouter);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
});

afterEach(() => {
  setDev(originalDev);
  jest.restoreAllMocks();
});

describe('asking for permission on android', () => {
  it('requests POST_NOTIFICATIONS on api 33 and above', async () => {
    onAndroid(36);

    await expect(requestNotificationPermission()).resolves.toBe('granted');

    expect(PermissionsAndroid.request).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
    // The package's own Android requestPermission resolves AUTHORIZED without
    // prompting, so relying on it would silently no-op on a modern device.
    expect(native.requestPermission).not.toHaveBeenCalled();
  });

  it('reports a refusal as denied, and never_ask_again as blocked', async () => {
    onAndroid(36);

    jest.mocked(PermissionsAndroid.request).mockResolvedValue('denied');
    await expect(requestNotificationPermission()).resolves.toBe('denied');

    jest.mocked(PermissionsAndroid.request).mockResolvedValue('never_ask_again');
    await expect(requestNotificationPermission()).resolves.toBe('blocked');
  });

  it('reads the existing state below api 33, where the grant is implicit', async () => {
    onAndroid(32);
    native.hasPermission.mockResolvedValue(1);

    await expect(requestNotificationPermission()).resolves.toBe('granted');

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(native.hasPermission).toHaveBeenCalledWith(INSTANCE);
  });

  it('reports notifications switched off below api 33 as denied', async () => {
    onAndroid(32);
    native.hasPermission.mockResolvedValue(0);

    await expect(requestNotificationPermission()).resolves.toBe('denied');
  });

  it('answers unavailable when the request itself fails', async () => {
    onAndroid(36);
    jest.mocked(PermissionsAndroid.request).mockRejectedValue(new Error('no activity'));

    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
  });
});

describe('asking for permission on ios', () => {
  it('treats authorized, provisional and ephemeral as granted', async () => {
    for (const status of [1, 2, 3]) {
      native.requestPermission.mockResolvedValue(status);
      await expect(requestNotificationPermission()).resolves.toBe('granted');
    }
  });

  it('separates a first refusal from a state only settings can change', async () => {
    // NOT_DETERMINED: the prompt has not been shown, so asking can still work.
    native.requestPermission.mockResolvedValue(-1);
    await expect(requestNotificationPermission()).resolves.toBe('denied');

    // DENIED: ios shows its prompt once ever, so this is terminal in-app.
    native.requestPermission.mockResolvedValue(0);
    await expect(requestNotificationPermission()).resolves.toBe('blocked');
  });

  it('answers unavailable when the native call rejects', async () => {
    native.requestPermission.mockRejectedValue(new Error('nope'));

    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
  });
});

describe('reading the current permission without prompting', () => {
  it('maps the ios authorization status', async () => {
    native.hasPermission.mockResolvedValue(1);
    await expect(getNotificationPermissionStatus()).resolves.toBe('granted');

    native.hasPermission.mockResolvedValue(0);
    await expect(getNotificationPermissionStatus()).resolves.toBe('blocked');
  });

  it('maps the android enabled flag', async () => {
    onAndroid(36);

    native.hasPermission.mockResolvedValue(1);
    await expect(getNotificationPermissionStatus()).resolves.toBe('granted');

    native.hasPermission.mockResolvedValue(0);
    await expect(getNotificationPermissionStatus()).resolves.toBe('denied');
  });

  it('answers unavailable when the native call fails', async () => {
    native.hasPermission.mockRejectedValue(new Error('nope'));

    await expect(getNotificationPermissionStatus()).resolves.toBe('unavailable');
  });
});

describe('the device token', () => {
  it('returns the token FCM issues', async () => {
    await expect(getDeviceToken()).resolves.toBe('fcm-token');
  });

  it('answers null when FCM cannot issue one', async () => {
    // What the placeholder Firebase config in this repo actually produces:
    // registration fails against a project that does not exist.
    native.getToken.mockRejectedValue(new Error('SERVICE_NOT_AVAILABLE'));

    await expect(getDeviceToken()).resolves.toBeNull();
  });

  it('answers null for an empty token rather than an empty string', async () => {
    native.getToken.mockResolvedValue('');

    await expect(getDeviceToken()).resolves.toBeNull();
  });
});

describe('registering the device', () => {
  it('takes a token once permission is granted', async () => {
    await expect(registerForPushNotifications()).resolves.toStrictEqual({
      status: 'granted',
      token: 'fcm-token',
    });
  });

  it('does not ask FCM for a token when permission was refused', async () => {
    native.requestPermission.mockResolvedValue(0);

    await expect(registerForPushNotifications()).resolves.toStrictEqual({
      status: 'blocked',
      token: null,
    });
    expect(native.getToken).not.toHaveBeenCalled();
  });

  it('reports a granted permission with no token, and does not throw', async () => {
    native.getToken.mockRejectedValue(new Error('SERVICE_NOT_AVAILABLE'));

    await expect(registerForPushNotifications()).resolves.toStrictEqual({
      status: 'granted',
      token: null,
    });
  });

  it('never puts the token in a log line', async () => {
    setDev(true);
    const logged = jest.spyOn(console, 'log').mockImplementation(() => {});

    await registerForPushNotifications();

    expect(logged).toHaveBeenCalled();
    for (const [line] of logged.mock.calls) {
      expect(String(line)).not.toContain('fcm-token');
    }
  });

  it('re-uploads on rotation, and unsubscribes cleanly', () => {
    const unsubscribe = jest.fn();
    native.onTokenRefresh.mockImplementation(() => unsubscribe);

    const stop = subscribeToTokenRefresh();
    const listener = native.onTokenRefresh.mock.calls[0][1] as (token: string) => void;

    expect(() => listener('rotated-token')).not.toThrow();

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('when the native module is not there', () => {
  beforeEach(() => {
    native.getMessaging.mockImplementation(() => {
      throw new Error('no native module');
    });
  });

  it('answers unavailable, no token, and never throws', async () => {
    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
    await expect(getNotificationPermissionStatus()).resolves.toBe('unavailable');
    await expect(getDeviceToken()).resolves.toBeNull();
    await expect(registerForPushNotifications()).resolves.toStrictEqual({
      status: 'unavailable',
      token: null,
    });
  });

  it('hands back an unsubscribe that is safe to call', () => {
    const stop = subscribeToTokenRefresh();

    expect(() => stop()).not.toThrow();
  });
});

describe('the registration hook', () => {
  it('registers once on mount and stops listening on unmount', async () => {
    const unsubscribe = jest.fn();
    native.onTokenRefresh.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useNotificationRegistration());

    await waitFor(() => {
      expect(native.getToken).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('opening a notification', () => {
  it('navigates when the app was cold-started by a tap', async () => {
    native.getInitialNotification.mockResolvedValue({ data: { route: 'settings' } });

    renderHook(() => useNotificationDeepLinks());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  it('waits for the navigator before acting on a cold start', async () => {
    router.useRootNavigationState.mockReturnValue(undefined);
    native.getInitialNotification.mockResolvedValue({ data: { route: 'post', id: '7' } });

    const { rerender } = renderHook(() => useNotificationDeepLinks());

    await waitFor(() => {
      expect(native.getInitialNotification).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    // The navigator mounts a frame later, which is when the tap is honoured.
    router.useRootNavigationState.mockReturnValue({ key: 'root' });
    rerender(undefined);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/feed/[id]', params: { id: '7' } });
    });
  });

  it('navigates when a backgrounded app is brought up by a tap', async () => {
    renderHook(() => useNotificationDeepLinks());

    const listener = native.onNotificationOpenedApp.mock.calls[0][1] as (m: unknown) => void;
    act(() => {
      listener({ data: { route: 'post', id: '12' } });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/feed/[id]', params: { id: '12' } });
    });
  });

  it('does not navigate for a message that arrives in the foreground', () => {
    renderHook(() => useNotificationDeepLinks());

    const listener = native.onMessage.mock.calls[0][1] as (m: unknown) => void;
    act(() => {
      listener({ data: { route: 'settings' } });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the app and nothing more for a payload naming no valid route', async () => {
    renderHook(() => useNotificationDeepLinks());

    const listener = native.onNotificationOpenedApp.mock.calls[0][1] as (m: unknown) => void;
    act(() => {
      listener({ data: { route: 'admin' } });
      listener({ notification: { title: 'hi' } });
    });

    await waitFor(() => {
      expect(native.onNotificationOpenedApp).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when the app was not started by a notification', async () => {
    native.getInitialNotification.mockResolvedValue(null);

    renderHook(() => useNotificationDeepLinks());

    await waitFor(() => {
      expect(native.getInitialNotification).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('detaches both listeners on unmount', () => {
    const stopOpened = jest.fn();
    const stopForeground = jest.fn();
    native.onNotificationOpenedApp.mockImplementation(() => stopOpened);
    native.onMessage.mockImplementation(() => stopForeground);

    const { unmount } = renderHook(() => useNotificationDeepLinks());
    unmount();

    expect(stopOpened).toHaveBeenCalledTimes(1);
    expect(stopForeground).toHaveBeenCalledTimes(1);
  });
});
