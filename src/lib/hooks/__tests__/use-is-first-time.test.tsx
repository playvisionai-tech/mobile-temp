import { useMMKVBoolean } from 'react-native-mmkv';

import { renderHook } from '@/lib/test-utils';

import { useIsFirstTime } from '../use-is-first-time';

describe('useIsFirstTime', () => {
  it('treats an unset preference as a first run', () => {
    jest.mocked(useMMKVBoolean).mockReturnValueOnce([undefined, jest.fn()]);

    const { result } = renderHook(useIsFirstTime);

    expect(result.current[0]).toBe(true);
  });

  it.each([true, false])('returns the stored %s preference', (stored) => {
    jest.mocked(useMMKVBoolean).mockReturnValueOnce([stored, jest.fn()]);

    const { result } = renderHook(useIsFirstTime);

    expect(result.current[0]).toBe(stored);
  });
});
