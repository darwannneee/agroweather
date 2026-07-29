import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PlotFormContent } from '@/app/(app)/penataan-lahan/form';
import type { FarmPlot } from '@/lib/farm-types';

jest.mock('expo-router', () => {
  const dismissTo = jest.fn();
  const dispatch = jest.fn();
  let params: { plotId?: string | string[] } = {};

  return {
    useLocalSearchParams: () => params,
    useNavigation: () => ({ dispatch }),
    useRouter: () => ({ dismissTo }),
    __dismissTo: dismissTo,
    __dispatch: dispatch,
    __setParams: (next: typeof params) => {
      params = next;
    },
  };
});

jest.mock('@/components/domain/role-guard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    RoleGuard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@react-navigation/native', () => {
  const usePreventRemove = jest.fn();
  return { usePreventRemove, __usePreventRemove: usePreventRemove };
});

jest.mock('@/components/domain/map-picker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  function MapPicker({
    onConfirm,
    onRequestLocation,
  }: {
    onConfirm: (coords: { latitude: number; longitude: number }) => void;
    onRequestLocation?: () => void;
  }) {
    return React.createElement(
      View,
      null,
      React.createElement(
        Pressable,
        {
          accessibilityLabel: 'Gunakan Lokasi Saya',
          accessibilityRole: 'button',
          onPress: onRequestLocation,
        },
        React.createElement(Text, null, 'Gunakan Lokasi Saya')
      ),
      React.createElement(
        Pressable,
        {
          accessibilityLabel: 'Konfirmasi Titik Peta',
          accessibilityRole: 'button',
          onPress: () => onConfirm({ latitude: -7.25, longitude: 112.76 }),
        },
        React.createElement(Text, null, 'Konfirmasi Titik Peta')
      )
    );
  }

  return { MapPicker };
});

jest.mock('@/hooks/use-location-action', () => {
  const run = jest.fn();
  const reset = jest.fn();
  return {
    useLocationAction: () => ({
      state: { status: 'idle', result: null },
      run,
      reset,
    }),
    __run: run,
    __reset: reset,
  };
});

jest.mock('@/services/auth', () => ({
  fetchFarmers: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  createPlot: jest.fn(),
  fetchPlotById: jest.fn(),
  updatePlot: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __dismissTo: jest.Mock;
  __dispatch: jest.Mock;
  __setParams: (params: { plotId?: string | string[] }) => void;
};
const navigationMocks = jest.requireMock('@react-navigation/native') as {
  __usePreventRemove: jest.Mock;
};
const locationMocks = jest.requireMock('@/hooks/use-location-action') as {
  __run: jest.Mock;
  __reset: jest.Mock;
};
const authMocks = jest.requireMock('@/services/auth') as {
  fetchFarmers: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  createPlot: jest.Mock;
  fetchPlotById: jest.Mock;
  updatePlot: jest.Mock;
};

const existingPlot: FarmPlot = {
  id: 'plot-1',
  namaLahan: 'Sawah Lama',
  farmerId: null,
  farmerName: null,
  luasHektar: 2.5,
  jenisTanaman: 'Padi',
  faseLahan: 'Penyiraman',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 1000,
  status: 'tidak aktif',
};

function fillRequiredTextFields() {
  fireEvent.changeText(screen.getByLabelText('Nama Lahan'), 'Sawah Baru');
  fireEvent.changeText(screen.getByLabelText('Luas Lahan (ha)'), '2.5');
  fireEvent.changeText(screen.getByLabelText('Jenis Tanaman'), 'Padi');
  fireEvent.changeText(screen.getByLabelText('Fase Lahan'), 'Penyiraman');
}

describe('PlotFormScreen', () => {
  beforeEach(() => {
    routerMocks.__setParams({});
    routerMocks.__dismissTo.mockReset();
    routerMocks.__dispatch.mockReset();
    navigationMocks.__usePreventRemove.mockClear();
    locationMocks.__run.mockReset();
    locationMocks.__run.mockResolvedValue({
      status: 'granted',
      coords: { latitude: -7.25, longitude: 112.76 },
    });
    locationMocks.__reset.mockClear();
    authMocks.fetchFarmers.mockReset();
    authMocks.fetchFarmers.mockResolvedValue([]);
    plotMocks.createPlot.mockReset();
    plotMocks.createPlot.mockResolvedValue(undefined);
    plotMocks.fetchPlotById.mockReset();
    plotMocks.fetchPlotById.mockResolvedValue(existingPlot);
    plotMocks.updatePlot.mockReset();
    plotMocks.updatePlot.mockResolvedValue(undefined);
  });

  test('requests GPS only on action and saves its coordinate only after map confirmation', async () => {
    render(<PlotFormContent />);

    expect(await screen.findByText('Tambah Lahan')).toBeOnTheScreen();
    expect(locationMocks.__run).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Gunakan Lokasi Saya' }));
    expect(locationMocks.__run).toHaveBeenCalledTimes(1);

    fillRequiredTextFields();
    expect(navigationMocks.__usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Simpan Lahan' }));
    expect(plotMocks.createPlot).not.toHaveBeenCalled();
    expect(await screen.findByText('Latitude lahan wajib dipilih')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Konfirmasi Titik Peta' }));
    fireEvent.press(screen.getByRole('button', { name: 'Simpan Lahan' }));

    await waitFor(() => {
      expect(plotMocks.createPlot).toHaveBeenCalledWith(
        expect.objectContaining({ latCenter: -7.25, lngCenter: 112.76 })
      );
      expect(routerMocks.__dismissTo).toHaveBeenCalledWith('/(app)/penataan-lahan');
    });
    expect(navigationMocks.__usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
  });

  test('loads an edit route and calls update without creating', async () => {
    routerMocks.__setParams({ plotId: 'plot-1' });
    render(<PlotFormContent />);

    expect(await screen.findByText('Edit Lahan')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nama Lahan')).toHaveProp('value', 'Sawah Lama');

    fireEvent.changeText(screen.getByLabelText('Nama Lahan'), 'Sawah Diperbarui');
    fireEvent.press(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(plotMocks.updatePlot).toHaveBeenCalledWith(
        'plot-1',
        expect.objectContaining({ namaLahan: 'Sawah Diperbarui' })
      );
      expect(routerMocks.__dismissTo).toHaveBeenCalledWith('/(app)/penataan-lahan');
    });
    expect(plotMocks.createPlot).not.toHaveBeenCalled();
  });

  test('resets edit values when the route changes to create', async () => {
    routerMocks.__setParams({ plotId: 'plot-1' });
    const { rerender } = render(<PlotFormContent />);
    expect(await screen.findByText('Edit Lahan')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nama Lahan')).toHaveProp('value', 'Sawah Lama');

    routerMocks.__setParams({});
    rerender(<PlotFormContent />);

    expect(await screen.findByText('Tambah Lahan')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Nama Lahan')).toHaveProp('value', '');
    });
  });

  test('shows a retry action when form loading fails', async () => {
    authMocks.fetchFarmers.mockRejectedValueOnce(new Error('offline'));
    render(<PlotFormContent />);

    expect(await screen.findByText('Form lahan belum tersedia')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(await screen.findByText('Tambah Lahan')).toBeOnTheScreen();
    expect(authMocks.fetchFarmers).toHaveBeenCalledTimes(2);
  });
});
