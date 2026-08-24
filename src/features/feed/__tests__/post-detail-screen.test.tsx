import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { usePost } from '../api';
import { PostDetailScreen } from '../post-detail-screen';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('../api', () => ({
  usePost: jest.fn(),
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedUsePost = usePost as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseLocalSearchParams.mockReturnValue({ id: '7' });
});

afterEach(cleanup);

describe('post detail screen', () => {
  it('shows a loading state while the requested post is pending', () => {
    mockedUsePost.mockReturnValue({ data: undefined, isPending: true, isError: false });

    render(<PostDetailScreen />);

    expect(mockedUsePost).toHaveBeenCalledWith({ variables: { id: '7' } });
    expect(screen.queryByText('Error loading post')).not.toBeOnTheScreen();
  });

  it('shows an error when the requested post cannot be loaded', () => {
    mockedUsePost.mockReturnValue({ data: undefined, isPending: false, isError: true });

    render(<PostDetailScreen />);

    expect(screen.getByText('Error loading post')).toBeOnTheScreen();
  });

  it('shows the requested post', () => {
    mockedUsePost.mockReturnValue({
      data: { id: 7, userId: 1, title: 'A visible title', body: 'A visible body' },
      isPending: false,
      isError: false,
    });

    render(<PostDetailScreen />);

    expect(screen.getByText('A visible title')).toBeOnTheScreen();
    expect(screen.getByText(/A visible body/)).toBeOnTheScreen();
  });
});
