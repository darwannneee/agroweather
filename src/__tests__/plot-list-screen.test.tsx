import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { PlotListScreen } from '@/app/(app)/penataan-lahan';
import type { FarmPlot } from '@/lib/farm-types';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const push = jest.fn();

  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
    useRouter: () => ({ push }),
    __push: push,
  };
});

jest.mock('@/components/domain/role-guard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    RoleGuard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/services/plots', () => ({
  fetchPlots: jest.fn(),
  setPlotStatus: jest.fn(),
}));

const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlots: jest.Mock;
  setPlotStatus: jest.Mock;
};

const plots: FarmPlot[] = [
  {
    id: 'plot-1',
    namaLahan: 'Sawah Utara',
    farmerId: 'farmer-1',
    farmerName: 'Sari',
    luasHektar: 2,
    jenisTanaman: 'Padi',
    faseLahan: 'Vegetatif',
    latCenter: -7.25,
    lngCenter: 112.76,
    radiusGeofenceM: 1_000,
    status: 'aktif',
  },
  {
    id: 'plot-2',
    namaLahan: 'Sawah Selatan',
    farmerId: 'farmer-1',
    farmerName: 'Sari',
    luasHektar: 1.5,
    jenisTanaman: 'Padi',
    faseLahan: 'Panen',
    latCenter: -7.26,
    lngCenter: 112.77,
    radiusGeofenceM: 800,
    status: 'tidak aktif',
  },
];

describe('PenataanLahanScreen', () => {
  beforeEach(() => {
    plotMocks.fetchPlots.mockReset();
    plotMocks.fetchPlots.mockResolvedValue(plots);
    plotMocks.setPlotStatus.mockReset();
    plotMocks.setPlotStatus.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('counts two plots assigned to the same farmer as one assigned farmer', async () => {
    render(<PlotListScreen />);

    await screen.findByText('Sawah Utara');

    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getAllByText('2')).toHaveLength(1);
    expect(screen.getByText('Petani')).toBeOnTheScreen();
  });

  test('does not render plot stats during initial loading or after a load error', async () => {
    let rejectPlots!: (reason: Error) => void;
    plotMocks.fetchPlots.mockImplementationOnce(
      () =>
        new Promise<FarmPlot[]>((_resolve, reject) => {
          rejectPlots = reject;
        })
    );

    render(<PlotListScreen />);

    expect(screen.getByText('Memuat data lahan…')).toBeOnTheScreen();
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText('Aktif')).toBeNull();
    expect(screen.queryByText('Petani')).toBeNull();

    await act(async () => {
      rejectPlots(new Error('offline'));
    });
    await screen.findByText('Data lahan belum tersedia');

    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText('Aktif')).toBeNull();
    expect(screen.queryByText('Petani')).toBeNull();
  });

  test('does not refetch or update mutation state after focus cleanup', async () => {
    let resolveStatus!: () => void;
    plotMocks.setPlotStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStatus = resolve;
        })
    );
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { unmount } = render(<PlotListScreen />);

    await screen.findByText('Sawah Utara');
    fireEvent.press(screen.getByRole('button', { name: 'Nonaktifkan Sawah Utara' }));

    const confirmationButtons = alertSpy.mock.calls.at(-1)?.[2];
    const confirm = confirmationButtons?.find((button) => button.text === 'Ubah');
    act(() => {
      confirm?.onPress?.();
    });
    await waitFor(() => {
      expect(plotMocks.setPlotStatus).toHaveBeenCalledWith('plot-1', 'tidak aktif');
    });

    unmount();
    await act(async () => {
      resolveStatus();
      await Promise.resolve();
    });

    expect(plotMocks.fetchPlots).toHaveBeenCalledTimes(1);
  });
});
