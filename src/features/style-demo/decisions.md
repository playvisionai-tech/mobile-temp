# Style Demo — decisions

## 2026-08-14 — Kept as internal demo feature
**Chose:** Keep in `src/features/style-demo/` for design system verification
**Over:** Delete or move to Storybook
**Why:** Quick way to verify NativeWind components on device without Storybook setup.
**Trade-off:** Adds a route and bundle size in development; should be removed or gated in production.

## 2026-08-27 — Left the scroller outside rather than inverting the nesting
**Chose:** Keep `ScrollView` as the screen frame with a plain
`SafeAreaView edges={['top']}` inside it, drop that wrapper's `flex-1`, and move
the demo's padding to `contentContainerClassName`
**Over:** Inverting the nesting so a `flex-1` `SafeAreaView` owns the frame and
the `ScrollView` sits inside it
**Why:** `className` never reaches `react-native-safe-area-context`'s
`SafeAreaView` — it renders the `RNCSafeAreaView` host component directly, and
uniwind only rewrites React Native's own components. Verified on the Android
emulator: `bg-danger-500` on the `SafeAreaView` changed nothing while the same
class on the `ScrollView` painted the screen red. The inverted shape would
therefore have a frame with no `flex: 1` at all — an auto-height parent above an
unbounded `ScrollView` — and would stop the demo scrolling. The `flex-1` the
wrapper used to carry was inert for the same reason; it was removed because it
reads as load-bearing, not because it was doing harm.
**This fixed no bug.** The screen scrolled to its last control before the change
and after it, and the measurements are identical on both viewports tested
(1080x2424 and 1080x1920 at density 420): `Switch` lands in the same place, with
the same 0.026 gap above the tab bar. The old bare `SafeAreaView` already
defaulted to all four edges, so narrowing to `top` and replacing the bottom
inset with `pb-6` arrives at the same number. The reported "cannot scroll past
the error message" was a gesture artifact — a swipe starting inside the
"Default" `TextField` is swallowed by the input — and reproduces on the old and
new markup alike.
**Trade-off:** The top inset scrolls away with the content instead of staying
pinned. This screen has no header to pin, so nothing is lost — a screen that
grows one needs the frame to own the inset, and that means a
`View className="flex-1"` around the `SafeAreaView`, not a class on it.
