import * as React from 'react';

import { render, screen } from '@/lib/test-utils';

import NotFoundScreen from '../[...messing]';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
}));

describe('not-found route', () => {
  it('explains the missing route and offers a way home', () => {
    render(<NotFoundScreen />);

    expect(screen.getByText('This screen doesn\'t exist.')).toBeOnTheScreen();
    expect(screen.getByText('Go to home screen!')).toBeOnTheScreen();
  });
});
