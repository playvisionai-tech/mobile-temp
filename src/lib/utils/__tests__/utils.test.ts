import type { StoreApi, UseBoundStore } from 'zustand';
import { Linking } from 'react-native';

import { createSelectors, openLinkInBrowser } from '@/lib/utils';

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('openLinkInBrowser', () => {
  it('opens supported URLs', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

    openLinkInBrowser('https://example.com');
    await Promise.resolve();

    expect(openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('does not open unsupported URLs', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

    openLinkInBrowser('invalid://example');
    await Promise.resolve();

    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('createSelectors', () => {
  it('adds one selector hook for every store field', () => {
    const state = { count: 2, label: 'two' };
    const store = Object.assign(
      jest.fn(selector => selector(state)),
      { getState: () => state },
    );

    const selectedStore = createSelectors(
      store as unknown as UseBoundStore<StoreApi<typeof state>>,
    );

    expect(selectedStore.use.count()).toBe(2);
    expect(selectedStore.use.label()).toBe('two');
  });
});
