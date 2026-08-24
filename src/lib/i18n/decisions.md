# i18n — decisions

Entries below predate this file. They were reconstructed from the code and
from the commits that introduced each choice (referenced inline); nothing here
is invented rationale.

## 2022-09-13 — i18next, called through a plain `translate()` (`cb5faaa`)
**Chose:** `i18next` + `react-i18next`, initialized once at module scope in `src/lib/i18n/index.tsx`; features import the `translate()` helper rather than a hook
**Over:** A hand-rolled key lookup over the JSON files, or requiring `useTranslation()` at every call site
**Why:** RTL, interpolation and fallback locales all have to work, and `TxKeyPath` — derived recursively from `en.json` — makes a missing or misspelled key a type error. A plain function works in the places a hook cannot: `showErrorMessage(translate('login.failed'))` inside a submit handler, option arrays built outside render.
**Trade-off:** i18next is a sizable dependency for two locales, and its init is a module-scope side effect — importing anything from `@/lib/i18n` boots the whole instance, so tests cannot construct an isolated one. Because `translate()` is not a hook, a component that calls it does not re-render when the language changes; the app is restarted instead (see below), which is what makes that safe.

## 2022-09-21 — Language resolved synchronously at init (`5470882`)
**Chose:** `lng: getLanguage() || getLocales()[0]?.languageTag`, evaluated when the module is imported, reading the stored preference straight out of MMKV
**Over:** Initializing with a default and switching to the stored language from an effect
**Why:** i18next reads `lng` at init; setting it afterwards means the first render is in the wrong language and then flips. The MMKV read is synchronous, so the right language is known before i18next initializes.
**Trade-off:** Ties this module to MMKV at import time — it cannot be handed an injected preference, the same coupling that makes it hard to test in isolation.

## 2022-09-21 — All locales bundled, none loaded on demand (`5470882`)
**Chose:** `resources.ts` statically imports `en.json` and `ar.json` into the i18next `resources` map
**Over:** Fetching or lazily importing a locale once the language is known
**Why:** The language is decided before the first render and both files are small. Static imports mean no loading state and no network path, and they let `en.json` be the source of the `TxKeyPath` type.
**Trade-off:** Every locale ships in every bundle, so this stops scaling somewhere past a handful of languages, and adding one means editing `resources.ts` rather than dropping in a file.

## 2023-07-20 — Changing language restarts the app (`6f705fa`)
**Chose:** `changeLanguage()` calls `I18nManager.forceRTL()` and then restarts — `DevSettings.reload()` in dev, `react-native-restart` in production, `window.location.reload()` on web
**Over:** Re-laying out live on language change, and over `expo-updates`' reload (which this commit removed)
**Why:** `I18nManager.forceRTL` does not affect already-mounted native views; direction only takes effect on a fresh start, so without a restart Arabic leaves the app half-flipped. `expo-updates` was being carried as a dependency purely to expose a reload function.
**Trade-off:** A visible, jarring restart on every language change and all in-memory state is lost, plus `react-native-restart` is a native module added for this one call. It also makes language switching untestable without mocking the restart.

## 2023-07-20 — `translate()` memoized with no invalidation (`6f705fa`)
**Chose:** `lodash.memoize` over `translate`, keyed on the translation key plus a JSON dump of the options
**Over:** Calling `i18n.t()` directly on every render
**Why:** `translate()` is called during render in list rows and option arrays, and its result for a given key cannot change while the app is running — the restart above guarantees the process never outlives a language change.
**Trade-off:** The cache is never cleared, so this is only correct as long as language changes restart the app. Anything that makes the switch in-place — dropping the restart, or hot-reloading a locale — will silently keep serving the previous language until someone connects the two decisions.
