# utils — current behavior

## What this feature does
One general-purpose helper that belongs to no feature: opening an external URL.
It has no production caller today — it is template scaffolding kept for the first
code that needs it, and only the tests in this module import it.

## Behavior
- `openLinkInBrowser(url)` awaits `Linking.canOpenURL(url)` and opens the URL with
  `Linking.openURL` only when the platform reports it can. Both promises are
  discarded — the function returns `void`, not the promise, so neither a false
  answer nor a failed open reaches the caller.

## Entry points
- `openLinkInBrowser` from `@/lib/utils`.
- No production module imports it.

## Platform differences
- `openLinkInBrowser` inherits whatever `Linking.canOpenURL` reports per platform —
  on iOS an unlisted URL scheme is reported unopenable, which is the case this
  helper's guard exists for.

## Out of scope
- Reporting failure. `openLinkInBrowser` swallows the result of both calls; a URL
  that cannot be opened produces no error and no feedback.
- Store selector helpers. There is no Zustand store in the app and `zustand` is
  not a dependency; when a feature first needs client state, it adds both in its
  own slice per AGENTS.md.

## Note on the name
`src/lib/api/`, `src/lib/auth/`, `src/lib/i18n/` and `src/components/ui/` each have
their own unrelated `utils` file. This module is not their parent or a shared base
— it is only the helpers that had no other home.
