import { useRouter } from 'expo-router';
import * as React from 'react';

import { useIsFirstTime } from '@/lib/hooks';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { OnboardingScreen } from '../onboarding-screen';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/hooks', () => ({
  useIsFirstTime: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const mockedUseIsFirstTime = useIsFirstTime as unknown as jest.Mock;
const setIsFirstTime = jest.fn();
const replace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseRouter.mockReturnValue({ replace });
  mockedUseIsFirstTime.mockReturnValue([true, setIsFirstTime]);
});

afterEach(cleanup);

describe('onboarding screen', () => {
  it('completes first-run onboarding and continues to login', async () => {
    const { user } = setup(<OnboardingScreen />);

    expect(screen.getByText('Obytes Starter')).toBeOnTheScreen();
    await user.press(screen.getByText('Let\'s Get Started '));

    expect(setIsFirstTime).toHaveBeenCalledWith(false);
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
