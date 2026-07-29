import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';

import { PetaniDashboard } from '@/app/(app)/petani';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import type { CurrentLocationResult } from '@/services/location';

jest.mock('expo-router', () => {
  const push = jest.fn();
  return {
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

jest.mock('@/services/auth-context', () => {
  type MockProfile = {
    id: string;
    nama: string;
    email: string;
    role: 'farmer';
  };
  const initialProfile: MockProfile = {
    id: 'farmer-1',
    nama: 'Budi',
    email: 'budi@example.com',
    role: 'farmer',
  };
  let profile = initialProfile;
  const signOut = jest.fn();

  return {
    useAuth: () => ({
      profile,
      signOut,
    }),
    __setProfile: (next: MockProfile) => {
      profile = next;
    },
    __resetProfile: () => {
      profile = initialProfile;
    },
  };
});

jest.mock('@/services/plots', () => ({
  fetchAssignedPlots: jest.fn(),
}));

jest.mock('@/services/tasks', () => ({
  fetchFarmerTasks: jest.fn(),
}));

jest.mock('@/services/attendance', () => ({
  checkInIfInsideRadius: jest.fn(),
}));

jest.mock('@/services/location', () => ({
  requestCurrentLocation: jest.fn(),
  openLocationSettings: jest.fn(),
}));

const authMocks = jest.requireMock('@/services/auth-context') as {
  __setProfile: (profile: {
    id: string;
    nama: string;
    email: string;
    role: 'farmer';
  }) => void;
  __resetProfile: () => void;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchAssignedPlots: jest.Mock;
};
const taskMocks = jest.requireMock('@/services/tasks') as {
  fetchFarmerTasks: jest.Mock;
};
const attendanceMocks = jest.requireMock('@/services/attendance') as {
  checkInIfInsideRadius: jest.Mock;
};
const locationMocks = jest.requireMock('@/services/location') as {
  requestCurrentLocation: jest.Mock;
  openLocationSettings: jest.Mock;
};

const nearPlot: FarmPlot = {
  id: 'plot-near',
  namaLahan: 'Sawah Dekat',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  luasHektar: 1.5,
  jenisTanaman: 'Padi',
  faseLahan: 'Vegetatif',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 100,
  status: 'aktif',
};

const farPlot: FarmPlot = {
  ...nearPlot,
  id: 'plot-far',
  namaLahan: 'Sawah Jauh',
  latCenter: -7.35,
  radiusGeofenceM: 200,
};

const inactivePlot: FarmPlot = {
  ...nearPlot,
  id: 'plot-inactive',
  namaLahan: 'Sawah Nonaktif',
  latCenter: -7.25001,
  status: 'tidak aktif',
};

function task(
  id: string,
  title: string,
  overrides: Partial<FarmTask> = {}
): FarmTask {
  return {
    id,
    lahanId: nearPlot.id,
    assignedTo: 'farmer-1',
    assignedBy: 'internal-1',
    judul: title,
    deskripsi: null,
    status: 'belum_dikerjakan',
    deadline: null,
    requiresLocation: true,
    unlockedAt: null,
    ...overrides,
  };
}

function granted(
  overrides: Partial<Extract<CurrentLocationResult, { status: 'granted' }>> = {}
): CurrentLocationResult {
  return {
    status: 'granted',
    coords: { latitude: -7.25, longitude: 112.76 },
    accuracyM: 10,
    timestamp: Date.now(),
    message: null,
    canOpenSettings: false,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function renderReady() {
  render(<PetaniDashboard />);
  return screen.findByRole('button', {
    name: 'Aktifkan GPS & Cek Kehadiran',
  });
}

describe('PetaniDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMocks.__resetProfile();
    plotMocks.fetchAssignedPlots.mockResolvedValue([nearPlot]);
    taskMocks.fetchFarmerTasks.mockResolvedValue([]);
    locationMocks.requestCurrentLocation.mockResolvedValue(granted());
    locationMocks.openLocationSettings.mockResolvedValue(undefined);
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: true,
      distanceM: 0,
      attendanceCreated: true,
    });
  });

  test('loads assigned data without requesting GPS until the explicit action', async () => {
    const action = await renderReady();

    expect(plotMocks.fetchAssignedPlots).toHaveBeenCalledWith('farmer-1');
    expect(taskMocks.fetchFarmerTasks).toHaveBeenCalledWith('farmer-1');
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(attendanceMocks.checkInIfInsideRadius).not.toHaveBeenCalled();

    fireEvent.press(action);

    await waitFor(() => {
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(1);
    });
  });

  test('serializes GPS and persistence as one busy attendance action', async () => {
    const persistence = deferred<{
      unlocked: boolean;
      distanceM: number;
      attendanceCreated: boolean;
    }>();
    attendanceMocks.checkInIfInsideRadius.mockReturnValue(persistence.promise);
    const action = await renderReady();

    fireEvent.press(action);
    fireEvent.press(action);

    await waitFor(() => {
      expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledTimes(1);
    });
    expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', {
      name: 'Aktifkan GPS & Cek Kehadiran',
    })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Periksa Lagi' })).toBeNull();

    await act(async () => {
      persistence.resolve({
        unlocked: true,
        distanceM: 0,
        attendanceCreated: true,
      });
      await persistence.promise;
    });

    expect(await screen.findByText('Kehadiran tercatat')).toBeOnTheScreen();
  });

  test.each([
    [
      'denied',
      {
        status: 'permission-denied',
        coords: null,
        accuracyM: null,
        timestamp: null,
        message: 'Izin lokasi diperlukan untuk melanjutkan aksi ini.',
        canOpenSettings: false,
      } satisfies CurrentLocationResult,
    ],
    [
      'invalid',
      granted({ coords: { latitude: 91, longitude: 112.76 } }),
    ],
  ])(
    'clears a prior task unlock before a %s retry',
    async (_label, secondReading) => {
      taskMocks.fetchFarmerTasks.mockResolvedValue([
        task('task-near', 'Periksa irigasi'),
      ]);
      locationMocks.requestCurrentLocation
        .mockResolvedValueOnce(granted())
        .mockResolvedValueOnce(secondReading);
      const action = await renderReady();

      fireEvent.press(action);
      const retry = await screen.findByRole('button', {
        name: 'Periksa Lagi',
      });
      const readyTask = screen.getByRole('button', {
        name: 'Buka tugas Periksa irigasi',
      });
      expect(within(readyTask).getByText('Siap')).toBeOnTheScreen();

      fireEvent.press(retry);

      await waitFor(() => {
        const resetTask = screen.getByRole('button', {
          name: 'Buka tugas Periksa irigasi',
        });
        expect(
          within(resetTask).getByText('Perlu cek lokasi')
        ).toBeOnTheScreen();
      });
      expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledTimes(1);
    }
  );

  test('validates the granted reading against each task plot radius', async () => {
    const largeAttendancePlot: FarmPlot = {
      ...nearPlot,
      id: 'plot-large',
      namaLahan: 'Kebun Besar',
      radiusGeofenceM: 1000,
    };
    const smallTaskPlot: FarmPlot = {
      ...nearPlot,
      id: 'plot-small',
      namaLahan: 'Petak Kecil',
      latCenter: -7.2501,
      radiusGeofenceM: 100,
    };
    plotMocks.fetchAssignedPlots.mockResolvedValue([
      largeAttendancePlot,
      smallTaskPlot,
    ]);
    taskMocks.fetchFarmerTasks.mockResolvedValue([
      task('task-small', 'Rawat petak kecil', {
        lahanId: smallTaskPlot.id,
      }),
    ]);
    locationMocks.requestCurrentLocation.mockResolvedValue(
      granted({ accuracyM: 150 })
    );
    const action = await renderReady();

    fireEvent.press(action);
    expect(await screen.findByText('Kehadiran tercatat')).toBeOnTheScreen();

    const smallTask = screen.getByRole('button', {
      name: 'Buka tugas Rawat petak kecil',
    });
    expect(within(smallTask).getByText('Perlu cek lokasi')).toBeOnTheScreen();
    expect(within(smallTask).queryByText('Siap')).toBeNull();
  });

  test('ignores an old attendance completion after the farmer changes', async () => {
    const persistence = deferred<{
      unlocked: boolean;
      distanceM: number;
      attendanceCreated: boolean;
    }>();
    attendanceMocks.checkInIfInsideRadius.mockReturnValue(persistence.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = render(<PetaniDashboard />);

    try {
      fireEvent.press(
        await screen.findByRole('button', {
          name: 'Aktifkan GPS & Cek Kehadiran',
        })
      );
      await waitFor(() => {
        expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        authMocks.__setProfile({
          id: 'farmer-2',
          nama: 'Sari',
          email: 'sari@example.com',
          role: 'farmer',
        });
        rendered.rerender(<PetaniDashboard />);
      });
      await waitFor(() => {
        expect(plotMocks.fetchAssignedPlots).toHaveBeenCalledWith('farmer-2');
      });

      await act(async () => {
        persistence.resolve({
          unlocked: true,
          distanceM: 0,
          attendanceCreated: true,
        });
        await persistence.promise;
      });

      expect(screen.queryByText('Kehadiran tercatat')).toBeNull();
      expect(
        await screen.findByRole('button', {
          name: 'Aktifkan GPS & Cek Kehadiran',
        })
      ).toBeOnTheScreen();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('checks attendance against only the nearest active assigned plot', async () => {
    plotMocks.fetchAssignedPlots.mockResolvedValue([
      farPlot,
      inactivePlot,
      nearPlot,
    ]);
    const action = await renderReady();

    fireEvent.press(action);

    await waitFor(() => {
      expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledWith({
        farmerId: 'farmer-1',
        plot: nearPlot,
        userLocation: { latitude: -7.25, longitude: 112.76 },
      });
    });
    expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Kehadiran tercatat')).toBeOnTheScreen();
  });

  test('shows that an existing database attendance is not a new check-in', async () => {
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: true,
      distanceM: 4,
      attendanceCreated: false,
    });
    const action = await renderReady();

    fireEvent.press(action);

    expect(
      await screen.findByText('Kehadiran sudah tercatat')
    ).toBeOnTheScreen();
  });

  test('reports an acceptable reading that is outside the plot radius', async () => {
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: false,
      distanceM: 350,
      attendanceCreated: false,
    });
    const action = await renderReady();

    fireEvent.press(action);

    expect(await screen.findByText('Di luar radius lahan')).toBeOnTheScreen();
  });

  test('keeps a database or network failure distinct from a GPS failure', async () => {
    attendanceMocks.checkInIfInsideRadius.mockRejectedValue(
      new Error('network offline')
    );
    const action = await renderReady();

    fireEvent.press(action);

    expect(
      await screen.findByText(
        'GPS berhasil, tetapi absensi belum tersimpan. Coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText('GPS tidak dapat digunakan')).toBeNull();
  });

  test('requests a fresh reading every time Periksa Lagi is pressed', async () => {
    locationMocks.requestCurrentLocation
      .mockResolvedValueOnce(granted())
      .mockResolvedValueOnce(
        granted({
          coords: { latitude: -7.25002, longitude: 112.76002 },
        })
      );
    const action = await renderReady();

    fireEvent.press(action);
    const retry = await screen.findByRole('button', { name: 'Periksa Lagi' });
    fireEvent.press(retry);

    await waitFor(() => {
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(2);
      expect(attendanceMocks.checkInIfInsideRadius).toHaveBeenCalledTimes(2);
    });
  });

  test.each([
    [
      'out-of-bounds coordinates',
      granted({ coords: { latitude: 91, longitude: 112.76 } }),
      'Koordinat GPS tidak valid. Periksa pengaturan lokasi lalu coba lagi.',
    ],
    [
      'missing accuracy',
      granted({ accuracyM: null }),
      'Akurasi GPS tidak tersedia. Pindah ke area terbuka lalu periksa lagi.',
    ],
    [
      'stale timestamp',
      granted({ timestamp: 0 }),
      'Data GPS sudah kedaluwarsa. Periksa lagi untuk mengambil lokasi baru.',
    ],
    [
      'accuracy above the dynamic plot limit',
      granted({ accuracyM: 51 }),
      'Akurasi GPS belum cukup untuk radius 100 meter. Pindah ke area terbuka lalu periksa lagi.',
    ],
  ] satisfies [string, CurrentLocationResult, string][])(
    'rejects %s before attempting attendance',
    async (_label, result, expectedMessage) => {
      locationMocks.requestCurrentLocation.mockResolvedValue(result);
      const action = await renderReady();

      fireEvent.press(action);

      expect(await screen.findByText(expectedMessage)).toBeOnTheScreen();
      expect(attendanceMocks.checkInIfInsideRadius).not.toHaveBeenCalled();
    }
  );

  test('opens settings when location permission is blocked', async () => {
    locationMocks.requestCurrentLocation.mockResolvedValue({
      status: 'permission-blocked',
      coords: null,
      accuracyM: null,
      timestamp: null,
      message:
        'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
      canOpenSettings: true,
    } satisfies CurrentLocationResult);
    const action = await renderReady();

    fireEvent.press(action);
    fireEvent.press(
      await screen.findByRole('button', { name: 'Buka Pengaturan' })
    );

    expect(locationMocks.openLocationSettings).toHaveBeenCalledTimes(1);
  });

  test('renders Field First metrics and groups task cards by GPS-aware state', async () => {
    plotMocks.fetchAssignedPlots.mockResolvedValue([
      nearPlot,
      farPlot,
      inactivePlot,
    ]);
    taskMocks.fetchFarmerTasks.mockResolvedValue([
      task('task-ready', 'Catat hasil panen', { requiresLocation: false }),
      task('task-near', 'Periksa irigasi'),
      task('task-far', 'Cek pupuk', { lahanId: farPlot.id }),
      task('task-done', 'Bersihkan alat', { status: 'selesai' }),
    ]);
    const action = await renderReady();

    expect(screen.getByText('FIELD FIRST')).toBeOnTheScreen();
    expect(screen.getByText('Lahan aktif')).toBeOnTheScreen();
    expect(screen.getByText('Total tugas')).toBeOnTheScreen();
    expect(screen.getByText('Siap dikerjakan')).toBeOnTheScreen();
    expect(screen.getAllByText('Perlu cek lokasi').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Selesai').length).toBeGreaterThanOrEqual(2);

    const nearTask = screen.getByRole('button', {
      name: 'Buka tugas Periksa irigasi',
    });
    expect(within(nearTask).getByText('Perlu cek lokasi')).toBeOnTheScreen();

    fireEvent.press(action);

    await waitFor(() => {
      const updatedNearTask = screen.getByRole('button', {
        name: 'Buka tugas Periksa irigasi',
      });
      expect(within(updatedNearTask).getByText('Siap')).toBeOnTheScreen();
    });
    const farTask = screen.getByRole('button', {
      name: 'Buka tugas Cek pupuk',
    });
    expect(within(farTask).getByText('Di luar radius')).toBeOnTheScreen();
    expect(within(farTask).getByText('Radius lahan: 200 meter')).toBeOnTheScreen();
  });

  test('uses FeedbackState for load errors and retries data without GPS', async () => {
    plotMocks.fetchAssignedPlots.mockRejectedValueOnce(new Error('offline'));
    render(<PetaniDashboard />);

    expect(await screen.findByText('Dashboard belum tersedia')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(await screen.findByText('Belum ada tugas')).toBeOnTheScreen();
    expect(plotMocks.fetchAssignedPlots).toHaveBeenCalledTimes(2);
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });
});
