import type * as React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { FeedScreen } from '../feed-screen';

import 'react-native';

// The screen's own header is what this file covers, so the query is stubbed to
// a settled empty result rather than exercising the network.
const mockUsePosts: jest.Mock = jest.fn(() => ({
  data: [],
  isPending: false,
  isError: false,
}));

jest.mock('../api', () => ({
  // eslint-disable-next-line react/no-unnecessary-use-prefix
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

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  return {
    FlashList: ({
      data,
      keyExtractor,
      ListEmptyComponent,
      renderItem,
    }: {
      data?: Array<{ id: number; userId: number; title: string; body: string }>;
      keyExtractor: (item: unknown, index: number) => string;
      ListEmptyComponent?: React.ReactNode;
      renderItem: (args: { item: { id: number; userId: number; title: string; body: string } }) => React.ReactNode;
    }) => {
      if (!data?.length)
        return ListEmptyComponent ?? null;
      return data.map((item, index) => (
        <React.Fragment key={keyExtractor(item, index)}>
          {renderItem({ item })}
        </React.Fragment>
      ));
    },
  };
});

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

  it('renders posts returned by the feed', () => {
    mockUsePosts.mockReturnValueOnce({
      data: [{ id: 3, userId: 1, title: 'Third post', body: 'Its body' }],
      isPending: false,
      isError: false,
    });

    render(<FeedScreen />);

    expect(screen.getByText('Third post')).toBeOnTheScreen();
    expect(screen.getByText('Its body')).toBeOnTheScreen();
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
