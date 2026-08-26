import type * as React from 'react';
import { cleanup, render, screen } from '@/lib/test-utils';

import { PostCard } from '../post-card';

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Link: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: { pathname: string; params: { id: string | number } };
    }) => (
      <View testID={`post-link-${href.pathname}-${href.params.id}`}>
        {children}
      </View>
    ),
  };
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('post card', () => {
  it('links the visible post summary to its detail screen', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    render(
      <PostCard id={4} userId={1} title="A post title" body="A post summary" />,
    );

    expect(screen.getByText('A post title')).toBeOnTheScreen();
    expect(screen.getByText('A post summary')).toBeOnTheScreen();
    expect(screen.getByTestId('post-link-/feed/[id]-4')).toBeOnTheScreen();
  });
});
