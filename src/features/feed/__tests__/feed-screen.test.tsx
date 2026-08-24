import * as React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { FeedScreen } from '../feed-screen';

import 'react-native';

// The screen's own header is what this file covers, so the query is stubbed to
// a settled empty result rather than exercising the network.
const mockUsePosts = jest.fn(() => ({
  data: [],
  isPending: false,
  isError: false,
}));

jest.mock('../api', () => ({
  usePosts: () => mockUsePosts(),
}));

// expo-router is not mocked globally (see jest-setup.ts), and `Link` is used
// with `asChild`, so a passthrough that renders its child is enough here.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// `@shopify/flash-list/jestSetup` maps FlashList onto a `RecyclerView` export
// that flash-list 2.0.2 does not have, so the real FlashList resolves to
// undefined under Jest and rendering it throws. test-utils imports that setup
// at module load, which would clobber the stub below — so neutralise it first.
// Remove both once the upstream jestSetup matches the installed version.
jest.mock('@shopify/flash-list/jestSetup', () => ({}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ ListEmptyComponent }: { ListEmptyComponent?: React.ReactNode }) =>
    ListEmptyComponent ?? null,
}));

afterEach(cleanup);

describe('feedScreen header', () => {
  it('renders its own header, since the native tab bar has no header slot', () => {
    render(<FeedScreen />);

    expect(screen.getByText('Feed')).toBeOnTheScreen();
    expect(screen.getByTestId('create-post-link')).toBeOnTheScreen();
  });

  it('offers a way to reach add-post', () => {
    render(<FeedScreen />);

    expect(screen.getByText('Create')).toBeOnTheScreen();
  });

  it('renders no header on the error branch', () => {
    mockUsePosts.mockReturnValueOnce({
      data: [],
      isPending: false,
      isError: true,
    });

    render(<FeedScreen />);

    // The error branch returns early and draws no header, so there is no route
    // to add-post from it. This asserts the gap rather than hiding it — change
    // the assertion when the error state grows a header.
    expect(screen.queryByTestId('create-post-link')).not.toBeOnTheScreen();
  });
});
