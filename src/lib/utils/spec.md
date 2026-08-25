# utils — current behavior

## What this feature does
Two unrelated general-purpose helpers that belong to no feature: opening an
external URL, and adding per-field selector hooks to a Zustand store. Neither has
a production caller today — both are template scaffolding kept for the first code
that needs them, and only the tests in this module import them.

## Behavior
- `openLinkInBrowser(url)` calls `Linking.canOpenURL(url)` and opens the URL with
  `Linking.openURL` only if the platform reports it can. It returns `void`, not the
  promise, so callers cannot await the result or observe a failure.
- `createSelectors(store)` mutates the passed Zustand store, attaching a `use`
  object with one hook per key present in `store.getState()` at call time, and
  returns the same store typed as `WithSelectors<S>`. `store.use.count()` is then
  equivalent to `store(s => s.count)`.
- The key set is snapshotted when `createSelectors` runs. Fields added to the state
  afterwards get no selector.

## Entry points
- `openLinkInBrowser` and `createSelectors` from `@/lib/utils`.
- No production module imports either one. `createSelectors` is written against
  the Zustand store shape described in AGENTS.md; no such store exists yet.

## Platform differences
- `openLinkInBrowser` inherits whatever `Linking.canOpenURL` reports per platform —
  on iOS an unlisted URL scheme is reported unopenable, which is the case this
  helper's guard exists for.

## Out of scope
- Reporting failure. `openLinkInBrowser` swallows the result of both calls; a URL
  that cannot be opened produces no error and no feedback.
- Selectors for nested or computed state. `createSelectors` only walks the
  top-level keys of the state object.

## Note on the name
`src/lib/api/`, `src/lib/auth/`, `src/lib/i18n/` and `src/components/ui/` each have
their own unrelated `utils` file. This module is not their parent or a shared base
— it is only the helpers that had no other home.
