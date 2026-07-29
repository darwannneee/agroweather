import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapPicker } from '../map-picker.web';

describe('web MapPicker', () => {
  test('does not turn an empty latitude into zero', () => {
    const onConfirm = jest.fn();
    render(<MapPicker value={null} radiusM={1000} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByLabelText('Latitude'), '');
    fireEvent.changeText(screen.getByLabelText('Longitude'), '112.76');

    expect(screen.getByRole('button', { name: 'Pilih Titik Ini' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Masukkan koordinat yang valid.')).toBeOnTheScreen();
  });

  test('confirms only bounded coordinates', () => {
    const onConfirm = jest.fn();
    render(<MapPicker value={null} radiusM={1000} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByLabelText('Latitude'), '-7.25');
    fireEvent.changeText(screen.getByLabelText('Longitude'), '112.76');
    fireEvent.press(screen.getByRole('button', { name: 'Pilih Titik Ini' }));

    expect(onConfirm).toHaveBeenCalledWith({ latitude: -7.25, longitude: 112.76 });
  });

  test('does not confirm an out-of-bounds coordinate', () => {
    const onConfirm = jest.fn();
    render(<MapPicker value={null} radiusM={1000} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByLabelText('Latitude'), '90.01');
    fireEvent.changeText(screen.getByLabelText('Longitude'), '112.76');

    expect(screen.getByRole('button', { name: 'Pilih Titik Ini' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Masukkan koordinat yang valid.')).toBeOnTheScreen();
  });
});
