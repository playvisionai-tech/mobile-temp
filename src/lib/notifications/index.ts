import type { Messaging, RemoteMessage } from '@react-native-firebase/messaging';

import type { Href } from 'expo-router';
import type { NotificationData } from './targets';

import Env from 'env';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { resolveNotificationTarget } from './targets';

export * from './targets';

/**
 * The slice of the Messaging modular API this wrapper uses. Declaring it here
 * rather than deriving it from the package keeps the surface we depend on
 * visible in one place, and lets `loadApi` type its `require` result.
 */
type MessagingApi = {
  getMessaging: () => Messaging;
  getToken: (messaging: Messaging) => Promise<string>;
  onTokenRefresh: (messaging: Messaging, listener: (token: string) => void) => () => void;
  requestPermission: (messaging: Messaging) => Promise<number>;
  hasPermission: (messaging: Messaging) => Promise<number>;
  getInitialNotification: (messaging: Messaging) => Promise<RemoteMessage | null>;
  onNotificationOpenedApp: (
    messaging: Messaging,
    listener: (message: RemoteMessage) => void,
  ) => () => void;
  onMessage: (messaging: Messaging, listener: (message: RemoteMessage) => void) => () => void;
};

/**
 * What the app knows about its permission to post notifications.
 *
 * `blocked` is separate from `denied` because it is a different situation for
 * the user, not a worse one: on iOS the system prompt is shown **once ever**,
 * and on Android once the user checks "don't ask again". After that no call
 * this module can make will show a prompt, and the only route back is the
 * system settings app. `unavailable` means the question could not be asked at
 * all — no native module, or a native call that failed.
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

/** What `registerForPushNotifications` learned. The token is never logged or reported. */
export type PushRegistration = {
  status: NotificationPermissionStatus;
  /** `null` whenever permission was not granted, or FCM could not issue a token. */
  token: string | null;
};

/**
 * The body the token endpoint will receive, once it exists.
 *
 * Defined here rather than left to the future call site so that wiring the
 * upload is a change to one function body: the shape is already agreed, and
 * `registerForPushNotifications` already produces every field.
 */
export type DeviceTokenRegistration = {
  /** The FCM registration token. Device-scoped, rotates, and is **sensitive**. */
  token: string;
  platform: 'android' | 'ios';
  /** `Env.EXPO_PUBLIC_VERSION` — the app version that produced the token. */
  appVersion: string;
};

/** iOS `AuthorizationStatus`, from the package's own statics. Android never returns these. */
const IOS_AUTHORIZED = 1;
const IOS_PROVISIONAL = 2;
const IOS_EPHEMERAL = 3;
const IOS_NOT_DETERMINED = -1;

/** The first Android release where posting a notification needs a runtime grant. */
const ANDROID_RUNTIME_PERMISSION_SDK = 33;

/**
 * Resolve the native module, or `null` when it is not there — Jest, a build
 * without the Firebase config, or any point before the default app has been
 * initialized. Deliberately not memoized, for the same reason as in
 * `@/lib/analytics`: a failure here is often "too early", not "never", and
 * caching the miss would leave the app unable to register for the rest of the
 * process.
 */
function loadApi(): MessagingApi | null {
  try {
    const api = require('@react-native-firebase/messaging') as MessagingApi | undefined;
    return typeof api?.getMessaging === 'function' ? api : null;
  }
  catch {
    return null;
  }
}

/**
 * Run an action against the live instance and answer `fallback` if anything at
 * all goes wrong — a missing module, a synchronous throw, a rejected promise.
 *
 * Unlike the `run` helper in `@/lib/analytics` this one has a **result**, since
 * a caller needs to know whether it has a token. What it keeps from that helper
 * is the contract: nothing in this module throws into the app. Push
 * registration is a side concern, and an app that cannot register for
 * notifications must still start.
 */
async function attempt<T>(
  action: (api: MessagingApi, messaging: Messaging) => Promise<T> | T,
  fallback: T,
): Promise<T> {
  try {
    const api = loadApi();
    if (api === null) {
      return fallback;
    }
    return await action(api, api.getMessaging());
  }
  catch {
    return fallback;
  }
}

/**
 * Attach a listener, returning an unsubscribe that is always safe to call —
 * including when nothing was ever attached.
 */
