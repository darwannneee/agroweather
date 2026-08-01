import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FarmerManagementScreen } from '@/app/(app)/petani-management';
import type { AppUser } from '@/services/supabase';

const hiddenIcon = { includeHiddenElements: true };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/domain/role-guard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    RoleGuard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/services/auth', () => ({
  fetchFarmers: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  fetchPlots: jest.fn(),
}));

jest.mock('@/services/farmer-management', () => ({
  createInternalFarmer: jest.fn(),
  updateInternalFarmerProfile: jest.fn(),
}));

const authMocks = jest.requireMock('@/services/auth') as {
  fetchFarmers: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlots: jest.Mock;
};
const farmerMocks = jest.requireMock('@/services/farmer-management') as {
  createInternalFarmer: jest.Mock;
  updateInternalFarmerProfile: jest.Mock;
};

const farmers: AppUser[] = [{
  id: 'farmer-1',
  nama: 'Sari',
  email: 'sari@example.com',
  role: 'farmer',
}];

const plots = [{
  id: 'plot-1',
  namaLahan: 'Sawah Utara',
  farmerId: 'farmer-1',
  farmerName: 'Sari',
  farmerIds: ['farmer-1'],
  farmerNames: ['Sari'],
  primaryFarmerId: 'farmer-1',
  luasHektar: 2,
  jenisTanaman: 'Padi',
  faseLahan: 'Vegetatif',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 1000,
  status: 'aktif' as const,
}, {
  id: 'plot-2',
  namaLahan: 'Sawah Selatan',
  farmerId: null,
  farmerName: null,
  farmerIds: [],
  farmerNames: [],
  primaryFarmerId: null,
  luasHektar: 1,
  jenisTanaman: 'Jagung',
  faseLahan: 'Tanam',
  latCenter: -7.26,
  lngCenter: 112.77,
  radiusGeofenceM: 800,
  status: 'aktif' as const,
}];

describe('FarmerManagementScreen', () => {
  beforeEach(() => {
    authMocks.fetchFarmers.mockReset();
    authMocks.fetchFarmers.mockResolvedValue(farmers);
    plotMocks.fetchPlots.mockReset();
    plotMocks.fetchPlots.mockResolvedValue(plots);
    farmerMocks.createInternalFarmer.mockReset();
    farmerMocks.createInternalFarmer.mockResolvedValue('farmer-2');
    farmerMocks.updateInternalFarmerProfile.mockReset();
    farmerMocks.updateInternalFarmerProfile.mockResolvedValue(undefined);
  });

  test('creates an auto-confirmed farmer with selected plots', async () => {
    render(<FarmerManagementScreen />);

    expect(await screen.findByText('Sari')).toBeOnTheScreen();
    expect(screen.getByText('👨‍🌾', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('🗺️', hiddenIcon)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Tambah Petani' }));
    fireEvent.changeText(screen.getByLabelText('Nama Petani'), 'Budi');
    fireEvent.changeText(screen.getByLabelText('Email Petani'), 'budi@example.com');
    fireEvent.changeText(screen.getByLabelText('Password Awal'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: 'Assign Sawah Utara' }));
    fireEvent.press(screen.getByRole('button', { name: 'Assign Sawah Selatan' }));
    fireEvent.press(screen.getByRole('button', { name: 'Simpan Petani' }));

    await waitFor(() => {
      expect(farmerMocks.createInternalFarmer).toHaveBeenCalledWith({
        nama: 'Budi',
        email: 'budi@example.com',
        password: 'password123',
        plotIds: ['plot-1', 'plot-2'],
      });
    });
    expect(authMocks.fetchFarmers).toHaveBeenCalledTimes(2);
  });

  test('edits profile details and plot assignments without a password field', async () => {
    render(<FarmerManagementScreen />);

    await screen.findByText('Sari');
    fireEvent.press(screen.getByRole('button', { name: 'Edit Sari' }));

    expect(screen.queryByLabelText('Password Awal')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Nama Petani'), 'Sari Baru');
    fireEvent.press(screen.getByRole('button', { name: 'Assign Sawah Selatan' }));
    fireEvent.press(screen.getByRole('button', { name: 'Simpan Petani' }));

    await waitFor(() => {
      expect(farmerMocks.updateInternalFarmerProfile).toHaveBeenCalledWith({
        farmerId: 'farmer-1',
        nama: 'Sari Baru',
        email: 'sari@example.com',
        plotIds: ['plot-1', 'plot-2'],
      });
    });
  });
});
