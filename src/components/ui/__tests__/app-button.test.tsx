import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppButton } from '../app-button';

describe('AppButton', () => {
  test('exposes button semantics and runs its action', () => {
    const onPress = jest.fn();
    render(<AppButton label="Aktifkan GPS" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Aktifkan GPS' });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disables presses and announces busy state while loading', () => {
    const onPress = jest.fn();
    render(<AppButton label="Menyimpan" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Menyimpan' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
  });
});
