# UI Kit — inventory

Before building any UI, check this list. If something here fits, use it.
Do not create a new primitive without checking the promotion rule below.

Everything below is exported from `src/components/ui/index.tsx` — the one
barrel file the project allows.

| Component | Use for | Don't use for |
|---|---|---|
| `Button` | All tappable actions; `variant`/`size` props, built-in `loading` state | Plain rows → `Pressable` + `Text` |
| `Input` | Single-line text entry; `label` + `error` props, controlled via `value`/`onChangeText` | Multi-choice → `Select` |
| `Text` | ALL text. Never import RN `Text`. | — |
| `Select` / `Options` | Choosing one value from a list (bottom-sheet picker) | Free text → `Input` |
| `Checkbox` / `Radio` / `Switch` | Boolean and single-choice toggles (from `checkbox.tsx`) | Actions → `Button` |
| `Modal` / `useModal` | Bottom-sheet dialogs (@gorhom) | Full-screen → push a route |
| `getTabIcon` (`tab-icons.tsx`) | Icons for the **native** tab bar; returns an SF Symbol on iOS, a rasterized Material glyph on Android | In-app UI → the SVG components in `icons/` |
| `List` / `EmptyList` / `NoData` | Scrolling collections (FlashList) and their empty states | Static content → `ScrollView` |
| `Image` / `preloadImages` | Remote and local images (expo-image) | Icons → `@/components/ui/icons` |
| `ProgressBar` | Determinate progress | Indeterminate → `ActivityIndicator` |
| `FocusAwareStatusBar` | Per-screen status bar style | — |
| `colors` | Color values needed in JS (icon tints, native props) | Styling JSX → className tokens |
| `showErrorMessage` / `showError` / `extractError` | Flash-message error feedback | Inline field errors → `Input`'s `error` |
| `IS_IOS` / `WIDTH` / `HEIGHT` | Platform and screen dimension checks | — |
| `StyledSvg` | `react-native-svg` `Svg` with `className` support | — |

Re-exported unchanged from React Native / safe-area-context so features import
them from one place: `View`, `ScrollView`, `Pressable`, `TouchableOpacity`,
`ActivityIndicator`, `SafeAreaView`.

`SafeAreaView` is the exception to "everything takes a `className`": uniwind
rewrites React Native's own components, and this one comes from
`react-native-safe-area-context`, which renders the `RNCSafeAreaView` host
component directly. A `className` on it is silently dropped — `edges` and
`style` are what it reads. Style the `View` around it or the one inside it.

Not in the barrel, import directly: `getFieldError` from
`@/components/ui/form-utils` (maps a `@tanstack/react-form` field to `Input`'s
`error` prop), the icon set in `@/components/ui/icons`, and
`useThemeConfig` from `@/components/ui/use-theme-config`.

The icon set is eight in-app SVG components: `ArrowRight`, `CaretDown`,
`Github`, `Language`, `Rate`, `Share`, `Support`, `Website`. Tab bar icons are
not among them — the native bar cannot render a React component, so it takes
its icons from `getTabIcon` instead.

## Prop contracts worth knowing
- `Checkbox` / `Radio` / `Switch` animate with `react-native-reanimated`
  directly — `Animated.View` plus `useAnimatedStyle`. The checkbox fades its
  fill and checkmark together over 100ms and eases its border colour over the
  same 100ms; the radio eases its ring colour over 100ms and fades its dot over
  50ms; the switch springs its thumb across the track with `overshootClamping`.
  The checked colour is `primary-300` and the unchecked one `charcoal-400`.
  The checkbox's fill is an inset overlay that fades in, and the box itself
  declares no background, so an unchecked box shows whatever surface is behind
  it in either theme.
- `Button` renders its `children` when any are passed, and falls back to `label`
  — or to the activity indicator while `loading` — only when `children` is
  absent. The test is for presence, not truthiness.
- `Input` forwards blur and focus to the caller's `onBlur` / `onFocus` carrying
  React Native's own `TextInput` event, so a handler written against
  `TextInputProps` fits with no cast.
- `getFieldError(field)` reads `state.meta.isTouched` and `state.meta.errors` and
  nothing else, so any form field carrying those satisfies it. It returns
  `undefined` for an untouched or error-free field, the string for a string
  error, the `message` of an object error, and otherwise the value stringified.

## Theme
There is no `tailwind.config.js`. Colors, fonts, and semantic tokens are
defined as CSS variables in the `@theme` block of `src/global.css`
(Tailwind v4 + uniwind); `src/components/ui/colors.js` mirrors the palette for
the places that need color values in JS.
Never hardcode a hex value or a numeric spacing in a component.

## Promotion rule
A component moves here only when it is used by 2+ features AND has no feature-specific logic. Until then it lives in that feature's `components/`.
