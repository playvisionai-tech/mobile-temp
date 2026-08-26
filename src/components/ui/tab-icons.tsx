import type { ImageSourcePropType } from 'react-native';
import type { AppleIcon } from 'react-native-bottom-tabs';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { Platform } from 'react-native';

/**
 * Icons for the native tab bar.
 *
 * The native bar cannot render a React component, so the SVG icons in
 * `components/ui/icons/` do not work here. It takes an SF Symbol on iOS or an
 * image source on either platform, and it resolves the icon synchronously —
 * which rules out the async `getImageSource` in `@expo/vector-icons`.
 *
 * This module is the single import site for both `react-native-bottom-tabs`
 * (type only) and `@react-native-vector-icons`. Route code names a tab and gets
 * back whatever the platform needs.
 *
 * **Adding image assets later:** give the entry an `asset` and it wins on both
 * platforms — the `sfSymbol` and `glyph` fields become the fallback for tabs
 * that do not have one yet. Call sites and tab names do not change, so the
 * migration is this file plus the asset files.
 */

export type TabIconName = 'feed' | 'style' | 'settings';

type MaterialGlyph = Parameters<typeof MaterialDesignIcons.getImageSourceSync>[0];

type TabIconDefinition = {
  /** iOS. The system draws it, so it scales and tints with the OS. */
  sfSymbol: AppleIcon['sfSymbol'];
  /** Android. Rasterized from the Material font at call time. */
  glyph: MaterialGlyph;
  /**
   * Optional. When present this is used on both platforms, ahead of `sfSymbol`
   * and `glyph`. This is the seam for the icon assets we plan to add.
   */
  asset?: ImageSourcePropType;
};

/**
 * One row per tab. Keep the keys in step with the route names in
 * `src/app/(app)/_layout.tsx` — this map is what makes the platform split a
 * single edit rather than three.
 */
const TAB_ICONS: Record<TabIconName, TabIconDefinition> = {
  feed: { sfSymbol: 'list.bullet', glyph: 'view-list' },
  style: { sfSymbol: 'paintpalette', glyph: 'palette' },
  settings: { sfSymbol: 'gearshape', glyph: 'cog' },
};

/** Rasterized glyphs are identical every call, so resolve each one once. */
const androidIconCache = new Map<TabIconName, ImageSourcePropType>();

/**
 * The icon for a tab, in the shape `tabBarIcon` expects.
 *
 * Colour is deliberately not a parameter: the native tab bar owns the tint on
 * both platforms, and on iOS 26 it ignores `tabBarActiveTintColor` entirely.
 * The Android glyph is rasterized black and tinted by the bar.
 */
export function getTabIcon(name: TabIconName): ImageSourcePropType | AppleIcon {
  const icon = TAB_ICONS[name];

  if (icon.asset !== undefined) {
    return icon.asset;
  }

  if (Platform.OS === 'ios') {
    return { sfSymbol: icon.sfSymbol };
  }

  const cached = androidIconCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const source = MaterialDesignIcons.getImageSourceSync(icon.glyph, 24, 'black');
  androidIconCache.set(name, source);
  return source;
}
