import z from 'zod';

import packageJSON from './package.json';

// Single unified environment schema
const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']),
  EXPO_PUBLIC_NAME: z.string(),
  EXPO_PUBLIC_SCHEME: z.string(),
  EXPO_PUBLIC_BUNDLE_ID: z.string(),
  EXPO_PUBLIC_PACKAGE: z.string(),
  EXPO_PUBLIC_VERSION: z.string(),
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_ASSOCIATED_DOMAIN: z.string().url().optional(),
  EXPO_PUBLIC_VAR_NUMBER: z.number(),
  EXPO_PUBLIC_VAR_BOOL: z.boolean(),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  EXPO_PUBLIC_CLERK_API_URL: z.string().url().optional(),
  EXPO_PUBLIC_CLERK_JWT_TEMPLATE: z.string().optional(),

  // only available for app.config.ts usage
  APP_BUILD_ONLY_VAR: z.string().optional(),
  // Firebase client config files, resolved per environment. Build-time only —
  // these are paths consumed by app.config.ts, never read from src/.
  APP_FIREBASE_IOS_CONFIG: z.string(),
  APP_FIREBASE_ANDROID_CONFIG: z.string(),
});

// Config records per environment
const EXPO_PUBLIC_APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV
  ?? 'development') as z.infer<typeof envSchema>['EXPO_PUBLIC_APP_ENV'];

const BUNDLE_IDS = {
  development: 'com.obytes.development',
  preview: 'com.obytes.preview',
  production: 'com.obytes',
} as const;

const PACKAGES = {
  development: 'com.obytes.development',
  preview: 'com.obytes.preview',
  production: 'com.obytes',
} as const;

const SCHEMES = {
  development: 'obytesApp',
  preview: 'obytesApp.preview',
  production: 'obytesApp',
} as const;

const NAME = 'ObytesApp';

// One Firebase app per environment, per platform. These files are downloaded
// from the Firebase console and committed: they are client config, not secrets.
// The bundle id / package name inside each must match BUNDLE_IDS / PACKAGES
// above, or the native build fails.
const FIREBASE_CONFIG = {
  development: {
    ios: './firebase/development/GoogleService-Info.plist',
    android: './firebase/development/google-services.json',
  },
  preview: {
    ios: './firebase/preview/GoogleService-Info.plist',
    android: './firebase/preview/google-services.json',
  },
  production: {
    ios: './firebase/production/GoogleService-Info.plist',
    android: './firebase/production/google-services.json',
  },
} as const;

// Check if strict validation is required (before prebuild)
const STRICT_ENV_VALIDATION = process.env.STRICT_ENV_VALIDATION === '1';

// Build env object
const _env: z.infer<typeof envSchema> = {
  EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_NAME: NAME,
  EXPO_PUBLIC_SCHEME: SCHEMES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_BUNDLE_ID: BUNDLE_IDS[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_PACKAGE: PACKAGES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_VERSION: packageJSON.version,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? '',
  EXPO_PUBLIC_ASSOCIATED_DOMAIN: process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN,
  EXPO_PUBLIC_VAR_NUMBER: Number(process.env.EXPO_PUBLIC_VAR_NUMBER ?? 0),
  EXPO_PUBLIC_VAR_BOOL: process.env.EXPO_PUBLIC_VAR_BOOL === 'true',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  EXPO_PUBLIC_CLERK_API_URL: process.env.EXPO_PUBLIC_CLERK_API_URL,
  EXPO_PUBLIC_CLERK_JWT_TEMPLATE: process.env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE,
  APP_BUILD_ONLY_VAR: process.env.APP_BUILD_ONLY_VAR,
  APP_FIREBASE_IOS_CONFIG: FIREBASE_CONFIG[EXPO_PUBLIC_APP_ENV].ios,
  APP_FIREBASE_ANDROID_CONFIG: FIREBASE_CONFIG[EXPO_PUBLIC_APP_ENV].android,
};

function getValidatedEnv(env: z.infer<typeof envSchema>) {
  const parsed = envSchema.safeParse(env);

  if (parsed.success === false) {
    const errorMessage
      = `❌ Invalid environment variables:${
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
      }\n❌ Missing variables in .env file for APP_ENV=${EXPO_PUBLIC_APP_ENV}`
      + `\n💡 Tip: If you recently updated the .env file, try restarting with -c flag to clear the cache.`;

    if (STRICT_ENV_VALIDATION) {
      console.error(errorMessage);
      throw new Error('Invalid environment variables');
    }
  }
  else {
    console.log('✅ Environment variables validated successfully');
  }

  return parsed.success ? parsed.data : env;
}

const Env = STRICT_ENV_VALIDATION ? getValidatedEnv(_env) : _env;

export default Env;
