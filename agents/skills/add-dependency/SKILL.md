---
name: add-dependency
description: Add a JS dependency or native module to this Expo app. Use when a task needs a package that is not in package.json, when a config plugin entry or env var is required, or when the user asks whether a library can be added. Covers the ask-first gate, expo install vs pnpm add, the dev-client rebuild cost, wrapping the dependency, verification, spec/decisions updates, and rollback.
---

# Adding a dependency

`AGENTS.md` has a gate — "Ask first: adding any dependency" — but no procedure.
This is the procedure. Work through it in order.

The failure this prevents: an agent runs `pnpm add`, gets an SDK-mismatched
version, forgets the config plugin, skips the prebuild, and opens a PR that
passes CI (CI never builds native) and breaks every teammate's simulator on the
next `git pull`.

Lookups live beside this file:
- [`native-modules.md`](native-modules.md) — is it native, version pinning, prebuild, Jest
- [`wrappers.md`](wrappers.md) — the existing wrappers, including the two that leak

## 1. Gate — propose, then wait

Do **not** run an install command before approval. `pnpm add` mutates
`pnpm-lock.yaml`, and a half-reverted lockfile is the most common way this goes
wrong.

Post a proposal with:

1. **Package and exact version.**
2. **Native or JS-only?** Determined by inspection, not assumption — see
   [`native-modules.md`](native-modules.md).
3. **If native, say the rebuild cost explicitly.** `AGENTS.md` requires this:

   > This is a native module. Merging it invalidates every existing development
   > build. Every developer must re-run `pnpm prebuild:development` and
   > `pnpm ios` / `pnpm android`, and every EAS development build must be
   > re-issued. This app cannot run in Expo Go, so there is no fallback for
   > anyone who skips it.

4. **Alternatives considered**, including doing nothing or building it in-repo.
   This is the raw material for `decisions.md` later. If there is no honest
   alternative, say so — and skip `decisions.md` rather than padding it.
5. **Blast radius**: which `spec.md` files change, whether the
   `components/ui/spec.md` inventory changes, whether any `.maestro/` flow breaks.
6. **Maintenance signal**: last publish date, open issues, whether React Native
   Directory lists it (`expo-doctor` checks this in CI).

A native module needs a **named human** to approve, not another agent. A
JS-only dependency may proceed on the requesting user's approval.

## 2. Install

```
Is the package a key in node_modules/expo/bundledNativeModules.json?
├── yes → npx expo install <pkg>     # takes the SDK-54 pin
└── no  → pnpm add --save-exact <pkg>  # nothing pins this for us
```

Exact-pin anything outside Expo's table. That table is what protects the rest
of the dependencies across an SDK upgrade; packages absent from it have no such
protection, and a caret range turns a future `pnpm install` into an unreviewed
native upgrade. Mechanics and the check command: [`native-modules.md`](native-modules.md).

Confirm `pnpm-lock.yaml` changed in the same commit. Never hand-edit
`package.json` to add or drop a dependency.

## 3. Config plugin and env vars

- Add any `app.config.ts` `plugins` entry **in the same commit** as the
  dependency, then run `pnpm prebuild:development`.
- New env vars go through the Zod schema in `env.ts`. Client-readable vars need
  the `EXPO_PUBLIC_` prefix; anything without a prefix is build-time only. Add
  the variable to `.env.example` too.
- A third-party *secret* key does not belong in this repo at all — it belongs
  behind the API.
- Validation is strict only under `STRICT_ENV_VALIDATION=1`, which the
  `prebuild:*` scripts set. Run `pnpm prebuild:development` after touching
  `env.ts` to force it, or a missing variable surfaces much later.

Editing `app.config.ts`, `eas.json` or `env.ts` is itself an ask-first change.

## 4. Wrap it — the dependency does not get imported app-wide

**A third-party module gets exactly one import site in `src/`. Everything else
imports our wrapper.** This is the difference between swapping a library in an
afternoon and swapping it across forty files.

Route by the nature of the dependency, not by where it is first used:

| Nature of the dependency | Wrapper lives in | Shape |
|---|---|---|
| Renders something the user sees | `src/components/ui/<name>.tsx` | A component taking our props and our `className` |
| Infra: network, storage, auth, i18n, device APIs, analytics | `src/lib/<name>/` | A module with a named function/hook API |
| Only ever used by one feature, genuinely feature-specific | `src/features/<f>/` | Keep local; promote when a second feature needs it |

