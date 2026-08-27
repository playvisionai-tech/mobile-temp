module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  // The CLI generates scratch apps here with their own node_modules and
  // manual mocks; scanning them poisons the haste map for the real suite.
  modulePathIgnorePatterns: ['<rootDir>/cli/test-project'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest-setup.ts',
    '!**/docs/**',
    '!**/cli/**',
    // Test support and non-product visual/framework plumbing are outside the
    // core-product coverage contract enforced in pull requests.
    '!src/lib/test-utils.tsx',
    '!src/features/style-demo/**',
    '!src/components/ui/icons/**',
    '!src/features/onboarding/components/cover.tsx',
    '!src/app/+html.tsx',
    '!src/app/{login,onboarding}.tsx',
    '!src/app/(app)/{index,settings,style}.tsx',
    '!src/app/feed/**/*.tsx',
  ],
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  transformIgnorePatterns: [
    `node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|@sentry/.*|native-base|react-native-svg|@gorhom/.*|@shopify/.*|@tanstack/.*|react-native-reanimated|react-native-mmkv|react-native-nitro-modules|react-native-worklets|tailwind-merge|tailwind-variants|uniwind))`,
  ],
  coverageReporters: ['json-summary', ['text', { file: 'coverage.txt' }]],
  // CI runs Jest with coverage on every pull request. Keep every aggregate
  // metric at or above 90%, rather than allowing a strong line count to mask
  // weak branch or function coverage.
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: [
    'default',
    ['github-actions', { silent: false }],
    'summary',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
  coverageDirectory: '<rootDir>/coverage/',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
