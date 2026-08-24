# Expo

**This app cannot run in Expo Go.** It depends on native modules, so it needs a
development build. `ios/` and `android/` are generated and gitignored — a fresh
clone must prebuild before it can run anything. Full walkthrough:
[README — Running the app](../../../README.md#️-running-the-app).

## Commands
- `expo:setup` → `./setup.sh` (dependencies + `.env`; safe to re-run)
- `expo:prebuild` → `pnpm prebuild:development` (generates `ios/` + `android/`;
  add `--clean` to regenerate from scratch after native dependency changes)
- `expo:dev` → `pnpm start` (needs a dev build already installed)
- `expo:ios` → `pnpm ios`
- `expo:android` → `pnpm android`
- `expo:web` → `pnpm web`
- `expo:doctor` → `pnpm doctor`
- `expo:build:ios` → `pnpm build:production:ios`
- `expo:build:android` → `pnpm build:production:android`
- `expo:submit` → EAS submit. `eas.json` declares empty `submit.preview` and
  `submit.production` profiles; no pnpm script wraps it.

Preview and production variants exist for start/ios/android/prebuild
(`pnpm start:preview`, `pnpm android:production`, …). Each environment has its
own bundle ID, so the three installs coexist on one device.
