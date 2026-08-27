# CI/CD Rules

## Rule
- **CI runs in parallel, not in sequence.** `.github/workflows/` holds independent workflows — `lint-ts`, `type-check`, `test`, `drift-check`, the EAS build and E2E ones — each triggering on its own. There is no `ci.yml` and nothing sequences them, so expect several failures at once rather than the first one only.
- **Local order** — `pnpm check-all` runs `lint → type-check → lint:translations → test → check-specs → doctor` and stops at the first failure. That ordering is a local-loop convention, not what CI does.
- **`doctor` is last, and it is the only networked step.** `pnpm run doctor` (`npx expo-doctor@latest`) resolves the CLI from npm and queries the React Native Directory, so it costs ~4s on a warm npx cache (more on a cold one or a slow link), against ~18s for the five local steps before it. Cheap-first means it goes at the end: a local failure — a lint error, a red test, a stale spec — is reported without ever paying for the network. It is deliberately **not** in `.husky/pre-commit`, which still runs only `pnpm type-check` and `pnpm lint-staged`.
- **`SKIP_DOCTOR` is the offline escape hatch.** `SKIP_DOCTOR=1 pnpm check-all` runs every local step and skips doctor. It exists because doctor is useless without a network and not free about it: two of its 18 checks must reach Expo's servers, so offline `check-all` burns ~93s failing on them after all five local checks have already passed — against ~24s green with the hatch. Implemented in the `doctor` script itself, so a direct `pnpm run doctor` honours it too. Reach for it when offline, not to make a red gate green: doctor is the only local check that catches a dependency drifting off the SDK pin table, and CI (`expo-doctor.yml`) runs it on every PR touching `package.json` or the lockfile regardless.
- **`expo install --check` is not chained, on purpose.** expo-doctor's `InstalledDependencyVersionCheck` already spawns `expo install --check` itself, forcing `CI=1` and piping stdio. Running it a second time from `check-all` would add no coverage and would run it in the one place it is unsafe: in a developer's TTY, `expo install --check` prompts `Fix dependencies?` and on a yes **installs packages**, mutating `package.json` and `pnpm-lock.yaml` from inside a gate that is supposed to only verify. Let doctor own that check.
- **Drift check** — CI blocks a PR if code in a module (`src/features/*`, `src/lib/*`, `src/components/ui`, `src/app`) changes without its `spec.md` changing too. `scripts/spec-modules.js` defines what counts as a module.
- **Spec freshness** — when behavior changes, rewrite `spec.md` to reflect new reality (present tense, never append "we added X"). Append to `decisions.md` only for genuine trade-offs.

## Rationale
Parallel workflows give the whole verdict on one push instead of one failure per round-trip. The local order is the cheap-first ordering for a human loop. Drift check ensures documentation stays current. Spec freshness prevents stale docs from misleading agents and engineers.

## Examples

### Good (PR passes)
```bash
# Locally, before pushing — same checks CI runs, in a cheap-first order.
pnpm check-all
```

```yaml
# .github/workflows/drift-check.yml — one workflow per check, all independent.
# It runs the identical script `pnpm check-specs` runs locally.
- name: Check spec updates
  env:
    BASE_REF: ${{ github.base_ref }}
  run: node scripts/check-specs.js --base "origin/$BASE_REF"
```

```markdown
# spec.md (rewritten)
## Behavior
- User can sign in with email/password
- Session persists across app restarts via Clerk's token cache (expo-secure-store)
- On 401, user is signed out and redirected to login
```

```markdown
# decisions.md (appended)
## 2026-08-20 — Migrated to Clerk for authentication
**Chose:** @clerk/expo + @clerk/react
**Over:** Custom JWT + MMKV token storage
**Why:** Clerk handles session management, MFA, and device verification out of the box
**Trade-off:** Additional dependency; vendor lock-in for auth
```

### Bad (PR fails)
```markdown
# spec.md (appended — WRONG)
## Behavior
- User can sign in with email/password
- We added Clerk integration in August 2026  # ❌ Never append "we added"
```

```markdown
# decisions.md (behavior description — WRONG)
## 2026-08-20
We changed auth to use Clerk because it's better.  # ❌ No trade-off, no alternatives
```

## Enforcement
- CI: `.github/workflows/drift-check.yml` blocks a PR on a missing or unchanged spec
- CI: `lint-ts.yml`, `type-check.yml` and `test.yml` run independently on the same PR
- ESLint: `local/spec-required` gives the same feedback in the editor and in `pnpm lint`
- ESLint: the type-aware rule set is on — `eslint.config.mjs` passes `tsconfigPath`
  to the TypeScript config, which is what activates `no-floating-promises`,
  `no-misused-promises` and the rest. It is therefore slower than a syntax-only
  lint and needs `tsconfig.json` to resolve. Its two relaxations and its
  exemption for test scaffolding are commented where they are declared.
- Review: verify spec.md rewritten (not appended), decisions.md appended only for trade-offs
- Local: **`.husky/pre-commit` runs `pnpm type-check` and `pnpm lint-staged` only — it does not run `check-specs`.** Run `pnpm check-specs` yourself before committing, or CI will be the first to tell you.
