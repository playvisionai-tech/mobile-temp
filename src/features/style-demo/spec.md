# Style Demo — current behavior

## What this feature does
Internal demo screen showcasing the design system primitives on a real device.
Not user-facing.

## Behavior
- Renders the whole UI kit in one scrollable screen: typography, the colour
  palette, every `Button` variant and state, and the form controls — `Input`,
  `Select`, `Checkbox`, `Radio` and `Switch`. The screen scrolls to the last of
  them; nothing in the demo is out of reach.
- The `ScrollView` is the screen frame and owns the scrolling. The `SafeAreaView`
  inside it owns the inset and nothing else, and declares no layout class
  because a class on it would do nothing: `className` never reaches this
  component — see the note in `src/components/ui/spec.md`. Only `edges` and
  `style` are read.
- The safe area claims the top edge only, as `FeedScreen` does. The app draws
  edge-to-edge, so without it the first section renders under the status bar;
  the native tab bar owns the bottom edge, and a bottom inset inside scroll
  content would only add dead space at the end of the demo.
- Horizontal padding and the closing gap sit on the scroll content container,
  not on the scroller itself, so the last control keeps its distance from the
  tab bar.
- Each swatch is keyed `<palette>-<shade>` — `charcoal-500`, say — so keys are
  distinct across the whole demo rather than only within one palette.
- Every form control demo holds its own checked/selected state with `useState`.

## Entry points
- Route: `src/app/(app)/style.tsx` → `features/style-demo/style-screen.tsx`
- State: None beyond the per-control `useState` above.

## Platform differences
- None.

## Out of scope
- Not a production feature; it should be removed or gated before shipping.
  `jest.config.js` leaves it out of coverage collection, but it is a spec
  module like any other and the drift check applies to it.
