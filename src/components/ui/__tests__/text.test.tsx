import * as React from 'react';
import { I18nManager } from 'react-native';

import { render, screen } from '@/lib/test-utils';

import { Text } from '../text';

afterEach(() => {
  I18nManager.isRTL = false;
});

describe('text', () => {
  it('renders children using left-to-right direction', () => {
    render(<Text>Hello</Text>);

    expect(screen.getByText('Hello')).toHaveStyle({ writingDirection: 'ltr' });
  });

  it('uses right-to-left direction when the locale requires it', () => {
    I18nManager.isRTL = true;
    render(<Text>مرحبا</Text>);

    expect(screen.getByText('مرحبا')).toHaveStyle({ writingDirection: 'rtl' });
  });

  it('renders translated copy through the tx prop', () => {
    render(<Text tx="settings.logout">ignored</Text>);

    expect(screen.getByText('Logout')).toBeOnTheScreen();
    expect(screen.queryByText('ignored')).not.toBeOnTheScreen();
  });
});
