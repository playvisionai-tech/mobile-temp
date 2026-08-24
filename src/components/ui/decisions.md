# UI Kit — decisions

Entries below the 2026-08 line predate this file. They were reconstructed from
the code and from the commit that introduced each choice (referenced inline);
nothing here is invented rationale.

## 2022-11-09 — One barrel file, only here (`d03a3b5`)
**Chose:** A single `src/components/ui/index.tsx` that re-exports every primitive, plus RN's `View`/`ScrollView`/`Pressable`/`TouchableOpacity`/`ActivityIndicator` and `SafeAreaView`
**Over:** Deep imports per component (`@/components/ui/button`), the rule everywhere else in the repo
**Why:** Features import a handful of primitives per screen; without the barrel every file grows a block of six or seven near-identical import lines. Re-exporting the React Native primitives through the same door also means a feature never has to decide whether `View` comes from `react-native` or from the kit.
**Trade-off:** Barrels are banned elsewhere precisely because they bloat the Metro graph and break Fast Refresh boundaries (see `agents/rules/architecture-core.md`), so this module pays that cost for everyone. Anything that must stay out of the graph is deliberately left off the barrel and imported directly: `form-utils`, `use-theme-config`, and `icons`.

## 2024-02-29 — `colors.js` mirrors the palette for JS consumers (`2dd061c`)
**Chose:** Keep a plain JS object of the palette next to the components
**Over:** Reading the theme tokens at runtime wherever a color value is needed
**Why:** Some consumers need a color *value*, not a class name — icon tints, `tabBarIcon` colors, and native props on third-party components that take no `className`.
**Trade-off:** The palette now exists twice: once as CSS variables in `src/global.css` and once as JS in `colors.js`. They can drift, and nothing checks that they agree — changing one means changing the other by hand.

## 2026-01-21 — Uniwind over NativeWind (`7355a9b`)
**Chose:** `uniwind` with Tailwind v4, theme defined in the `@theme` block of `src/global.css`
**Over:** NativeWind with a `tailwind.config.js`
**Why:** Tailwind v4 moves configuration into CSS, so there is no `tailwind.config.js` to keep in sync any more; one file (`src/global.css`) defines fonts, palette and semantic tokens for both the class names and the theme.
**Trade-off:** Every tool that expects `tailwind.config.js` needs pointing at the CSS entry point instead (`eslint-plugin-better-tailwindcss` is configured with `entryPoint: ./src/global.css`), and theme switching now goes through `Uniwind.setTheme` rather than NativeWind's color-scheme APIs — which is why `src/lib/hooks/use-selected-theme.tsx` has to call it explicitly.

## 2026-01-22 — TanStack Form over react-hook-form (`ea7d500`)
**Chose:** `@tanstack/react-form`, with `src/components/ui/form-utils.ts` mapping a field to `Input`'s `error` prop
**Over:** `react-hook-form` + its resolver ecosystem
**Why:** The kit's inputs are controlled (`value` / `onChangeText`) rather than ref-registered, which fits TanStack Form's field API directly and removes the `Controller` wrapper every RHF field needed on React Native.
**Trade-off:** A smaller ecosystem and less Stack Overflow coverage than react-hook-form, and `getFieldError` is a bespoke adapter this repo has to maintain — it is deliberately kept out of the barrel so only form screens pull it in.

## 2026-08-24 — Promotion requires two consumers
**Chose:** A component moves into this kit only when 2+ features use it and it carries no feature-specific logic; until then it lives in that feature's `components/`
**Over:** Putting every reusable-looking component here as soon as it is written
**Why:** A one-consumer component in the kit is an API with no second caller to validate it, and it becomes everyone's dependency to keep working. Features must not import from each other (`agents/rules/architecture-core.md`), so the kit is the only sharing path — which makes it easy to over-fill.
**Trade-off:** Real duplication is tolerated in the window before the second consumer appears, and the promotion moment is a judgement call nothing enforces; the inventory in `spec.md` is the only thing standing between this and two similar buttons.

## 2026-08-24 — Tab icons come from a font glyph, not from our SVG set
**Chose:** `getTabIcon()` in `tab-icons.tsx` — SF Symbols on iOS, `@react-native-vector-icons/material-design-icons` rasterized synchronously on Android — with an `asset` field reserved for image files
**Over:** (a) reusing the `react-native-svg` components in `icons/`; (b) `@expo/vector-icons`, already installed; (c) shipping PNGs now; (d) Android drawables via a config plugin
**Why:** (a) is impossible — `tabBarIcon` is typed `(props) => ImageSourcePropType | AppleIcon` and a native tab bar cannot render a React element. (b) looked free and is not: Expo builds its icon sets with its own `createIconSet`, which exposes only an **async** `getImageSource`, and `tabBarIcon` is synchronous. The sync version exists only on an internal vendored path. `@react-native-vector-icons/get-image` exposes `getImageForFontSync`, which is what makes this work at all. (c) was blocked — no SVG rasterizer on the machine, and inventing icon assets is a design decision, not a build step. (d) puts assets in the generated native tree, which `prebuild --clean` wipes.
**Trade-off:** Two more dependencies, one of them native, for three icons. The two icon systems now differ — in-app UI uses the SVG components, the tab bar uses this — which is a real inconsistency and the reason `getTabIcon` is the only exported surface. Icon colour is no longer ours to set: the native bar owns the tint on both platforms. The `asset` field is the planned exit: filling it in makes an entry use an image file on both platforms and takes precedence over `sfSymbol`/`glyph`, so adopting assets later is this one file plus the files themselves.
