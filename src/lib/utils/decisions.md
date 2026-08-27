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

## 2026-08-27 — Deleted `createSelectors` and the `zustand` dependency
**Chose:** Remove the helper, its tests, its type-only `zustand` import, the
`zustand` declaration in `package.json`, and the now-inert `zustand` entry in
`jest.config.js` `transformIgnorePatterns`
**Over:** Keeping it as a ready-made seam for the first Zustand store, which is
what the 2026-08-25 entry above decided
**Why:** That entry kept the helper to preserve guidance, but the guidance lives
in AGENTS.md, which already says a store belongs to its feature at
`src/features/<name>/store.ts` and that one is created **only when the feature
already has client state to hold** — "Most features need no store". A global
selectors helper waiting for a store that may never arrive is exactly the
speculative shape that guide warns against, and it actively misleads: a reader
finds a store-selectors utility in `src/lib/` and reasonably infers there are
stores to use it on. There are none — the last one went with
`use-auth-store.tsx` in the Clerk migration. Deleting it also drops a dependency
nothing imports at runtime.
**Trade-off:** The first feature that genuinely needs a store gets no head start
— it has to run `pnpm add zustand` (through the add-dependency gate) and, if it
wants per-field hooks, write the ~10 lines again; with no direct pin left, that
`pnpm add` can also resolve a version different from the `zustand@5.0.3` already
hoisted into the tree as a transitive dependency of `@clerk/expo`, leaving two
copies installed.
