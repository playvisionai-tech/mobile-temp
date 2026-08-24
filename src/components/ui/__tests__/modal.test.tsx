/* eslint-disable react/no-forward-ref, react/no-unnecessary-use-prefix */
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { render, screen, setup } from '@/lib/test-utils';

import { Modal, useModal } from '../modal';
import BottomSheetKeyboardAwareScrollView from '../modal-keyboard-aware-scroll-view';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockClose = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheetModal = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return React.createElement(
      View,
      { testID: 'bottom-sheet', ...props },
      props.handleComponent?.(),
      props.children,
    );
  });
  return {
    BottomSheetModal,
    BottomSheetModalProvider: ({ children }: any) => children,
    BottomSheetFlatList: (props: any) => React.createElement(View, props),
    useBottomSheet: () => ({ close: mockClose }),
    createBottomSheetScrollableComponent: (_type: unknown, Component: any) =>
      (props: any) => React.createElement(Component, props),
    SCROLLABLE_TYPE: { SCROLLVIEW: 'scrollView' },
  };
});

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
  mockClose.mockClear();
});

function ModalHarness() {
  const modal = useModal();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="open modal"
        onPress={() => modal.present({ source: 'test' })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="dismiss modal"
        onPress={modal.dismiss}
      />
      <Modal ref={modal.ref} title="Preferences">
        <View testID="modal-content" />
      </Modal>
    </>
  );
}

describe('modal', () => {
  it('renders its title and content', () => {
    render(<ModalHarness />);

    expect(screen.getByText('Preferences')).toBeOnTheScreen();
    expect(screen.getByTestId('modal-content')).toBeOnTheScreen();
  });

  it('presents and dismisses through the public modal controls', async () => {
    const { user } = setup(<ModalHarness />);

    await user.press(screen.getByLabelText('open modal'));
    await user.press(screen.getByLabelText('dismiss modal'));
    await user.press(screen.getByLabelText('close modal'));

    expect(mockPresent).toHaveBeenCalledWith({ source: 'test' });
    expect(mockDismiss).toHaveBeenCalledTimes(2);
  });

  it('applies detached bottom-sheet layout', () => {
    render(<Modal detached><View /></Modal>);

    expect(screen.getByTestId('bottom-sheet')).toHaveProp('detached', true);
    expect(screen.getByTestId('bottom-sheet')).toHaveProp('bottomInset', 46);
  });

  it('forwards custom snap points', () => {
    render(<Modal snapPoints={['40%', '80%']}><View /></Modal>);

    expect(screen.getByTestId('bottom-sheet')).toHaveProp(
      'snapPoints',
      ['40%', '80%'],
    );
  });

  it('forwards keyboard-aware scroll props', () => {
    render(
      <BottomSheetKeyboardAwareScrollView testID="keyboard-scroll" enabled>
        <View />
      </BottomSheetKeyboardAwareScrollView>,
    );

    expect(screen.getByTestId('keyboard-scroll')).toHaveProp('enabled', true);
  });
});
