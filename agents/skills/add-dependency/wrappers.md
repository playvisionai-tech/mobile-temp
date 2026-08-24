# Wrappers — the precedent, including where it leaks

Read this before writing a wrapper. The rule is in
[`SKILL.md`](SKILL.md) §4; this is what it looks like in practice here.

Three third-party libraries are wrapped in this repo today. One is the model.
The other two show the two ways a wrapper stops being one.

## `expo-image` → `src/components/ui/image.tsx` — the model

```tsx
import type { ImageProps } from 'expo-image';
import { Image as NImage } from 'expo-image';
import { withUniwind } from 'uniwind';
```

It re-types the props, applies `withUniwind` so `className` works like every
other component in the design system, and exports our `Image`.

**Nothing else in `src/` imports `expo-image`.** One import site. Swapping the
image library is a one-file change. This is the target.

## `react-native-mmkv` → `src/lib/storage.tsx` — a deliberate partial

`storage.tsx` creates the MMKV instance once and exports it, plus
`getItem`/`setItem`/`removeItem` helpers.

But three modules — `src/lib/hooks/use-is-first-time.tsx`,
`src/lib/hooks/use-selected-theme.tsx` and `src/lib/i18n/utils.tsx` — import the
React hooks straight from the library:

```tsx
import { useMMKVBoolean } from 'react-native-mmkv';
import { storage } from '../storage';
```

This is defensible: the hooks need the instance passed in, and re-exporting
every MMKV hook through the wrapper would be its own kind of noise. But it does
mean the library name appears in four files, so an MMKV swap is a four-file
change, not one.

**If you copy this shape, do it knowingly**, and say so in the module's
`decisions.md`. A partial wrapper chosen on purpose is fine. A partial wrapper
that happened by accident is the next entry.

## `@shopify/flash-list` → `src/components/ui/list.tsx` — not actually a wrapper

This one looks like a wrapper and is not. The whole of it is:

```tsx
export const List = NFlashList;
```

A straight re-export under a new name. No narrowed surface, no house defaults,
no `className` adaptation — nothing that §4 asks a wrapper to do. The file also
exports `EmptyList` and `NoData`, which are useful components in their own
right, but they are not wrapping anything.

And because it adapts nothing, there is no reason for call sites to prefer it.
Three files import `@shopify/flash-list` directly:

- `src/features/feed/feed-screen.tsx`
- `src/components/ui/select.tsx`
- `src/lib/test-utils.tsx`

So a FlashList swap is a four-file change plus this alias. The indirection
exists, costs maintenance, and delivers nothing.

Two lessons, and they are the reason §4 is written the way it is:

1. **A pass-through is not a wrapper.** `export const X = LibraryX` gives you a
   second name for the same thing and a false sense that the dependency is
   contained.
2. **The file existing proves nothing** — which is why §4 demands the `grep`
   rather than a look at the directory listing.

## Choosing the location

| Nature | Goes in | Because |
|---|---|---|
| Renders something visible | `src/components/ui/<name>.tsx` | The design system is the only barrel; UI primitives are discoverable from one inventory |
| Infra — network, storage, auth, i18n, device APIs, analytics | `src/lib/<name>/` | Cross-cutting, imported by full path, owns its own `spec.md` + `decisions.md` |
| One feature only, genuinely feature-specific | `src/features/<f>/` | The promotion rule moves it to `components/ui/` once a second feature needs it |

If you genuinely cannot tell whether something is UI or infra, it is usually
infra with a thin UI component on top — put the logic in `src/lib/` and the
component in `src/components/ui/`, and let the component import the module.

## When not to wrap

- **Providers mounted once** in `src/app/_layout.tsx` — `ClerkProvider`,
  `KeyboardProvider`, `GestureHandlerRootView`, `BottomSheetModalProvider`.
  A wrapper around a single mount site buys nothing.
- **Build-time and config-only packages** — config plugins, Babel plugins,
  `app-icon-badge`. They never appear in `src/`.
- **Type-only dependencies.**
- **A package whose whole API is one component rendered once**, e.g.
  `react-native-flash-message`'s `<FlashMessage />`.

In each case write one line in the relevant `decisions.md` recording that the
wrapper was skipped on purpose. Otherwise the next person cannot tell the
decision from an oversight.
