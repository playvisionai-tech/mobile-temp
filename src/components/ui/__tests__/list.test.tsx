import * as React from 'react';
import { ActivityIndicator } from 'react-native';

import { render, screen } from '@/lib/test-utils';

import { EmptyList } from '../list';

describe('empty list', () => {
  it('shows progress while data is loading', () => {
    render(<EmptyList isLoading />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText('Sorry! No data found')).not.toBeOnTheScreen();
  });

  it('shows the empty-state message after loading', () => {
    render(<EmptyList isLoading={false} />);

    expect(screen.getByText('Sorry! No data found')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });
});
