/* eslint-disable max-lines-per-function */
import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { Checkbox, Radio, Switch } from '../checkbox';

import 'react-native';

afterEach(cleanup);

describe('checkbox, Radio & Switch components ', () => {
  it('supports composing control roots, icons, and labels', () => {
    const onChange = jest.fn();
    setup(
      <>
        <Checkbox.Root onChange={onChange} accessibilityLabel="checkbox root">
          <Checkbox.Icon checked={false} />
          <Checkbox.Label text="Checkbox label" />
        </Checkbox.Root>
        <Radio.Root onChange={onChange} accessibilityLabel="radio root">
          <Radio.Icon checked={false} />
          <Radio.Label text="Radio label" />
        </Radio.Root>
        <Switch.Root onChange={onChange} accessibilityLabel="switch root">
          <Switch.Icon checked={false} />
          <Switch.Label text="Switch label" />
        </Switch.Root>
      </>,
    );

    expect(screen.getByText('Checkbox label')).toBeOnTheScreen();
    expect(screen.getByText('Radio label')).toBeOnTheScreen();
    expect(screen.getByText('Switch label')).toBeOnTheScreen();
  });

  it.each([
    ['checkbox', Checkbox],
    ['radio', Radio],
    ['switch', Switch],
  ] as const)('<%s /> reports false when a checked control is pressed', async (testID, Control) => {
    const onChange = jest.fn();
    const { user } = setup(
      <Control
        checked
        testID={testID}
        onChange={onChange}
        accessibilityLabel={testID}
      />,
    );

    expect(screen.getByTestId(testID)).toBeChecked();
    await user.press(screen.getByTestId(testID));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('<Checkbox /> renders correctly and call on change on Press', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Checkbox
        testID="checkbox"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('checkbox')).toBeOnTheScreen();
    expect(screen.queryByTestId('checkbox-label')).not.toBeOnTheScreen();
    expect(screen.getByTestId('checkbox')).toBeEnabled();

    expect(screen.getByTestId('checkbox')).not.toBeChecked();
    expect(screen.getByTestId('checkbox').props.accessibilityRole).toBe(
      'checkbox',
    );
    expect(screen.getByTestId('checkbox').props.accessibilityLabel).toBe(
      'agree',
    );

    await user.press(screen.getByTestId('checkbox'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('<CheckBox/> shouldn\'t change value while disabled', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Checkbox
        disabled={true}
        testID="checkbox"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('checkbox')).toBeOnTheScreen();
    expect(screen.getByTestId('checkbox')).toBeDisabled();
    await user.press(screen.getByTestId('checkbox'));
    expect(mockOnChange).toHaveBeenCalledTimes(0);
  });
  it('<CheckBox/> Should render the correct label', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Checkbox
        disabled={true}
        testID="checkbox"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
        label="I agree to terms and conditions"
      />,
    );
    expect(screen.getByTestId('checkbox')).toBeOnTheScreen();
    expect(screen.getByTestId('checkbox-label')).toBeOnTheScreen();
    expect(
      screen.getByTestId('checkbox').props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.getByTestId('checkbox').props.accessibilityRole).toBe(
      'checkbox',
    );

    expect(screen.getByTestId('checkbox').props.accessibilityLabel).toBe(
      'agree',
    );
    expect(screen.getByTestId('checkbox-label')).toHaveTextContent(
      'I agree to terms and conditions',
    );
    await user.press(screen.getByTestId('checkbox'));
    expect(mockOnChange).toHaveBeenCalledTimes(0);
  });

  it('<Radio /> renders correctly and call on change on Press', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Radio
        testID="radio"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('radio')).toBeOnTheScreen();
    expect(screen.queryByTestId('radio-label')).not.toBeOnTheScreen();
    expect(screen.getByTestId('radio')).toBeEnabled();
    expect(screen.getByTestId('radio')).not.toBeChecked();
    expect(screen.getByTestId('radio').props.accessibilityRole).toBe('radio');
    expect(screen.getByTestId('radio').props.accessibilityLabel).toBe('agree');
    await user.press(screen.getByTestId('radio'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('<Radio /> should render the correct label', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Radio
        testID="radio"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        label="I agree to terms and conditions"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('radio')).toBeOnTheScreen();
    expect(screen.getByTestId('radio-label')).toBeOnTheScreen();
    expect(screen.getByTestId('radio-label')).toHaveTextContent(
      'I agree to terms and conditions',
    );

    expect(screen.getByTestId('radio').props.accessibilityState.checked).toBe(
      false,
    );
    expect(screen.getByTestId('radio').props.accessibilityRole).toBe('radio');
    expect(screen.getByTestId('radio').props.accessibilityLabel).toBe('agree');
    await user.press(screen.getByTestId('radio-label'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('<Radio/> shouldn\'t change value while disabled', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Radio
        disabled={true}
        testID="radio"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('radio')).toBeOnTheScreen();
    expect(screen.getByTestId('radio')).toBeDisabled();
    await user.press(screen.getByTestId('radio'));
    expect(mockOnChange).toHaveBeenCalledTimes(0);
  });

  it('<Switch /> renders correctly and call on change on Press', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Switch
        testID="switch"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('switch')).toBeOnTheScreen();
    expect(screen.queryByTestId('switch-label')).not.toBeOnTheScreen();
    expect(screen.getByTestId('switch')).toBeEnabled();
    expect(screen.getByTestId('switch').props.accessibilityState.checked).toBe(
      false,
    );
    expect(screen.getByTestId('switch').props.accessibilityRole).toBe('switch');
    expect(screen.getByTestId('switch').props.accessibilityLabel).toBe('agree');
    await user.press(screen.getByTestId('switch'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('<Switch /> should render the correct label', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Switch
        testID="switch"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        label="I agree to terms and conditions"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('switch')).toBeOnTheScreen();
    expect(screen.getByTestId('switch-label')).toBeOnTheScreen();
    expect(screen.getByTestId('switch-label')).toHaveTextContent(
      'I agree to terms and conditions',
    );
    expect(screen.getByTestId('switch').props.accessibilityState.checked).toBe(
      false,
    );
    expect(screen.getByTestId('switch').props.accessibilityRole).toBe('switch');
    expect(screen.getByTestId('switch').props.accessibilityLabel).toBe('agree');
    await user.press(screen.getByTestId('switch-label'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('<Switch/> shouldn\'t change value while disabled', async () => {
    const mockOnChange = jest.fn(checked => checked);
    const { user } = setup(
      <Switch
        disabled={true}
        testID="switch"
        onChange={mockOnChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />,
    );
    expect(screen.getByTestId('switch')).toBeOnTheScreen();
    await user.press(screen.getByTestId('switch'));
    expect(mockOnChange).toHaveBeenCalledTimes(0);
  });
});
