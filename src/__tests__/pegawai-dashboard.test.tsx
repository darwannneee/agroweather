import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PegawaiDashboard } from '@/app/(app)/pegawai';
import type { FarmPlot } from '@/lib/farm-types';
import type { AppUser } from '@/services/supabase';

jest.mock('expo-router', () => {
  const push = jest.fn();
  return {
    useRouter: () => ({ push }),
    __push: push,
  };
});

jest.mock('@/services/auth-context', () => ({
  useAuth: () => ({
    profile: {
      id: 'internal-1',
      email: 'rina@example.com',
      nama: 'Rina',
      role: 'internal',
    },
    signOut: jest.fn(),
  }),
}));

jest.mock('@/services/auth', () => ({
  fetchFarmers: jest.fn(),
}));

jest.mock('@/services/location', () => ({
  requestCurrentLocation: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  fetchPlots: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __push: jest.Mock;
};
const authMocks = jest.requireMock('@/services/auth') as {
  fetchFarmers: jest.Mock;
};
const locationMocks = jest.requireMock('@/services/location') as {
  requestCurrentLocation: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlots: jest.Mock;
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
    faseLahan: 'Vegetatif',
    latCenter: -7.26,
    lngCenter: 112.77,
    radiusGeofenceM: 800,
    status: 'aktif',
  },
  {
    id: 'plot-3',
    namaLahan: 'Kebun Barat',
    farmerId: 'farmer-2',
    farmerName: 'Budi',
    luasHektar: 3,
    jenisTanaman: 'Jagung',
    faseLahan: 'Tanam',
    latCenter: -7.27,
    lngCenter: 112.78,
    radiusGeofenceM: 1_200,
    status: 'aktif',
  },
  {
    id: 'plot-4',
    namaLahan: 'Kebun Timur',
    farmerId: null,
    farmerName: null,
    luasHektar: 1,
    jenisTanaman: 'Cabai',
    faseLahan: null,
    latCenter: -7.28,
    lngCenter: 112.79,
    radiusGeofenceM: 600,
    status: 'tidak aktif',
  },
];

const farmers: AppUser[] = [
  {
    id: 'farmer-1',
    email: 'sari@example.com',
    nama: 'Sari',
    role: 'farmer',
  },
  {
    id: 'farmer-2',
    email: 'budi@example.com',
    nama: 'Budi',
    role: 'farmer',
  },
];

describe('PegawaiDashboard', () => {
  beforeEach(() => {
    routerMocks.__push.mockReset();
    authMocks.fetchFarmers.mockReset();
    authMocks.fetchFarmers.mockResolvedValue(farmers);
    locationMocks.requestCurrentLocation.mockReset();
    plotMocks.fetchPlots.mockReset();
    plotMocks.fetchPlots.mockResolvedValue(plots);
  });

  test('shows real plot metrics and operations without GPS or placeholder sections', async () => {
    render(<PegawaiDashboard />);

    expect(screen.getByText('Memuat dashboard…')).toBeOnTheScreen();

    await waitFor(() => {
      expect(screen.getByText('4')).toBeOnTheScreen();
      expect(screen.getByText('3')).toBeOnTheScreen();
      expect(screen.getByText('2')).toBeOnTheScreen();
    });

    expect(plotMocks.fetchPlots).toHaveBeenCalledTimes(1);
    expect(authMocks.fetchFarmers).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Pagi, Rina')).toBeOnTheScreen();
    expect(screen.getByText('Penataan Lahan')).toBeOnTheScreen();
    expect(screen.queryByText('Tugas Perlu Verifikasi')).toBeNull();
    expect(screen.queryByText('Aktivitas Petani Binaan')).toBeNull();
    expect(screen.queryByText('Assign Tugas Baru')).toBeNull();
    expect(screen.queryByText(/Cuaca/i)).toBeNull();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Kelola Lahan' }));
    expect(routerMocks.__push).toHaveBeenCalledWith('/(app)/penataan-lahan');
  });

  test('keeps the loading state visible while both data requests are pending', () => {
    plotMocks.fetchPlots.mockReturnValue(new Promise(() => {}));
    authMocks.fetchFarmers.mockReturnValue(new Promise(() => {}));

    render(<PegawaiDashboard />);

    expect(screen.getByText('Memuat dashboard…')).toBeOnTheScreen();
    expect(screen.queryByText('Penataan Lahan')).toBeNull();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test('shows an error state and retries both real data requests', async () => {
    plotMocks.fetchPlots
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(plots);

    render(<PegawaiDashboard />);

    expect(await screen.findByText('Dashboard belum tersedia')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    await waitFor(() => {
      expect(screen.getByText('4')).toBeOnTheScreen();
    });
    expect(plotMocks.fetchPlots).toHaveBeenCalledTimes(2);
    expect(authMocks.fetchFarmers).toHaveBeenCalledTimes(2);
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });
});
