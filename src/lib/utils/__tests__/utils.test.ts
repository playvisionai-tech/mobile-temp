import { Linking } from 'react-native';

import { openLinkInBrowser } from '@/lib/utils';

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
