const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// Opt-in bundler-level auth mock. Off unless MOCK_AUTH=1, and when it is off
// this file behaves exactly as it did before the flag existed.
const MOCK_AUTH = process.env.MOCK_AUTH === '1';

// Hard refusal, not a warning. A mocked auth bypass that shipped would make
// every build trust an unauthenticated client, so this fails at config load —
// before Metro reads a single module — rather than producing a bundle.
if (
  MOCK_AUTH
  && (process.env.NODE_ENV === 'production'
    || process.env.EXPO_PUBLIC_APP_ENV === 'production')
) {
  throw new Error(
    'MOCK_AUTH=1 is set in a production build '
    + `(NODE_ENV=${process.env.NODE_ENV}, `
    + `EXPO_PUBLIC_APP_ENV=${process.env.EXPO_PUBLIC_APP_ENV}). `
    + 'The Clerk mock in e2e-mocks/clerk/ replaces real authentication with an '
    + 'always-signed-in stub and must never reach a shipped bundle. '
    + 'Unset MOCK_AUTH, or target a development/preview environment.',
  );
}

// Specifier -> mock file. Both entry points the app imports must be redirected:
// aliasing only '@clerk/expo' would leave the real token-cache pulling in the
// real client and defeat the whole thing.
const CLERK_MOCKS = {
  '@clerk/expo': path.resolve(__dirname, 'e2e-mocks/clerk/index.tsx'),
  '@clerk/expo/token-cache': path.resolve(
    __dirname,
    'e2e-mocks/clerk/token-cache.ts',
  ),
};

/**
 * Redirect the Clerk specifiers at resolve time, falling through to whatever
 * resolver is already configured for everything else.
 *
 * Applied outside `withUniwindConfig` on purpose: uniwind installs its own
 * `resolveRequest`, and wrapping it means ours runs first and delegates, rather
 * than being silently replaced.
 */
function withClerkMock(config) {
  const upstream = config.resolver.resolveRequest;

  return {
    ...config,
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        const mockPath = CLERK_MOCKS[moduleName];
        if (mockPath) {
          return { type: 'sourceFile', filePath: mockPath };
        }
        // `context.resolveRequest` is Metro's default; `upstream` is uniwind's
        // if it set one.
        return (upstream ?? context.resolveRequest)(
          context,
          moduleName,
          platform,
        );
      },
    },
  };
}

const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './src/global.css',
});

if (MOCK_AUTH) {
  console.warn(
    '\n⚠️  MOCK_AUTH=1 — @clerk/expo is aliased to e2e-mocks/clerk/. '
    + 'Authentication is FAKE and the app starts signed in.\n',
  );
}

module.exports = MOCK_AUTH ? withClerkMock(config) : config;
