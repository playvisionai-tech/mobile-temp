import { useMMKVString } from 'react-native-mmkv';
import { Uniwind } from 'uniwind';

import { storage } from '@/lib/storage';
import { act, renderHook } from '@/lib/test-utils';

import { loadSelectedTheme, useSelectedTheme } from '../use-selected-theme';

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: jest.fn(() => ({ theme: 'light' })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('useSelectedTheme', () => {
  it('defaults to the system theme', () => {
    jest.mocked(useMMKVString).mockReturnValueOnce([undefined, jest.fn()]);

    const { result } = renderHook(useSelectedTheme);

    expect(result.current.selectedTheme).toBe('system');
  });

  it('returns and updates the selected theme', () => {
    const persist = jest.fn();
    jest.mocked(useMMKVString).mockReturnValueOnce(['dark', persist]);
    const { result } = renderHook(useSelectedTheme);

    expect(result.current.selectedTheme).toBe('dark');
    act(() => result.current.setSelectedTheme('light'));
    expect(Uniwind.setTheme).toHaveBeenCalledWith('light');
    expect(persist).toHaveBeenCalledWith('light');
  });
});

describe('loadSelectedTheme', () => {
  it('leaves the runtime theme unchanged when no preference is stored', () => {
    jest.spyOn(storage, 'getString').mockReturnValueOnce(undefined);

    loadSelectedTheme();

    expect(Uniwind.setTheme).not.toHaveBeenCalled();
  });

  it('applies a stored preference before rendering', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(storage, 'getString').mockReturnValueOnce('dark');

    loadSelectedTheme();

    expect(Uniwind.setTheme).toHaveBeenCalledWith('dark');
  });
});
