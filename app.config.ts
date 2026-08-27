import type { ConfigContext, ExpoConfig } from '@expo/config';

import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import 'tsx/cjs';

// adding lint exception as we need to import tsx/cjs before env.ts is imported
// eslint-disable-next-line perfectionist/sort-imports
import Env from './env';

const EXPO_ACCOUNT_OWNER = 'obytes';
const EAS_PROJECT_ID = 'c3e1075b-6fe7-4686-aa49-35b46a229044';

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.EXPO_PUBLIC_APP_ENV !== 'production',
  badges: [
    {
      text: Env.EXPO_PUBLIC_APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.EXPO_PUBLIC_VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

// `app` copies the per-environment GoogleService files into the native
// projects; `analytics` and `crashlytics` add their own Podfile / Gradle mods;
// remote-config ships no config plugin. Both iOS flags are load-bearing —
// firebase/README.md explains the two `pod install` failures they fix.
//
// `messaging`'s plugin contributes the Android notification icon and colour
// meta-data and nothing else — with no icon configured it writes nothing at
// all, and `expo config --type introspect` shows zero occurrences of either
// key. FCM's permissions and services are NOT its doing: POST_NOTIFICATIONS,
// c2dm.permission.RECEIVE and the messaging services come from the library's
// own AAR manifests through autolinking and the Gradle manifest merge, so
// they are in the APK whether or not this entry is present. It is listed for
// the icon/colour hook and so the plugin set matches the installed packages.
const firebasePlugins: ExpoConfig['plugins'] = [
  ['@react-native-firebase/app', { ios: { disableSPM: true } }],
  '@react-native-firebase/analytics',
  '@react-native-firebase/crashlytics',
  '@react-native-firebase/messaging',
  ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.EXPO_PUBLIC_NAME,
  description: `${Env.EXPO_PUBLIC_NAME} Mobile App`,
  owner: EXPO_ACCOUNT_OWNER,
  scheme: Env.EXPO_PUBLIC_SCHEME,
  slug: 'obytesapp',
  version: Env.EXPO_PUBLIC_VERSION.toString(),
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: Env.EXPO_PUBLIC_BUNDLE_ID,
    googleServicesFile: Env.APP_FIREBASE_IOS_CONFIG,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2E3C4B',
    },
    package: Env.EXPO_PUBLIC_PACKAGE,
    googleServicesFile: Env.APP_FIREBASE_ANDROID_CONFIG,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2E3C4B',
        image: './assets/splash-icon.png',
        imageWidth: 150,
      },
    ],
    [
      'expo-font',
      {
        ios: {
          fonts: [
            'node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
            'node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf',
            'node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',
            'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
          ],
        },
        android: {
          fonts: [
            {
              fontFamily: 'Inter',
              fontDefinitions: [
                {
                  path: 'node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
                  weight: 400,
                },
                {
                  path: 'node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf',
                  weight: 500,
                },
                {
                  path: 'node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',
                  weight: 600,
                },
                {
                  path: 'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
                  weight: 700,
                },
              ],
            },
          ],
        },
      },
    ],
    'expo-localization',
    'expo-router',
    'expo-secure-store',
    '@clerk/expo',
    // Repoints Android's AppTheme at Theme.Material3.DayNight.NoActionBar,
    // which the native BottomNavigationView requires. Android-only; no iOS mod.
    'react-native-bottom-tabs',
    // Registers the Material Design Icons font. The native tab bar rasterizes
    // glyphs from it on Android — see components/ui/tab-icons.tsx.
    '@react-native-vector-icons/material-design-icons',
    ...firebasePlugins,
    ['app-icon-badge', appIconBadgeConfig],
    ['react-native-edge-to-edge'],
  ],
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
});
