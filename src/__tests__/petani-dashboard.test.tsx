import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';

import { PetaniDashboard } from '@/app/(app)/petani';
import type {
  AttendanceRecord,
  FarmPlot,
  FarmTask,
} from '@/lib/farm-types';
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

jest.mock('@/lib/daily-operations', () => {
  const actual = jest.requireActual('@/lib/daily-operations');
  return {
    ...actual,
    jakartaDate: () => '2026-07-30',
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
  fetchFarmerAttendanceForDate: jest.fn(),
}));

jest.mock('@/services/weather', () => ({
  fetchLatestWeatherForPlots: jest.fn(),
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
  fetchFarmerAttendanceForDate: jest.Mock;
};
const weatherMocks = jest.requireMock('@/services/weather') as {
  fetchLatestWeatherForPlots: jest.Mock;
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

const attendanceRecord: AttendanceRecord = {
  id: 'attendance-1',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  plotId: nearPlot.id,
  plotName: nearPlot.namaLahan,
  attendanceDate: '2026-07-30',
  checkedInAt: '2026-07-29T22:42:00.000Z',
  distanceM: 4,
  latitude: -7.25,
  longitude: 112.76,
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
    scheduledFor: '2026-07-30',
    priority: 'medium',
    source: 'manual',
    aiReason: null,
    requiresLocation: true,
    unlockedAt: null,
    latestEvidence: null,
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
      attendanceRecorded: true,
      attendance: null,
    });
    attendanceMocks.fetchFarmerAttendanceForDate.mockResolvedValue(null);
    weatherMocks.fetchLatestWeatherForPlots.mockResolvedValue([{
      plotId: nearPlot.id,
      plotName: nearPlot.namaLahan,
      observedAt: '2026-07-30T00:00:00.000Z',
      description: 'cerah berawan',
      temperatureC: 29,
      humidityPercent: 78,
      rainMm: 0,
      forecastMinTemperatureC: 24,
      forecastMaxTemperatureC: 32,
      forecastMaxRainProbability: 0.35,
    }]);
  });

  test('loads assigned data without requesting GPS until the explicit action', async () => {
    const action = await renderReady();

    expect(plotMocks.fetchAssignedPlots).toHaveBeenCalledWith('farmer-1');
    expect(taskMocks.fetchFarmerTasks).toHaveBeenCalledWith(
      'farmer-1',
      '2026-07-30'
    );
    expect(
      attendanceMocks.fetchFarmerAttendanceForDate
    ).toHaveBeenCalledWith('farmer-1', '2026-07-30');
    expect(weatherMocks.fetchLatestWeatherForPlots).toHaveBeenCalledWith([
      nearPlot.id,
    ]);
    expect(screen.getByText('Cuaca Lahan')).toBeOnTheScreen();
    expect(screen.getByText('Sawah Dekat')).toBeOnTheScreen();
    expect(screen.getByText('29°C sekarang · cerah berawan')).toBeOnTheScreen();
    expect(screen.getByText('Update 07:00 WIB')).toBeOnTheScreen();
    expect(
      screen.getByText('Ke depan 24–32°C · peluang hujan 35%')
    ).toBeOnTheScreen();
    expect(screen.getByText('Belum absen')).toBeOnTheScreen();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(attendanceMocks.checkInIfInsideRadius).not.toHaveBeenCalled();

    fireEvent.press(action);

    await waitFor(() => {
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(1);
    });
  });

  test('renders stored attendance immediately without requesting GPS', async () => {
    attendanceMocks.fetchFarmerAttendanceForDate.mockResolvedValue(
      attendanceRecord
    );
    render(<PetaniDashboard />);

    expect(
      await screen.findByText('Sudah absen · 05:42 WIB')
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', {
        name: 'Aktifkan GPS & Cek Kehadiran',
      })
    ).toBeNull();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test('updates the attendance card from a successful check-in record', async () => {
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: true,
      distanceM: 4,
      attendanceRecorded: true,
      attendance: attendanceRecord,
    });
    const action = await renderReady();

    fireEvent.press(action);

    expect(
      await screen.findByText('Sudah absen · 05:42 WIB')
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Periksa Lagi' })
    ).toBeNull();
  });

  test('renders only the operational date tasks in evidence-aware priority order', async () => {
    taskMocks.fetchFarmerTasks.mockResolvedValue([
      task('task-completed', 'Task selesai', {
        priority: 'high',
        latestEvidence: { status: 'accepted', reviewNote: null },
      }),
      task('task-pending', 'Task menunggu review', {
        priority: 'high',
        latestEvidence: { status: 'pending', reviewNote: null },
      }),
      task('task-high', 'Task prioritas tinggi', {
        priority: 'high',
        requiresLocation: false,
      }),
      task('task-revision', 'Task perlu perbaikan', {
        priority: 'low',
        latestEvidence: {
          status: 'revision_requested',
          reviewNote: 'Foto terlalu gelap.',
        },
      }),
      task('task-yesterday', 'Task kemarin', {
        scheduledFor: '2026-07-29',
      }),
    ]);
    await renderReady();

    expect(screen.getByText('Task Hari Ini')).toBeOnTheScreen();
    expect(screen.queryByText('Task kemarin')).toBeNull();
    const cards = screen.getAllByRole('button', {
      name: /^Buka tugas/,
    });
    expect(
      cards.map((card) => card.props.accessibilityLabel.split(',')[0])
    ).toEqual([
      'Buka tugas Task perlu perbaikan',
      'Buka tugas Task prioritas tinggi',
      'Buka tugas Task menunggu review',
      'Buka tugas Task selesai',
    ]);
    expect(within(cards[0]).getByText('Perlu perbaikan')).toBeOnTheScreen();
    expect(within(cards[2]).getByText('Menunggu review')).toBeOnTheScreen();
    expect(within(cards[3]).getByText('Selesai')).toBeOnTheScreen();
  });

  test.each([
    {
      status: 'permission-denied' as const,
      message: 'Izin lokasi diperlukan untuk melanjutkan aksi ini.',
      actionLabel: 'Periksa Lagi',
      canOpenSettings: false,
    },
    {
      status: 'services-disabled' as const,
      message: 'GPS perangkat belum aktif. Nyalakan layanan lokasi lalu coba lagi.',
      actionLabel: 'Buka Pengaturan',
      canOpenSettings: true,
    },
    {
      status: 'unavailable' as const,
      message: 'Lokasi belum ditemukan. Coba lagi di area terbuka.',
      actionLabel: 'Periksa Lagi',
      canOpenSettings: false,
    },
  ])('renders the recovery action for a $status GPS result', async ({
    status,
    message,
    actionLabel,
    canOpenSettings,
  }) => {
    locationMocks.requestCurrentLocation.mockResolvedValue({
      status,
      coords: null,
      accuracyM: null,
      timestamp: null,
      message,
      canOpenSettings,
    } satisfies CurrentLocationResult);
    const action = await renderReady();

    fireEvent.press(action);

    expect(await screen.findByText(message)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: actionLabel }));
    if (canOpenSettings) {
      expect(locationMocks.openLocationSettings).toHaveBeenCalledWith(status);
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(1);
    } else {
      await waitFor(() => {
        expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(2);
      });
    }
  });

  test('serializes GPS and persistence as one busy attendance action', async () => {
    const persistence = deferred<{
      unlocked: boolean;
      distanceM: number;
      attendanceRecorded: boolean;
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
        attendanceRecorded: true,
      });
      await persistence.promise;
    });

    expect(await screen.findByText('Kehadiran terkonfirmasi')).toBeOnTheScreen();
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
        name: /^Buka tugas Periksa irigasi,/,
      });
      expect(within(readyTask).getByText('Siap')).toBeOnTheScreen();

      fireEvent.press(retry);

      await waitFor(() => {
        const resetTask = screen.getByRole('button', {
          name: /^Buka tugas Periksa irigasi,/,
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
    expect(await screen.findByText('Kehadiran terkonfirmasi')).toBeOnTheScreen();

    const smallTask = screen.getByRole('button', {
      name: /^Buka tugas Rawat petak kecil,/,
    });
    expect(within(smallTask).getByText('Perlu cek lokasi')).toBeOnTheScreen();
    expect(within(smallTask).queryByText('Siap')).toBeNull();
  });

  test('ignores an old attendance completion after the farmer changes', async () => {
    const persistence = deferred<{
      unlocked: boolean;
      distanceM: number;
      attendanceRecorded: boolean;
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
          attendanceRecorded: true,
        });
        await persistence.promise;
      });

      expect(screen.queryByText('Kehadiran terkonfirmasi')).toBeNull();
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
    expect(await screen.findByText('Kehadiran terkonfirmasi')).toBeOnTheScreen();
  });

  test('uses truthful generic success copy for an idempotently returned attendance', async () => {
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: true,
      distanceM: 4,
      attendanceRecorded: true,
    });
    const action = await renderReady();

    fireEvent.press(action);

    expect(
      await screen.findByText('Kehadiran terkonfirmasi')
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Anda berada di dalam radius Sawah Dekat. Kehadiran hari ini terkonfirmasi.'
      )
    ).toBeOnTheScreen();
    expect(
      screen.queryByText(
        'Anda berada di dalam radius Sawah Dekat. Absensi berhasil disimpan.'
      )
    ).toBeNull();
    expect(
      screen.queryByText(
        'Anda berada di dalam radius Sawah Dekat. Absensi hari ini sudah ada.'
      )
    ).toBeNull();
  });

  test('reports an acceptable reading that is outside the plot radius', async () => {
    attendanceMocks.checkInIfInsideRadius.mockResolvedValue({
      unlocked: false,
      distanceM: 350,
      attendanceRecorded: false,
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

    expect(locationMocks.openLocationSettings).toHaveBeenCalledWith(
      'permission-blocked'
    );
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
    expect(screen.getByText('Task hari ini')).toBeOnTheScreen();
    expect(screen.getByText('Task Hari Ini')).toBeOnTheScreen();
    expect(screen.getAllByText('Perlu cek lokasi').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Selesai')).toBeOnTheScreen();

    const nearTask = screen.getByRole('button', {
      name: /^Buka tugas Periksa irigasi,/,
    });
    expect(within(nearTask).getByText('Perlu cek lokasi')).toBeOnTheScreen();

    fireEvent.press(action);

    await waitFor(() => {
      const updatedNearTask = screen.getByRole('button', {
        name: /^Buka tugas Periksa irigasi,/,
      });
      expect(within(updatedNearTask).getByText('Siap')).toBeOnTheScreen();
    });
    const farTask = screen.getByRole('button', {
      name: /^Buka tugas Cek pupuk,/,
    });
    expect(within(farTask).getByText('Di luar radius')).toBeOnTheScreen();
    expect(within(farTask).getByText('Radius lahan: 200 meter')).toBeOnTheScreen();
  });

  test('uses FeedbackState for load errors and retries data without GPS', async () => {
    plotMocks.fetchAssignedPlots.mockRejectedValueOnce(new Error('offline'));
    render(<PetaniDashboard />);

    expect(await screen.findByText('Dashboard belum tersedia')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(
      await screen.findByText('Belum ada task hari ini')
    ).toBeOnTheScreen();
    expect(plotMocks.fetchAssignedPlots).toHaveBeenCalledTimes(2);
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });
});
