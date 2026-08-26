# storage — current behavior

## What this feature does
The app's single MMKV instance, plus three thin JSON helpers over it. Everything
in the app that persists client state — auth tokens, the selected locale, the
first-run flag, the theme preference — reads and writes through this module, so
there is exactly one native store to mock in tests and one place where the key
space lives.

## Behavior
- `storage` is the shared instance returned by `createMMKV()`. It is exported
  directly, and callers that need a typed primitive (`storage.getString`,
  `useMMKVBoolean`) use it rather than the helpers below.
- `getItem<T>(key)` reads the key as a string and `JSON.parse`s it. It returns
  `null` when the key is unset, when the stored string is empty, and when the
  parsed value is itself `null`. A parsed `0`, `false` or `""` is returned as
  stored — only nullish parses collapse to `null`. `T` is the caller's claim
  about the shape; nothing validates it.
- `setItem<T>(key, value)` `JSON.stringify`s the value and writes it.
- `removeItem(key)` deletes the key.
- `setItem` and `removeItem` are declared `async` and so return promises, but the
  MMKV writes underneath them are synchronous and complete before the promise is
  returned. `getItem` is plainly synchronous.

## Entry points
- Instance: `storage` from `src/lib/storage` — used by `src/lib/hooks/` and
  `src/lib/i18n/utils.tsx`.
- Helpers: `getItem` / `setItem` / `removeItem` from `src/lib/storage` — used by
  `src/lib/auth/utils.tsx` for the auth token.

## Platform differences
- None. MMKV handles iOS and Android internally.

## Out of scope
- Encryption. `createMMKV()` is called with no encryption key, so values are
  stored in plaintext.
- Namespacing or migration. There is one unpartitioned instance and no versioning
  of stored shapes; callers own their own key names.
- Guarding against a malformed stored value. `getItem` does not catch, so a key
  holding non-JSON throws at the call site.