function attach(action: (api: MessagingApi, messaging: Messaging) => () => void): () => void {
  try {
    const api = loadApi();
    if (api === null) {
      return () => {};
    }
    return action(api, api.getMessaging());
  }
  catch {
    return () => {};
  }
}

function log(message: string): void {
  if (__DEV__) {
    console.log(`[notifications] ${message}`);
  }
}

/** Map an iOS `AuthorizationStatus` onto ours. */
function fromAuthorizationStatus(status: number): NotificationPermissionStatus {
  if (status === IOS_AUTHORIZED || status === IOS_PROVISIONAL || status === IOS_EPHEMERAL) {
    return 'granted';
  }
  // NOT_DETERMINED means the prompt has not been shown yet, so the user can
  // still be asked; DENIED after a prompt is terminal until they visit Settings.
  return status === IOS_NOT_DETERMINED ? 'denied' : 'blocked';
}

/**
 * Ask Android for the runtime grant.
 *
 * This does **not** go through `requestPermission()` from the package, and that
 * is not an oversight: its Android implementation resolves `AUTHORIZED`
 * unconditionally without showing anything (verified in the package's own
 * `NativeRNFBTurboMessaging.java`). Below API 33 there is genuinely nothing to
 * request — the grant is implicit at install — so the honest answer there is
 * whether notifications are enabled at all, which `hasPermission()` reports.
 */
async function requestOnAndroid(): Promise<NotificationPermissionStatus> {
  if (Number(Platform.Version) < ANDROID_RUNTIME_PERMISSION_SDK) {
    return getNotificationPermissionStatus();
  }

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
    return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
  }
  catch {
    return 'unavailable';
  }
}

/**
 * What the app's notification permission is **right now**, without prompting.
 *
 * Reads the platform's own view: on Android that is whether notifications are
 * enabled for the app, which covers both the API 33 runtime grant and a user
 * switching them off in settings on any version.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const status = await attempt(
    async (api, messaging) => api.hasPermission(messaging),
    null as number | null,
  );

  if (status === null) {
    return 'unavailable';
  }
  return Platform.OS === 'ios' ? fromAuthorizationStatus(status) : (status === 1 ? 'granted' : 'denied');
}

/**
 * Ask the user for permission to post notifications.
 *
 * **A prompt is not guaranteed.** Each platform shows one at most once, so a
 * second call after a refusal returns the refusal without any UI. `denied` and
 * `blocked` are ordinary answers, not failures: the caller carries on with no
 * token, and only a trip to the system settings app changes `blocked`.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'android') {
    return requestOnAndroid();
  }

  const status = await attempt(
    async (api, messaging) => api.requestPermission(messaging),
    null as number | null,
  );

  return status === null ? 'unavailable' : fromAuthorizationStatus(status);
}

/**
 * The device's FCM registration token, or `null` if FCM would not issue one.
 *
 * `null` is the normal answer in this repo today: the committed Firebase
 * config files are placeholders, so the project the SDK registers against does
 * not exist and the call fails. Callers must treat a missing token as ordinary.
 */
export async function getDeviceToken(): Promise<string | null> {
  return attempt(
    async (api, messaging) => (await api.getToken(messaging)) || null,
    null as string | null,
  );
}

/**
 * Hand the token to the backend.
 *
 * TODO(push-backend): there is no endpoint yet. When one exists, this body is
 * the whole change — post `registration` through the client in `@/lib/api`
 * (never a hand-rolled `fetch`) and let a failure resolve rather than throw, so
 * the contract of this module is unchanged:
 *
 *     POST {EXPO_PUBLIC_API_URL}/devices/push-token
 *     Authorization: Bearer <Clerk session token>
 *     body:     DeviceTokenRegistration
 *     201/204:  stored, associated with the caller's account
 *     401:      not signed in — drop the token, it will be re-sent next launch
 *
 * The endpoint must be idempotent on `token`: this runs on every cold start and
 * again on every FCM token rotation, so the same value arrives repeatedly.
 *
 * Deliberately **not** called anywhere yet. Sending a device token to a URL
 * that does not exist would be a network call inventing an API.
 */
async function uploadDeviceToken(registration: DeviceTokenRegistration): Promise<void> {
  // The token itself is never logged: it is a sensitive device identifier, and
  // anyone holding one can push to that device.
  log(`token ready for upload (${registration.platform}, app ${registration.appVersion}); no endpoint yet`);
  await Promise.resolve();
}

