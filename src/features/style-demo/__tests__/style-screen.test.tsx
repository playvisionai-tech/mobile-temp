import { SafeAreaView } from '@/components/ui';
import { render, screen } from '@/lib/test-utils';
import { StyleScreen } from '../style-screen';

describe('style screen', () => {
  it('puts no className on the safe-area wrapper', () => {
    render(<StyleScreen />);

    const [safeArea] = screen.UNSAFE_getAllByType(SafeAreaView);

    // `className` never reaches this component — it renders `RNCSafeAreaView`
    // directly, and uniwind only rewrites React Native's own components — so
    // any class here is silently dropped and reads as styling that works. The
    // wrapper carried an inert `flex-1` until this was written; this is the
    // guard against putting one back.
    expect(safeArea.props.className).toBeUndefined();
  });

  it('insets the content below the status bar, and only there', () => {
    render(<StyleScreen />);

    const [safeArea] = screen.UNSAFE_getAllByType(SafeAreaView);

    // The inset is the one thing this wrapper actually does. Top only, as in
    // FeedScreen: the app draws edge-to-edge, so with `edges={[]}` the first
    // section renders under the status bar, and the native tab bar owns the
    // bottom edge.
    expect(safeArea.props.edges).toEqual(['top']);
  });
});
