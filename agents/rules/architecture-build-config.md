# Architecture Build Configuration

## Rule
- **EAS profiles** — use `development`, `preview`, `production` profiles in `eas.json`. Never hard-code values in `app.config.ts` or `env.js`.
- **Environment variables** — all vars go through `env.ts` (Zod schema). Public vars prefixed with `EXPO_PUBLIC_`.
- **No OTA updates, so no `channel` keys** — this app does not ship `expo-updates`. Build profiles select builds by `--profile`; a `channel` in `eas.json` would be inert. Do not add one without also adding `expo-updates` and a `runtimeVersion` policy, which is a product decision. See **Decisions** below.

## Rationale
EAS profiles provide reproducible builds per environment. Centralized env validation prevents runtime crashes from missing/invalid config. The `EXPO_PUBLIC_` prefix distinguishes client-safe vars from server-only secrets. Config that names machinery the app does not have — an update channel with no updates package — reads as intent and misleads the next person who touches it.

## Examples

### Good
```json
// eas.json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "store", "environment": "preview" },
    "production": { "distribution": "store", "environment": "production" }
  }
}
```

```ts
// env.ts
export const Env = z.object({
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  EXPO_PRIVATE_API_KEY: z.string().optional(), // server-only, not bundled
}).parse(process.env);
```

### Bad
```ts
// app.config.ts
export default {
  extra: {
    apiUrl: process.env.API_URL || 'http://localhost:3000', // ❌ No validation, no prefix
  },
};
```

```ts
// Hard-coded in component
const response = await fetch('https://api.example.com/users'); // ❌ Bypasses env
```

```json
// eas.json
{
  "build": {
    "production": { "channel": "production" } // ❌ expo-updates is not installed
  }
}
```

## Enforcement
- ESLint: `no-restricted-imports` can block direct `process.env` usage
- CI: `pnpm type-check` validates `env.ts` schema
- Review: verify all new env vars added to `env.ts` with Zod
- Review: **nothing enforces the no-`channel` rule.** No lint rule or CI job reads `eas.json`, and an inert `channel` fails no build — it is caught by review only.

## Decisions

### 2026-08-27 — Deleted the inert `channel` keys from eas.json
**Chose:** Remove `"channel": "production"` and `"channel": "preview"` from `eas.json`, leaving both profiles otherwise untouched
**Over:** Installing `expo-updates` and making the channels real
**Why:** An EAS `channel` subscribes a build to an expo-updates OTA branch, and `expo-updates` is not installed — absent from `package.json` and from `node_modules`, with only the unrelated `expo-updates-interface` peer stub in the lockfile. `6f705fa` (2023-07-20) deliberately removed it, replacing `Updates.reloadAsync()` with `react-native-restart` for the language-change restart in `src/lib/i18n/utils.tsx`; that dependency is still live and still tested. The keys were never load-bearing: nothing passes `--channel` or runs `eas update`, and `.github/actions/eas-build` selects builds by `--profile`. Decisively, **`app.config.ts` sets no `runtimeVersion`** — EAS Update matches a build to an update by (channel → branch, runtimeVersion), so without one these keys could not have served an update even had `expo-updates` been present. Both keys predate the removal commit by ~10 months (`d03a3b5`, 2022-11-09), making them template residue rather than intent. Turning OTA on is a product decision, not a config-hygiene one.
**Deliberately not done:** `app.config.ts` still contains `updates: { fallbackToCacheTimeout: 0 }`. By the same evidence it is the same 2022 residue (`cb5faaa`, 2022-09-13) and equally inert, but `app.config.ts` is an ask-first file under AGENTS.md and the approval for this change covered `eas.json` only. It is being raised separately. The asymmetry is a scope boundary, not an oversight.
**Trade-off:** Should this app adopt EAS Update later, the channels must be re-added — alongside `expo-updates` and a `runtimeVersion` policy, which the deleted keys did not supply and which is the part that actually takes thought. Until then `eas.json` no longer implies an OTA setup that does not exist.
