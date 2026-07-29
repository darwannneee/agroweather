import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapPicker } from '../map-picker';

jest.mock('react-native-maps', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const animateToRegion = jest.fn();
  const MapView = React.forwardRef<
    { animateToRegion: typeof animateToRegion },
    React.PropsWithChildren<{ style?: React.ComponentProps<typeof View>['style'] }>
  >(({ children, style }, ref) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion }));
    return React.createElement(View, { style }, children);
  });
  MapView.displayName = 'MockMapView';

  return {
    __esModule: true,
    default: MapView,
    Circle: () => null,
    __animateToRegion: animateToRegion,
  };
});

const { __animateToRegion: animateToRegion } = jest.requireMock('react-native-maps') as {
  __animateToRegion: jest.Mock;
};

describe('native MapPicker', () => {
  beforeEach(() => {
    animateToRegion.mockClear();
  });

  test('does not request or confirm a coordinate on mount or GPS recenter', () => {
    const onRequestLocation = jest.fn();
    const onConfirm = jest.fn();
    const { rerender } = render(
      <MapPicker
        value={null}
        radiusM={1000}
        onConfirm={onConfirm}
        onRequestLocation={onRequestLocation}
      />
    );

    expect(onRequestLocation).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Gunakan Lokasi Saya' }));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);

    rerender(
      <MapPicker
        value={null}
        radiusM={1000}
        requestedLocation={{ latitude: -7.25, longitude: 112.76 }}
        onConfirm={onConfirm}
        onRequestLocation={onRequestLocation}
      />
    );
    expect(animateToRegion).toHaveBeenLastCalledWith(
      {
        latitude: -7.25,
        longitude: 112.76,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350
    );
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <MapPicker
        value={null}
        radiusM={1000}
        requestedLocation={{ latitude: -7.26, longitude: 112.77 }}
        onConfirm={onConfirm}
        onRequestLocation={onRequestLocation}
      />
    );
    expect(animateToRegion).toHaveBeenLastCalledWith(
      {
        latitude: -7.26,
        longitude: 112.77,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350
    );
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Titik Ini' }));
    expect(onConfirm).toHaveBeenCalledWith({ latitude: -7.26, longitude: 112.77 });
  });

  test('keeps manual panning and confirmation available after a GPS error', () => {
    const onConfirm = jest.fn();
    render(
      <MapPicker
        value={null}
        radiusM={1000}
        locationError="GPS perangkat belum aktif."
        onConfirm={onConfirm}
        onRequestLocation={() => undefined}
      />
    );

    expect(screen.getByText('GPS perangkat belum aktif.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Pilih Titik Ini' }));
    expect(onConfirm).toHaveBeenCalledWith({
      latitude: -7.250445,
      longitude: 112.768845,
    });
  });
});
