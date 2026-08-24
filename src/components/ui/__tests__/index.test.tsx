import * as React from 'react';

import { render, screen } from '@/lib/test-utils';

import { StyledSvg } from '../index';

describe('styled SVG', () => {
  it('forwards SVG props', () => {
    render(<StyledSvg testID="svg" width={24} height={12} />);

    expect(screen.getByTestId('svg')).toHaveProp('width', 24);
    expect(screen.getByTestId('svg')).toHaveProp('height', 12);
  });
});
