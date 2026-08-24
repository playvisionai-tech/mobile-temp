# hooks — decisions

Entries below predate this file. They were reconstructed from the code and
from the commits that introduced each choice (referenced inline); nothing here
is invented rationale.

## 2022-12-08 — `useIsFirstTime` treats "unset" as first run (`0c708ff`)
**Chose:** Return `true` when the `IS_FIRST_TIME` key is absent
**Over:** Seeding the key to `true` on install and reading it plainly
**Why:** A fresh install has no key, and a seed write needs somewhere to run before anything reads it — one more startup step that can be skipped or ordered wrong. Defaulting on absence makes the hook correct with no bootstrap at all.
**Trade-off:** "Never onboarded" and "storage was cleared" are indistinguishable, so wiping app data replays onboarding. There is also no way to express a third state (unknown) if the flag ever needs to be server-driven.

## 2023-05-10 — MMKV as the store for both hooks (`0c708ff`, `c9cf7ab`)
**Chose:** `useMMKVBoolean` / `useMMKVString` against the shared storage instance in `src/lib/storage.tsx` (moved to `createMMKV()` in `829da2f`)
**Over:** `AsyncStorage`, or a Zustand store with a persist middleware
**Why:** Both values are needed *before* the first render — `loadSelectedTheme()` runs at module scope in the root layout, and the `(app)` route guard reads `useIsFirstTime()` on its first pass. MMKV reads are synchronous, so there is no undefined window to render around; an async store would force a loading state into the guard.
**Trade-off:** MMKV is a native module, so these hooks cannot run in a plain JS environment without a mock, and the values are stored unencrypted. Acceptable here because neither value is sensitive — a first-run flag and a theme name.

## 2023-05-10 — `loadSelectedTheme()` is a function, not a hook (`c9cf7ab`)
**Chose:** A plain exported function called at module scope from `src/app/_layout.tsx`, alongside the `useSelectedTheme` hook
**Over:** Applying the stored theme from an effect inside the root layout component
**Why:** An effect runs after the first paint, so a dark-theme user would see a light frame flash before the theme applied. Reading MMKV and applying the theme at import time happens before React renders anything.
**Trade-off:** It is a module-scope side effect on import — it makes `use-selected-theme.tsx` impure, it runs in any test that imports the root layout, and it silently does nothing if `src/app/_layout.tsx` ever stops calling it, with the only symptom being a theme flash nobody attributes to this file. It is also why `src/lib/hooks/index.tsx` carries a `react-refresh/only-export-components` escape hatch.

## 2026-01-21 — `setSelectedTheme` applies and persists in one call (`7355a9b`)
**Chose:** `setSelectedTheme` calls `Uniwind.setTheme(t)` and writes MMKV together
**Over:** Persisting only, and letting a subscriber apply the theme
**Why:** After the move off NativeWind there is no single subscriber — Uniwind holds the live theme, MMKV holds the preference. Writing both in one callback means the visible theme and the stored preference can never disagree.
**Trade-off:** The hook is no longer a pure setter, and any other writer of the `SELECTED_THEME` key would leave the two out of sync. This is why `spec.md` states the hook is only for *selecting* the theme — styling by theme goes through `useUniwind()`.
