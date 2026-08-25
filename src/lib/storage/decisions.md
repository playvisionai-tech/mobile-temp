# storage — decisions

Entries below predate this file. They were reconstructed from the code and from
the commits that introduced each choice (referenced inline); nothing here is
invented rationale.

## 2023-05-10 — One shared MMKV instance rather than per-feature stores (`677725d`)
**Chose:** A single module-scope `storage` instance that every caller imports
**Over:** An instance per feature, or passing a store through context
**Why:** MMKV reads are synchronous, which is the property `src/lib/hooks/` and
the route guard depend on — they read at module scope and on first render, before
any provider could have run. A module-scope singleton is available at import time;
a context-provided store is not. One instance also means one native mock in
`jest-setup.ts` instead of one per feature.
**Trade-off:** No namespacing — every caller writes into the same flat key space,
so key collisions are prevented only by convention. It is also global mutable
state, so tests must clear it between cases rather than construct a fresh store.

## 2026-01-21 — `createMMKV()` over the class constructor (`829da2f`)
**Chose:** `createMMKV()` and the `remove` method name
**Over:** Staying on `new MMKV()` / `delete`
**Why:** react-native-mmkv moved its public surface to the factory function; the
old constructor form is the deprecated path and pinning to it would have blocked
future upgrades of the native module.
**Trade-off:** A breaking rename that had to be applied at every call site at once,
and it dates the module to a specific major of the library.

## 2026-08-25 — Promoted from `src/lib/storage.tsx` to `src/lib/storage/`
**Chose:** A directory module with `index.tsx`, `spec.md` and `decisions.md`
**Over:** Leaving it as a loose file directly in `src/lib/`
**Why:** `getModuleDir()` in `scripts/spec-modules.js` returns `null` for a path
with no further slash after `src/lib/`, so a loose file belongs to no module and
`check-specs` never guarded it — this file, which every persisted value in the app
passes through, was the least documented thing in `src/lib/`. Import paths were
unaffected: `@/lib/storage` and `../storage` both resolve to the directory index.
**Trade-off:** One more directory level for a single ~16-line file, and the module
now owes a spec rewrite on any behavior change like every other lib module.
