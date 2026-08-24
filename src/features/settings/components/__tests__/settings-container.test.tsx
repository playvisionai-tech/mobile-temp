import * as React from 'react';

import { Text } from '@/components/ui';
import { cleanup, render, screen } from '@/lib/test-utils';

import { SettingsContainer } from '../settings-container';

afterEach(cleanup);

describe('settings container', () => {
  it('groups its children under an optional translated title', () => {
    render(
      <SettingsContainer title="settings.about">
        <Text>Container content</Text>
      </SettingsContainer>,
    );

    expect(screen.getByText('About')).toBeOnTheScreen();
    expect(screen.getByText('Container content')).toBeOnTheScreen();
  });

  it('groups children without adding a title', () => {
    render(
      <SettingsContainer>
        <Text>Untitled content</Text>
      </SettingsContainer>,
    );

    expect(screen.getByText('Untitled content')).toBeOnTheScreen();
    expect(screen.queryByText('About')).not.toBeOnTheScreen();
  });
});
