import { useSelectedLanguage } from '@/lib/i18n';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { LanguageItem } from '../language-item';

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
            testID={`language-option-${option.value}`}
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

jest.mock('@/lib/i18n', () => ({
  ...jest.requireActual('@/lib/i18n'),
  useSelectedLanguage: jest.fn(),
}));

const mockedUseSelectedLanguage = useSelectedLanguage as jest.Mock;
const setLanguage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSelectedLanguage.mockReturnValue({ language: 'en', setLanguage });
});

afterEach(cleanup);

describe('language item', () => {
  it('shows the selected language and opens its choices', async () => {
    const { user } = setup(<LanguageItem />);

    expect(screen.getAllByText('English')).not.toHaveLength(0);
    await user.press(screen.getByText('Language'));
    expect(mockPresent).toHaveBeenCalled();
  });

  it('changes the language and closes the choices', async () => {
    const { user } = setup(<LanguageItem />);

    await user.press(screen.getByTestId('language-option-ar'));

    expect(setLanguage).toHaveBeenCalledWith('ar');
    expect(mockDismiss).toHaveBeenCalled();
  });
});
