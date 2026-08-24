import { showMessage } from 'react-native-flash-message';

import { extractError, showError, showErrorMessage } from '../utils';

jest.mock('react-native-flash-message', () => ({ showMessage: jest.fn() }));

const mockShowMessage = jest.mocked(showMessage);

beforeEach(() => {
  mockShowMessage.mockClear();
});

describe('ui error feedback', () => {
  it.each([
    ['plain messages', 'Try again', 'Try again'],
    ['unknown values', null, 'Something went wrong '],
    ['arrays', ['First', 'Second'], '  First  Second'],
    [
      'nested response objects',
      { email: ['Required', 'Invalid'], detail: 'Rejected' },
      '- email:\n   Required  Invalid \n - detail: Rejected \n  ',
    ],
  ])('extracts %s into readable text', (_case, value, expected) => {
    expect(extractError(value)).toBe(expected);
  });

  it('shows a supplied error message', () => {
    showErrorMessage('Could not save');

    expect(mockShowMessage).toHaveBeenCalledWith({
      message: 'Could not save',
      type: 'danger',
      duration: 4000,
    });
  });

  it('shows the default error message', () => {
    showErrorMessage();

    expect(mockShowMessage).toHaveBeenCalledWith({
      message: 'Something went wrong ',
      type: 'danger',
      duration: 4000,
    });
  });

  it('shows an API response as a danger notification', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    showError({ response: { data: { email: 'Invalid' } } } as never);

    expect(mockShowMessage).toHaveBeenCalledWith({
      message: 'Error',
      description: '- email: Invalid',
      type: 'danger',
      duration: 4000,
      icon: 'danger',
    });
    log.mockRestore();
  });
});
