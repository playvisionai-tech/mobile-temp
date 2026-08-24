import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { AddPostScreen } from '../add-post-screen';
import { useAddPost } from '../api';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('../api', () => ({
  useAddPost: jest.fn(),
}));

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

const mockedUseAddPost = useAddPost as unknown as jest.Mock;
const mockedShowMessage = showMessage as jest.Mock;
const mutate = jest.fn();
const validTitle = 'A useful post title';
const validBody = 'This body is deliberately long enough to satisfy the one hundred and twenty character validation requirement for a newly created post in the feed.';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockedUseAddPost.mockReturnValue({ mutate, isPending: false });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function submitValidPost() {
  const { user } = setup(<AddPostScreen />);
  await user.type(screen.getByTestId('title'), validTitle);
  await user.type(screen.getByTestId('body-input'), validBody);
  await user.press(screen.getByTestId('add-post-button'));
  return user;
}

describe('add post screen', () => {
  it('keeps an invalid post on the form', async () => {
    const { user } = setup(<AddPostScreen />);

    await user.type(screen.getByTestId('title'), 'Short');
    await user.type(screen.getByTestId('body-input'), 'Too short');
    await user.press(screen.getByTestId('add-post-button'));

    expect(await screen.findAllByText(/Too small/i)).toHaveLength(2);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submits a valid post as the current demo user', async () => {
    await submitValidPost();

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith(
      { title: validTitle, body: validBody, userId: 1 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('confirms when the post is created', async () => {
    await submitValidPost();
    await waitFor(() => expect(mutate).toHaveBeenCalled());

    mutate.mock.calls[0][1].onSuccess();

    expect(mockedShowMessage).toHaveBeenCalledWith({
      message: 'Post added successfully',
      type: 'success',
    });
  });

  it('shows an error when the post cannot be created', async () => {
    await submitValidPost();
    await waitFor(() => expect(mutate).toHaveBeenCalled());

    mutate.mock.calls[0][1].onError();

    expect(mockedShowMessage).toHaveBeenCalledWith({
      duration: 4000,
      message: 'Error adding post',
      type: 'danger',
    });
  });

  it('disables submission while a post request is pending', () => {
    mockedUseAddPost.mockReturnValue({ mutate, isPending: true });

    setup(<AddPostScreen />);

    expect(screen.getByTestId('add-post-button')).toBeDisabled();
  });
});
