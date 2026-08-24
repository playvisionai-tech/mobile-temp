import { Image as ExpoImage } from 'expo-image';
import * as React from 'react';

import { render, screen } from '@/lib/test-utils';

import { Image, preloadImages } from '../image';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: Object.assign(
      (props: object) => <View {...props} />,
      { prefetch: jest.fn() },
    ),
  };
});

describe('image', () => {
  it('uses a blurhash placeholder by default', () => {
    render(<Image testID="photo" source="photo.jpg" />);

    expect(screen.getByTestId('photo')).toHaveProp(
      'placeholder',
      'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    );
  });

  it('allows the placeholder to be replaced', () => {
    render(<Image testID="photo" source="photo.jpg" placeholder="preview" />);

    expect(screen.getByTestId('photo')).toHaveProp('placeholder', 'preview');
  });

  it('preloads remote sources through Expo Image', () => {
    preloadImages(['one.jpg', 'two.jpg']);

    expect(ExpoImage.prefetch).toHaveBeenCalledWith(['one.jpg', 'two.jpg']);
  });
});
