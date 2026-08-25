# Mobile App — Agent Guide

You are a senior React Native engineer working in an Expo app.
TypeScript strict. Small, reviewable diffs. Match surrounding code.

## Where things live

src/app/          Expo Router. Leaf routes are re-exports; the two
                  _layout.tsx files own the navigator and the guard.
                  Has spec.md (route inventory) and decisions.md.
src/features/     Vertical slices. One folder per capability.
src/components/ui Design system primitives.
src/lib/          Cross-cutting infra: api, auth, i18n, hooks, test-utils.
src/translations/ All user-facing strings.
__tests__/        One per directory that has something to test.
                  There is no root one.
.maestro/         E2E flows, by user journey.

## Read before you write  ← do this first, every task

| If the task touches…                    | Open first                                    |
|-----------------------------------------|-----------------------------------------------|
| how the app fits together (new here?)   | ARCHITECTURE.md                               |
| a feature                               | src/features/<f>/spec.md  then  decisions.md |
| creating a new feature                  | .templates/spec.md → src/features/<f>/spec.md |
| modifying feature behavior              | src/features/<f>/spec.md  then  decisions.md |
| any lib module (api, auth, i18n, hooks) | src/lib/<mod>/spec.md  +  decisions.md        |
| adding or moving a route                | src/app/spec.md  (route inventory)            |
| navigation, route groups, guards        | src/app/spec.md  then  decisions.md           |
| adding UI component                     | src/components/ui/spec.md  (inventory)        |
| any UI at all                           | src/components/ui/spec.md   (the inventory)   |
| network / API calls                     | src/lib/api/spec.md                           |
| login, tokens, session                  | src/lib/auth/spec.md + decisions.md           |
| copy, locales, RTL                      | src/lib/i18n/spec.md                          |
| writing any test                        | src/lib/test-utils.tsx                        |
| adding a dependency or native module    | agents/skills/add-dependency/SKILL.md         |
| commands / scripts                      | agents/commands.md                            |
| running the app, simulator, device      | README.md → "Running the app"                 |
| driving a real simulator (Argent MCP)   | agents/rules/argent.md                        |
| product or domain rules                 | agents/knowledge-base.md                      |

`spec.md` = what it does today (present tense, always current).
`decisions.md` = why it's that way, and what was rejected. Append-only.
If a spec contradicts the code, the code is right and the spec is a bug —
fix the spec in the same change.

## Do

- **Every feature/lib/UI module with testable behavior MUST have `spec.md` and
  `decisions.md`** — that means every `src/features/<f>/`, every `src/lib/<mod>/`,
  and `src/components/ui/`. `pnpm check-specs` enforces both files.
- **When behavior changes, rewrite `spec.md` in the same PR — never append "we added X".**
  The drift check fails a module whose code changed while its `spec.md` did not.
- **Append to `decisions.md` only for genuine trade-offs (chose A over B for reason).**
  Existence is enforced; per-change entries are not — do not pad it.
- **Run `pnpm check-specs` before committing if you touched feature/lib/UI/route code**
- Leaf routes in src/app/ contain a re-export and nothing else; the two
  `_layout.tsx` files are the accepted exception, since the navigator and the
  auth guard have to be declared there. `src/app/spec.md` is the route
  inventory — which URLs exist and which feature screen each renders — and it
  is NOT a copy of the feature specs, which stay the source of truth for screen
  behavior. `src/app/decisions.md` holds navigator shape, route groups and
  guard ordering, which belong to no single feature.
- **Never create a new UI primitive before reading components/ui/spec.md.**
  If something there fits, use it. This is the most common mistake.
- **Tests go in a `__tests__/` folder in the SAME directory as the file under
  test.** `features/auth/login-screen.tsx` → `features/auth/__tests__/
  login-screen.test.tsx`. Create the folder if it does not exist yet.
- **Keep every `__tests__/` flat.** It covers only its immediate parent
  directory. Never put a subdirectory inside it — a file in `components/`
  is tested from `components/__tests__/`, not from the parent's.
- Directories with nothing to test — src/translations/ — get no `__tests__/`.
  Never create an empty one to satisfy the pattern.
- **There is no root `__tests__/`, and there is no exception to the directory
  rule.** Every test sits beside the file it covers, src/app/ included — it is
  a module like any other. Something genuinely cross-cutting, that belongs to
  no single directory, is a Maestro E2E flow in `.maestro/`, not a unit test.
- Render components with `setup` (userEvent + providers) or `render` from
  lib/test-utils, not RNTL's bare `render`.
- Server state → React Query. Client state → Zustand. Never the same data in
  both. No Zustand store exists yet — that half is the shape to follow when one
  is needed, not a description of the code. Durable client state (theme,
  first-run) goes to MMKV via lib/hooks.
- All strings → src/translations/en.json. Never inline user-facing text.
- Import with @/ absolute paths. No barrel files except components/ui.
- Styling via Tailwind classes (uniwind) and theme tokens from src/global.css.
  No hex values, no magic spacing. There is no tailwind.config.js.
- Use `Text` from components/ui, never React Native's `Text`.

## Don't

- **Don't create a new feature folder without `spec.md` + `decisions.md`**
- **Don't modify behavior without updating the module's `spec.md`**
- **Don't skip the drift-check CI — it will block the PR**
- Cross-feature imports. features/a must not import from features/b.
  Share via components/ui or lib.
- Business logic in src/app/.
- Hand-rolled fetch. Use the client in lib/api.
- Test implementation details. Assert what a user or caller can observe.
- Put helpers or fixtures inside `__tests__/` — those go in lib/test-utils.
- New dependency, native module, or config change without asking.

## Ask first

**Procedure for all three of the below: `agents/skills/add-dependency/SKILL.md`.**
It covers the gate, `expo install` vs `pnpm add`, wrapping the dependency, and
rollback. Read it before proposing, not after approval.

- Adding a native module (requires a new dev client build — say so explicitly)
- Changes to app.config.ts, eas.json, or env.ts
- Adding any dependency
- Deleting a feature folder (its spec.md, decisions.md, and __tests__/ go with it)

## Definition of done

1. `pnpm lint && pnpm type-check` succeeds.
2. New behavior has a test in the `__tests__/` folder of the directory that implements it.
3. **Update the `spec.md` of every feature or lib module whose behavior changed. Rewrite it to describe the new reality — never append "we added X".**
4. **Append to `decisions.md` only if a real fork in the road was taken (chose A over B for a reason someone could question later). Date it. Put it where the code it constrains lives — a decision that constrains the navigator rather than one feature goes in `src/app/decisions.md`.**
5. If you added a component to components/ui, add its row to that inventory.
6. **`pnpm check-specs` passes.** It fails when a changed module is missing
   `spec.md` or `decisions.md`, and when a module's code changed but its
   `spec.md` did not. CI runs the same script against the PR base.

## Detail (load on demand)

- ARCHITECTURE.md     — **start here.** How the app is put together: slices,
  runtime stack, provider tree, data flow, the spec system, and the deviations
  from this guide that are real today. It links out rather than restating.
- agents/rules/       — engineering rules, one file per topic
- agents/commands.md  — full command reference
- agents/knowledge-base.md — product domain and business rules (nearly empty:
  this is a template, not a product yet)
- README.md "Running the app" — dev build, prebuild, environments.
  This app cannot run in Expo Go; `pnpm start` alone is not enough on a
  fresh clone.
