# utils — decisions

Entries below predate this file. They were reconstructed from the code and from
the commits that introduced each choice (referenced inline); nothing here is
invented rationale.

## 2023-02-13 — `createSelectors` as an opt-in wrapper, not a store factory (`3ea04d7`)
**Chose:** A function that takes an already-created store and attaches `.use.<field>()`
**Over:** A `createStore` wrapper that every store must be built through
**Why:** It leaves `create()` from Zustand as the store constructor, so a store gains
the auto-selectors by being passed through one extra call and loses nothing if it is
not. Nothing has to be rewritten to adopt or drop it.
**Trade-off:** It mutates the store it is given and casts through `any` to do so, so
the per-field hooks exist only if someone remembers the wrap — the compiler cannot
tell a wrapped store from an unwrapped one at the call site.

## 2026-08-25 — Promoted from `src/lib/utils.ts` to `src/lib/utils/`
**Chose:** A directory module with `index.ts`, `spec.md` and `decisions.md`
**Over:** Leaving it loose in `src/lib/`, or deleting it as dead code
**Why:** `getModuleDir()` in `scripts/spec-modules.js` returns `null` for a loose
file directly under `src/lib/`, so nothing enforced a spec here. Deleting it was the
alternative — both exports are unused — but `createSelectors` is the shape the first
Zustand store is meant to take per AGENTS.md, and removing it would quietly drop that
guidance. Documenting it as unused keeps the intent visible instead.
**Trade-off:** The repo now carries a specced module with no production callers, and
`src/lib/utils` sits alongside four other unrelated `utils` files. The spec says so
explicitly rather than letting the name imply a shared base.
