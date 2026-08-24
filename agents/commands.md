# Command Reference

Every command an agent needs, by topic. The `topic:name` labels are shorthand
for the command on the right — no runner accepts them, run the command itself.
Argent is the only MCP server in this repo; see the last section.

## expo

**This app cannot run in Expo Go.** It depends on native modules, so it needs a
development build. `ios/` and `android/` are generated and gitignored, so a
fresh clone must prebuild before it can run anything. Full walkthrough,
including the platform toolchain and troubleshooting:
[README — Running the app](../README.md#️-running-the-app).

- `expo:setup` – `./setup.sh` (dependencies + `.env`; safe to re-run)
- `expo:prebuild` – `pnpm prebuild:development` (generates `ios/` + `android/`;
  add `--clean` to regenerate from scratch after native dependency changes)
- `expo:dev` – `pnpm start` (needs a dev build already installed)
- `expo:ios` – `pnpm ios`
- `expo:android` – `pnpm android`
- `expo:web` – `pnpm web`
- `expo:doctor` – `pnpm doctor`
- `expo:build:ios` – `pnpm build:production:ios`
- `expo:build:android` – `pnpm build:production:android`
- `expo:submit` – EAS submit (if configured)

Preview and production variants exist for start/ios/android
(`pnpm start:preview`, `pnpm android:production`, …). Each environment has its
own bundle ID, so the three installs coexist on one device.

## clerk
No CLI, no scripts. Auth is Clerk, exercised by running the app.
- `ClerkProvider` + `tokenCache` — `src/app/_layout.tsx`
- sign-in `useSignIn()` — `src/features/auth/login-screen.tsx`
- gating `useAuth()` — `src/app/(app)/_layout.tsx`
- sign-out `useAuth().signOut()` — `src/features/settings/settings-screen.tsx`
- request token `getClerkInstance()` — `src/lib/api/client.tsx`
- keys `EXPO_PUBLIC_CLERK_*` — validated in `env.ts`, samples in `.env.example`

Read `src/features/auth/spec.md` before changing any of it. Details:
[agents/skills/clerk](skills/clerk/README.md).

## testing
- `testing:unit` – `pnpm test`
- `testing:watch` – `pnpm test:watch`
- `testing:coverage` – `pnpm test:ci` (`jest --coverage`)
- `testing:e2e` – `pnpm e2e-test`
  (`maestro test .maestro/ -e APP_ID=com.obytes.development`).
  Maestro is not a dependency — install it once with `pnpm install-maestro`.
- React Query devtools: no command. `@dev-plugins/react-query` is wired into
  `src/lib/api/provider.tsx`; open it from the Expo dev menu in a dev build.

## lint
- `lint:lint` – `pnpm lint`
- `lint:fix` – `pnpm lint:fix`
- `lint:typecheck` – `pnpm type-check`
- `lint:translations` – `pnpm lint:translations`
- `lint:specs` – `pnpm check-specs` (spec drift; also runs in CI)
- `lint:all` – `pnpm check-all` (lint → type-check → translations → test →
  check-specs)

## build
- `build:ios` – `pnpm build:production:ios`
- `build:android` – `pnpm build:production:android`
- development and preview variants exist for both platforms
  (`pnpm build:preview:ios`, …). All of them shell out to `eas build`, and
  **`eas-cli` is not installed** — `npm i -g eas-cli` first.
- `build:release` – `pnpm app-release <patch|minor|major>` (`np`: bump, prebuild,
  tag, push). Normally run by the **New App Version** workflow, not locally.
- No changelog command and no `CHANGELOG.md` — GitHub generates release notes
  from the tag (`.github/workflows/new-github-release.yml`).

## argent (MCP server)
Argent drives a real simulator/emulator. It is installed as a devDependency and
registered in `.mcp.json`, so it is available after `pnpm install` — no global
install, no `argent init`. It is not invoked by name from this file; the agent
loads one of the installed skills instead:

- `argent-ios-simulator-setup` / `argent-android-emulator-setup` — boot a device
- `argent-device-interact` — tap, swipe, type, screenshot, launch apps
- `argent-test-ui-flow` — interact/screenshot/verify loops over a UI flow
- `argent-metro-debugger` — console logs, network, React tree via Metro/CDP
- `argent-react-native-profiler` / `argent-native-profiler` — performance
- `argent-qa-flows` / `argent-create-flow` — record and replay flow YAML
- `argent-screen-recording`, `argent-screenshot-diff`, `argent-lens`,
  `argent-settings-permissions`, `argent-tv-interact`

Requires a development build — this app cannot run in Expo Go. See
`agents/rules/argent.md` and `.agents/skills/<name>/SKILL.md` for details.

CLI (rarely needed directly):
- `pnpm exec argent tools` — list the MCP tool surface
- `pnpm exec argent server status` — check the shared tool-server
