import * as React from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { act, render } from '@/lib/test-utils';

import { ProgressBar } from '../progress-bar';

const mockUseSharedValue = jest.mocked(useSharedValue);
const mockUseAnimatedStyle = jest.mocked(useAnimatedStyle);
const mockWithTiming = jest.mocked(withTiming);

beforeEach(() => {
  mockUseSharedValue.mockImplementation(value => ({ value }) as never);
  mockUseAnimatedStyle.mockImplementation(updater => updater() as never);
  mockWithTiming.mockImplementation(value => value as never);
});

describe('progress bar', () => {
  it('renders its initial determinate progress', () => {
    const { toJSON } = render(<ProgressBar initialProgress={35} />);

    expect(JSON.stringify(toJSON())).toContain('"width":"35%"');
  });

  it('falls back to zero progress for a nullish initial value', () => {
    const { toJSON } = render(<ProgressBar initialProgress={null as never} />);

    expect(JSON.stringify(toJSON())).toContain('"width":"0%"');
  });

  it('exposes a ref for updating progress', () => {
    // eslint-disable-next-line react/no-create-ref
    const ref = React.createRef<{ setProgress: (value: number) => void }>();
    render(<ProgressBar ref={ref} />);

    act(() => ref.current?.setProgress(80));

    expect(mockWithTiming).toHaveBeenCalledWith(80, expect.objectContaining({
      duration: 250,
    }));
  });
});
