import type { getTabIcon as GetTabIcon } from '../tab-icons';

import { Platform } from 'react-native';

// The icon pack is a native module: under Jest there is no TurboModule to call,
// so the rasterizer is stubbed. The stub returns a distinguishable source and
// counts calls, which is what makes the caching assertion below meaningful.
// The `mock` prefix is required — jest hoists the factory above this file.
const mockGetImageSourceSync = jest.fn(
  (glyph: string, _size: number, _color: string) => ({
    uri: `mock://${glyph}`,
    width: 24,
    height: 24,
    scale: 1,
  }),
);

jest.mock('@react-native-vector-icons/material-design-icons', () => ({
  MaterialDesignIcons: {
    getImageSourceSync: (glyph: string, size: number, color: string) =>
      mockGetImageSourceSync(glyph, size, color),
  },
}));

function loadFresh() {
  // getTabIcon memoizes per module instance, so each platform case needs its
  // own copy of the module rather than a shared one.
  let mod: { getTabIcon: typeof GetTabIcon } | undefined;
  jest.isolateModules(() => {
    mod = require('../tab-icons');
  });
  return mod!;
}

afterEach(() => {
  mockGetImageSourceSync.mockClear();
});

describe('getTabIcon', () => {
  it('returns an SF Symbol on iOS, and never rasterizes a glyph', () => {
    Platform.OS = 'ios';
    const { getTabIcon } = loadFresh();

    expect(getTabIcon('feed')).toEqual({ sfSymbol: 'list.bullet' });
    expect(getTabIcon('style')).toEqual({ sfSymbol: 'paintpalette' });
    expect(getTabIcon('settings')).toEqual({ sfSymbol: 'gearshape' });
    expect(mockGetImageSourceSync).not.toHaveBeenCalled();
  });

  it('returns a rasterized image source on Android', () => {
    Platform.OS = 'android';
    const { getTabIcon } = loadFresh();

    expect(getTabIcon('feed')).toEqual({
      uri: 'mock://view-list',
      width: 24,
      height: 24,
      scale: 1,
    });
    expect(mockGetImageSourceSync).toHaveBeenCalledWith('view-list', 24, 'black');
  });

  it('rasterizes each Android glyph once and reuses it', () => {
    Platform.OS = 'android';
    const { getTabIcon } = loadFresh();

    const first = getTabIcon('settings');
    const second = getTabIcon('settings');

    expect(second).toBe(first);
    expect(mockGetImageSourceSync).toHaveBeenCalledTimes(1);
  });

  it('gives every tab a distinct icon on both platforms', () => {
    for (const os of ['ios', 'android'] as const) {
      Platform.OS = os;
      const { getTabIcon } = loadFresh();
      const icons = (['feed', 'style', 'settings'] as const).map(n =>
        JSON.stringify(getTabIcon(n)),
      );
      expect(new Set(icons).size).toBe(3);
    }
  });
});
