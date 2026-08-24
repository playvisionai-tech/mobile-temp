import { useSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { ThemeItem } from '../theme-item';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockRef = { current: null };

jest.mock('@/components/ui', () => {
  const actual = jest.requireActual('@/components/ui');
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    ...actual,
    Options: ({ options, onSelect }: { options: Array<{ label: string; value: string }>; onSelect: (option: { label: string; value: string }) => void }) => (
      <View>
        {options.map(option => (
          <Pressable
            key={option.value}
            testID={`theme-option-${option.value}`}
            onPress={() => onSelect(option)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
    // eslint-disable-next-line react/no-unnecessary-use-prefix
    useModal: () => ({ ref: mockRef, present: mockPresent, dismiss: mockDismiss }),
  };
});

jest.mock('@/lib/hooks/use-selected-theme', () => ({
  useSelectedTheme: jest.fn(),
}));

const mockedUseSelectedTheme = useSelectedTheme as jest.Mock;
const setSelectedTheme = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSelectedTheme.mockReturnValue({
    selectedTheme: 'system',
    setSelectedTheme,
  });
});

afterEach(cleanup);

describe('theme item', () => {
  it('shows the selected theme and opens its choices', async () => {
    const { user } = setup(<ThemeItem />);

    expect(screen.getAllByText('System ⚙️')).not.toHaveLength(0);
    await user.press(screen.getByText('Theme'));
    expect(mockPresent).toHaveBeenCalled();
  });

  it('changes the theme and closes the choices', async () => {
    const { user } = setup(<ThemeItem />);

    await user.press(screen.getByTestId('theme-option-dark'));

    expect(setSelectedTheme).toHaveBeenCalledWith('dark');
    expect(mockDismiss).toHaveBeenCalled();
  });
});
