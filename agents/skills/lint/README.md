# Lint

## Commands
- `lint:lint` → `pnpm lint` (`eslint .`)
- `lint:fix` → `pnpm lint:fix` (`eslint . --fix`)
- `lint:typecheck` → `pnpm type-check` (`tsc --noemit`)
- `lint:translations` → `pnpm lint:translations` (JSON syntax + key parity over
  `src/translations/`)
- `lint:specs` → `pnpm check-specs` (`node scripts/check-specs.js` — fails when a
  changed module under `src/features/`, `src/lib/` or `src/components/ui/` has no
  spec update; also runs in `.github/workflows/drift-check.yml`)
- `lint:all` → `pnpm check-all` (lint → type-check → translations → test →
  check-specs)

`agents/**`, `.agents/**`, `.claude/**`, `docs/`, `cli/` and the root
`session-*.md` transcripts are eslint-ignored, so editing docs there does not
show up in `pnpm lint`.