A wrapper is not a pass-through. Re-exporting the library unchanged buys
nothing. It must do at least one of: narrow the surface to what this app uses,
apply house defaults so call sites cannot get them wrong, adapt the library to
our conventions (`className` via uniwind, copy via `translate()`, theme tokens
instead of raw colors), or isolate the swap to one file.

Then:

1. Import the package in the wrapper **and nowhere else**.
2. UI primitive → export it from `src/components/ui/index.tsx` (the only barrel
   the project allows) **and add its row to `src/components/ui/spec.md`**.
3. New `src/lib/<name>/` module → it needs its own `spec.md` and `decisions.md`.
   `check-specs` fails without both.
4. Respect the promotion rule: a component moves into `components/ui/` once
   **≥2 features** use it and it holds no feature-specific logic. A first-use
   wrapper may legitimately start inside the feature. Do not pre-promote.
5. Prove it:

   ```bash
   grep -rn "<package-name>" src/ | grep -v <wrapper-path>
   ```

   This should return nothing. If it cannot, say why in `decisions.md`.

**Where this does not apply**: providers mounted once in `src/app/_layout.tsx`;
build-time and config-only packages; type-only dependencies; a package whose
entire API is one component rendered once. When skipping the wrapper, write one
line in the relevant `decisions.md` saying it was a choice — otherwise "no
wrapper" is indistinguishable from "forgot".

Read [`wrappers.md`](wrappers.md) before writing one. Two of the three wrappers
already in this repo leak, and knowing how is more instructive than the rule.

## 5. Verify

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm check-specs
pnpm doctor        # expo-doctor: SDK alignment + RN Directory
```

`pnpm check-all` runs the first four plus `lint:translations`, but **not**
`doctor`. Run `doctor` separately whenever `package.json` changed — CI does,
and `expo-doctor.yml` is the one workflow that actually builds native.

For a native module, none of the above proves it works. Build and run it on a
real simulator, and drive the affected screens (see `agents/rules/argent.md`).
Required when Argent is available; when it is not, say so explicitly rather
than reporting the change as verified.

## 6. Document

- Rewrite the `spec.md` of every module whose behavior changed. Never append
  "we added X".
- Append to `decisions.md` **only** for a genuine trade-off — chose A over B for
  a reason someone could question later. Date it. Put it where the code it
  constrains lives. A dependency nobody would argue about does not need one.
- A package outside Expo's pin table almost always warrants an entry, because
  the ongoing cost is real: nobody pins it for us, and the next SDK upgrade must
  re-verify it by hand.
- Wrapped in a new `src/lib/<name>/`? That module owes `spec.md` **and**
  `decisions.md` before `check-specs` will pass.

## 7. Rollback

Agree the trigger *before* starting — the expensive failure is a
half-reverted dependency.

```bash
pnpm remove <pkg>          # never hand-edit package.json
```

Then revert by hand, in this order: the `app.config.ts` plugins entry, the
`env.ts` field, the `.env.example` line, any `jest.config.js`
`transformIgnorePatterns` entry, the wrapper and its call sites, and any
`eas.json` change. Re-run `pnpm prebuild:development --clean`, then the full
verification block above. Confirm `pnpm-lock.yaml` returned to its previous
state.

## Traps specific to this repo

- `preinstall` runs `only-allow pnpm`. npm and yarn will refuse.
- CI installs with `--frozen-lockfile`. A `package.json` change without a
  matching `pnpm-lock.yaml` fails the build.
- `jest.config.js` `transformIgnorePatterns` is an **allowlist**. A package
  shipping untranspiled ESM must be added there or mocked in `jest-setup.ts`,
  or the whole suite breaks.
- `package.json` → `expo.install.exclude` holds `eslint-config-expo` and
  `react-native-worklets`. `expo install --fix` will fight those. Adding to that
  list is itself an ask-first change.
- `expo.doctor.reactNativeDirectoryCheck.exclude` is the escape hatch when
  expo-doctor flags an unlisted package. Use it deliberately, not to silence.
- `.husky/post-merge` greps for `pnpm-lock.yml` — one letter short of
  `pnpm-lock.yaml` — so the automatic post-merge install **never fires**. After
  pulling a dependency change, run `pnpm install` yourself.
