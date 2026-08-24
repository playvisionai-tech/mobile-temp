import * as React from 'react';
import { Text } from 'react-native';

import { render, screen } from '@/lib/test-utils';

import { APIProvider, queryClient } from '../provider';

const mockUseReactQueryDevTools = jest.fn();

jest.mock('@dev-plugins/react-query', () => ({
  // eslint-disable-next-line react/no-unnecessary-use-prefix
  useReactQueryDevTools: (client: unknown) => mockUseReactQueryDevTools(client),
}));

describe('api provider', () => {
  it('mounts children under the shared query client', () => {
    render(
      <APIProvider>
        <Text>query child</Text>
      </APIProvider>,
    );

    expect(screen.getByText('query child')).toBeOnTheScreen();
    expect(mockUseReactQueryDevTools).toHaveBeenCalledWith(queryClient);
  });
});
