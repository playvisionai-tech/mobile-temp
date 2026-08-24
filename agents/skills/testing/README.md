# Testing

Test placement rules live in `agents/rules/testing-rules.md`. Render helpers are
in `src/lib/test-utils.tsx`.

## Commands
- `testing:unit` → `pnpm test` (jest)
- `testing:watch` → `pnpm test:watch`
- `testing:coverage` → `pnpm test:ci` (`jest --coverage`; reports to `coverage/`)
- `testing:e2e` → `pnpm e2e-test`
  (`maestro test .maestro/ -e APP_ID=com.obytes.development`)

## Maestro
Maestro is not a dependency — it is not in `node_modules/.bin`. Install it once
with `pnpm install-maestro`, then `pnpm e2e-test`. Flows live in `.maestro/`;
`.maestro/config.yaml` sets the run order. E2E needs a build installed on a
booted device.

## React Query devtools
No command. `@dev-plugins/react-query` is wired up in `src/lib/api/provider.tsx`
and opens from the Expo dev menu in a development build.
