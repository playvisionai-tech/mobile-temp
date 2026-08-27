import * as React from 'react';

import { FocusAwareStatusBar, SafeAreaView, ScrollView } from '@/components/ui';
import { Buttons } from './components/buttons-demo';
import { Colors } from './components/colors-demo';
import { Inputs } from './components/inputs-demo';
import { Typography } from './components/typography-demo';

/**
 * The `ScrollView` owns the screen frame and the scrolling; the `SafeAreaView`
 * owns nothing but the inset, and carries no layout class because `className`
 * never reaches it: it renders `RNCSafeAreaView` directly, and uniwind only
 * rewrites React Native's own components, so a class here is silently dropped.
 * The `flex-1` this wrapper used to carry was therefore inert — it was removed
 * because it reads as load-bearing, not because it was capping anything.
 *
 * Only the top edge is claimed, as in `FeedScreen`: the native tab bar owns the
 * bottom one. `edges` and `style` are the only props this component reads, so
 * the inset is the one load-bearing thing here — with `edges={[]}` the first
 * section renders under the status bar. The demo's own padding lives on the
 * content container, which is where a class does apply.
 */
export function StyleScreen() {
  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView contentContainerClassName="px-4 pb-6">
        <SafeAreaView edges={['top']}>
          <Typography />
          <Colors />
          <Buttons />
          <Inputs />
        </SafeAreaView>
      </ScrollView>
    </>
  );
}
