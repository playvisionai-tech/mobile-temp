import * as React from 'react';

import { Text } from '@/components/ui';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { SettingsItem } from '../settings-item';

afterEach(cleanup);

describe('settings item', () => {
  it('renders a read-only label and value', () => {
    setup(<SettingsItem text="settings.version" value="9.0.0" />);

    expect(screen.getByText('Version')).toBeOnTheScreen();
    expect(screen.getByText('9.0.0')).toBeOnTheScreen();
  });

  it('renders optional content and responds when selected', async () => {
    const onPress = jest.fn();
    const { user } = setup(
      <SettingsItem
        text="settings.website"
        icon={<Text>Website icon</Text>}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Website icon')).toBeOnTheScreen();
    await user.press(screen.getByText('Website'));
    expect(onPress).toHaveBeenCalled();
  });
});
