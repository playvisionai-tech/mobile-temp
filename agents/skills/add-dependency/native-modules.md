# Native modules — lookups

Reference for [`SKILL.md`](SKILL.md) steps 1, 2 and 5. This repo is on
**Expo SDK 54** (`expo ~54.0.37`, `react-native 0.81.5`, New Architecture on).

## Is it native?

Decide by inspection, not by reputation. A package is **native** if any of these
hold:

- it ships `expo-module.config.json`, an `android/` or `ios/` directory, or a
  `*.podspec`;
- it ships `app.plugin.js` or a `plugin/` entry (it wants a config plugin);
- it depends on `react-native-nitro-modules`, or ships a `nitrogen/` directory.

Check without installing:

```bash
npm view <pkg> --json | grep -iE '"(name|version)"|podspec|expo-module|nitro'
```

Anything native means a dev-client rebuild for the whole team. Say so in the
gate proposal, in the words given in `SKILL.md` §1.

JS-only packages still need the rest of the procedure — the wrapper, the specs,
the verification — they just skip the rebuild and usually the config plugin.

## Version: is Expo pinning it for us?

Expo publishes an SDK-pinned version table. The local copy is
`node_modules/expo/bundledNativeModules.json` (119 entries on SDK 54).

```bash
node -e "const m=require('./node_modules/expo/bundledNativeModules.json'); \
  const k=process.argv[1]; console.log(k, m[k] ?? 'NOT IN TABLE')" <pkg>
```

Quote the result in the gate proposal.

- **In the table** → `npx expo install <pkg>`. Takes the SDK-54 pin. Expo
  re-verifies it every SDK release.
- **Not in the table** → `pnpm add --save-exact <pkg>`. Nothing pins it. A caret
  range turns a future `pnpm install` into an unreviewed native upgrade, so pin
  exactly and record the ongoing cost in `decisions.md`: *the next Expo SDK
  upgrade must re-verify this by hand against the new React Native version.*

`npx expo install` shells out through pnpm here (`packageManager` pins
`pnpm@10.12.3`), so it updates the lockfile correctly. Check the diff anyway.

`expo install --check` reports drift across the whole project — useful, but it
will also want to "fix" the two packages in `expo.install.exclude`. Read its
output; do not blanket-apply.

Peer resolution is shaped by `.npmrc` (`auto-install-peers=true`,
`node-linker=hoisted`). Hoisted linking is what makes React Native autolinking
work here. Never "fix" a peer warning by changing linker mode.

## Config plugin

`plugins` in `app.config.ts` is an ordered array. Current entries:
`expo-splash-screen`, `expo-font`, `expo-localization`, `expo-router`,
`expo-secure-store`, `@clerk/expo`, `app-icon-badge`, `react-native-edge-to-edge`.

Add the entry in the same commit as the dependency, then:

```bash
pnpm prebuild:development           # regenerate ios/ and android/
pnpm prebuild:development --clean   # after native dependency changes
```

`ios/` and `android/` are generated and gitignored. Anything you place inside
them by hand is destroyed by `--clean` — native assets (Android drawables, for
instance) must be delivered by a config plugin or an Expo asset mechanism, not
dropped into the generated tree.

## Jest

`jest.config.js` `transformIgnorePatterns` is an **allowlist** of packages
allowed to ship untranspiled ESM. A new package that does will break the entire
suite, not just its own tests. Either add it to the alternation, or mock it in
`jest-setup.ts` — which already mocks `react-native-worklets` and
`react-native-reanimated`.

Editing `jest.config.js` is a config change in the ask-first spirit. Say so.

## What CI does and does not catch

The workflows in `.github/workflows/` run as independent parallel jobs; there is
no ordered pipeline. Relevant here:

- `expo-doctor.yml` triggers on `package.json` / `pnpm-lock.yaml` and runs a
  real `pnpm run prebuild`. **This is the job a dependency change actually
  risks.**
- `lint-ts.yml`, `type-check.yml`, `test.yml`, `drift-check.yml` never build
  native code. A native module can break every simulator in the team while all
  four stay green.
- Two of the three Android E2E workflows are label-gated (`android-test-github`,
  `android-test-maestro-cloud`); the third is `workflow_dispatch` only. None run
  by default. The EAS build workflows do build native, but only on manual
  dispatch or a published release — never on a PR.

So a green PR is not evidence that a native module works. Only a device run is.
