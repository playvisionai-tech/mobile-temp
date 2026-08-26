# CI/CD Rules

## Rule
- **CI runs in parallel, not in sequence.** `.github/workflows/` holds independent workflows — `lint-ts`, `type-check`, `test`, `drift-check`, the EAS build and E2E ones — each triggering on its own. There is no `ci.yml` and nothing sequences them, so expect several failures at once rather than the first one only.
- **Local order** — `pnpm check-all` runs `lint → type-check → lint:translations → test → check-specs` and stops at the first failure. That ordering is a local-loop convention, not what CI does.
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