/** Build the upload body for a token. Exported shape, private construction. */
function toRegistration(token: string): DeviceTokenRegistration {
  return {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Env.EXPO_PUBLIC_VERSION,
  };
}

/**
 * Ask for permission and, if it is granted, fetch the device token and hand it
 * to the backend.
 *
 * Resolves in every case. A refusal, a missing native module and an FCM that
 * cannot issue a token are all reported in the result rather than thrown.
 */
export async function registerForPushNotifications(): Promise<PushRegistration> {
  const status = await requestNotificationPermission();

  if (status !== 'granted') {
    log(`permission ${status}; not registering for a token`);
    return { status, token: null };
  }

  const token = await getDeviceToken();

  if (token === null) {
    log('permission granted but FCM issued no token');
    return { status, token: null };
  }

  await uploadDeviceToken(toRegistration(token));

  return { status, token };
}

/**
 * Re-upload the token whenever FCM rotates it. Returns an unsubscribe.
 *
 * A rotated token invalidates the previous one, so an app that only registers
 * at startup silently stops receiving pushes the first time this fires.
 */
export function subscribeToTokenRefresh(): () => void {
  return attach((api, messaging) =>
    api.onTokenRefresh(messaging, (token) => {
      void uploadDeviceToken(toRegistration(token));
    }));
}

/**
 * Request permission and register the device once, on mount, and keep the
 * token current for the life of the app.
 *
 * Export only — the root layout owns where this is mounted, the same way it
 * owns `useScreenTracking`.
 */
export function useNotificationRegistration(): void {
  useEffect(() => {
    void registerForPushNotifications();
    return subscribeToTokenRefresh();
  }, []);
}

/**
 * Navigate when a notification is opened.
 *
 * There are three ways a message reaches a running app and they are separate
 * APIs, not one event — missing any of them is the classic bug in this
 * integration:
 *
 * 1. **Foreground** — `onMessage`. Observed, but **never navigated**. Neither
 *    platform displays a notification while the app is in front, so nothing was
 *    tapped; moving a user who is mid-task would be the app acting on its own.
 *    Rendering an in-app notification here is out of scope — see `spec.md`.
 * 2. **Background, then tapped** — `onNotificationOpenedApp`.
 * 3. **Cold-started by a tap** — `getInitialNotification`. The message is
 *    delivered as *initial state*, once, not as an event, so an app that only
 *    subscribes to (2) opens on the wrong screen every time it was not already
 *    running.
 *
 * Navigation waits for the root navigator: on a cold start the message is
 * available before there is anything to navigate.
 */
export function useNotificationDeepLinks(): void {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigatorReady = navigationState?.key !== undefined;

  // Refs, not state: a notification arriving is an event from outside React,
  // and the only thing it should cause is a navigation. Holding it in state
  // would re-render the whole app to carry a value nothing renders.
  const isReady = useRef(false);
  const pending = useRef<Href | null>(null);

  const open = useCallback((data: NotificationData | undefined) => {
    const target = resolveNotificationTarget(data);

    // Not a deep link, or a destination this app refuses to honour. Opening
    // the app is the whole of the intended behavior.
    if (target === null) {
      return;
    }

    if (isReady.current) {
      router.navigate(target);
      return;
    }

    // Cold start: the tap is known before there is a navigator to act on it.
    pending.current = target;
  }, [router]);

  // Path 3 — the app was not running, and the tap started it. Delivered once,
  // as initial state, so nothing else will report it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const message = await attempt(
        async (api, messaging) => api.getInitialNotification(messaging),
        null as RemoteMessage | null,
      );

      if (!cancelled && message !== null) {
        open(message.data as NotificationData | undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Paths 1 and 2 — the app is already running.
  useEffect(() => {
    const unsubscribeOpened = attach((api, messaging) =>
      api.onNotificationOpenedApp(messaging, (message) => {
        open(message.data as NotificationData | undefined);
      }));

    const unsubscribeForeground = attach((api, messaging) =>
      api.onMessage(messaging, () => {
        // Received, acknowledged, and deliberately not acted on. See above.
        log('message received in the foreground; not navigating');
      }));

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
    };
  }, [open]);

  // Flush whatever arrived before the navigator existed.
  useEffect(() => {
    isReady.current = isNavigatorReady;

    const target = pending.current;
    if (!isNavigatorReady || target === null) {
      return;
    }

    pending.current = null;
    router.navigate(target);
  }, [isNavigatorReady, router]);
}
