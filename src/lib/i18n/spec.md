# i18n — current behavior

## What this feature does
Internationalization setup: locale detection, translation loading, RTL support,
and the `translate()` helper features call to render copy.

## Behavior
- Locales: English (`en.json`) and Arabic (`ar.json`) in `src/translations/`,
  both bundled statically by `src/lib/i18n/resources.ts`.
- i18next is initialized once when `@/lib/i18n` is first imported. The starting
  language is the stored preference, else the device locale, falling back to `en`.
- `translate(key, options?)` returns a string for a `TxKeyPath` — a type derived
  recursively from `en.json`, so an unknown key is a type error. Results are
  memoized per key + options.
- The language preference is persisted in MMKV under the `local` key.
  `useSelectedLanguage()` returns `{ language, setLanguage }`.
- `setLanguage(lang)` persists the choice, applies `I18nManager.forceRTL` for
  Arabic, and then restarts the app so the new direction takes effect.
- `isRTL` is computed at init from `i18n.dir()`, and `I18nManager.allowRTL` /
  `forceRTL` are applied at module scope on import.

## Entry points
- Everything is exported from `src/lib/i18n/index.tsx`: `translate`,
  `changeLanguage`, `useSelectedLanguage`, `getLanguage`, `isRTL`, `TxKeyPath`,
  and the i18next instance as the default export.
- Implementation lives in `src/lib/i18n/utils.tsx`; the locale map is in
  `resources.ts`; `react-i18next.d.ts` types the i18next module augmentation.
- There is no provider component and no `useTranslation` wrapper — features
  import `translate` directly.

## Platform differences
- iOS and Android: RTL requires `I18nManager.forceRTL` plus an app restart
  (`DevSettings.reload()` in dev, `react-native-restart` in production).
- Web: the restart is `window.location.reload()`.

## Out of scope
- Dynamic locale loading (all locales bundled).
- Pluralization rules beyond simple key lookup.
- Re-rendering on language change without a restart.
