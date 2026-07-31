import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { PegawaiDashboard } from '@/app/(app)/pegawai';
import type { DailyOperations } from '@/services/daily-operations';

const hiddenIcon = { includeHiddenElements: true };

jest.mock('expo-router', () => {
  const push = jest.fn();
  return {
    useRouter: () => ({ push }),
    __push: push,
  };
});

jest.mock('@/lib/daily-operations', () => {
  const actual = jest.requireActual('@/lib/daily-operations');
  return {
    ...actual,
    jakartaDate: jest.fn(() => '2026-07-30'),
  };
});

jest.mock('@/services/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/daily-operations', () => ({
  fetchDailyOperations: jest.fn(),
}));

jest.mock('@/services/location', () => ({
  requestCurrentLocation: jest.fn(),
}));

jest.mock('@/services/ai-drafts', () => ({
  invokeAiGeneration: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __push: jest.Mock;
};
const authContextMocks = jest.requireMock('@/services/auth-context') as {
  useAuth: jest.Mock;
};
const operationsMocks = jest.requireMock(
  '@/services/daily-operations'
) as {
  fetchDailyOperations: jest.Mock;
};
const locationMocks = jest.requireMock('@/services/location') as {
  requestCurrentLocation: jest.Mock;
};
const aiMocks = jest.requireMock('@/services/ai-drafts') as {
  invokeAiGeneration: jest.Mock;
};

const task = {
  id: 'task-1',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Periksa irigasi',
  deskripsi: 'Pastikan saluran tidak tersumbat.',
  status: 'belum_dikerjakan' as const,
  deadline: null,
  scheduledFor: '2026-07-30',
  priority: 'high' as const,
  source: 'ai' as const,
  aiReason: 'Hujan diperkirakan siang hari.',
  requiresLocation: true,
  unlockedAt: null,
  latestEvidence: null,
};

function dailyOperations(
  overrides: Partial<DailyOperations> = {}
): DailyOperations {
  return {
    scheduledFor: '2026-07-30',
    attendance: Array.from({ length: 8 }, (_, index) => {
      const present = index < 6;
      return {
        farmerId: `farmer-${index + 1}`,
        farmerName: `Petani ${index + 1}`,
        status: present ? 'present' as const : 'absent' as const,
        record: present
          ? {
              id: `attendance-${index + 1}`,
              farmerId: `farmer-${index + 1}`,
              farmerName: `Petani ${index + 1}`,
              plotId: `plot-${index + 1}`,
              plotName: `Lahan ${index + 1}`,
              attendanceDate: '2026-07-30',
              checkedInAt: '2026-07-29T22:42:00.000Z',
              distanceM: 12,
              latitude: -7.25,
              longitude: 112.76,
            }
          : null,
      };
    }),
    tasks: [
      {
        task,
        plotName: 'Sawah Utara',
        farmerName: 'Petani 1',
      },
      {
        task: { ...task, id: 'task-2', judul: 'Cek gulma' },
        plotName: 'Sawah Selatan',
        farmerName: 'Petani 2',
      },
      {
        task: { ...task, id: 'task-3', judul: 'Cek drainase' },
        plotName: 'Kebun Barat',
        farmerName: 'Petani 3',
      },
      {
        task: { ...task, id: 'task-4', judul: 'Catat pertumbuhan' },
        plotName: 'Kebun Timur',
        farmerName: 'Petani 4',
      },
    ],
    pendingDraftCount: 2,
    lastGeneration: {
      status: 'partial',
      completedAt: '2026-07-29T23:00:00.000Z',
      successCount: 2,
      skippedCount: 1,
      failedCount: 1,
    },
    weather: [{
      plotId: 'plot-1',
      plotName: 'Sawah Timur',
      observedAt: '2026-07-30T00:00:00.000Z',
      description: 'hujan ringan',
      temperatureC: 26.5,
      humidityPercent: 82,
      windSpeedMps: 0,
      rainMm: 0.4,
      forecastMinTemperatureC: 25,
      forecastMaxTemperatureC: 31,
      forecastMaxRainProbability: 0.7,
    }],
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

describe('PegawaiDashboard', () => {
  let profile = {
    id: 'internal-1',
    email: 'rina@example.com',
    nama: 'Rina',
    role: 'internal' as const,
  };
  const signOut = jest.fn();

  beforeEach(() => {
    profile = {
      id: 'internal-1',
      email: 'rina@example.com',
      nama: 'Rina',
      role: 'internal',
    };
    signOut.mockReset();
    authContextMocks.useAuth.mockImplementation(() => ({
      profile,
      signOut,
    }));
    routerMocks.__push.mockReset();
    operationsMocks.fetchDailyOperations.mockReset();
    operationsMocks.fetchDailyOperations.mockResolvedValue(dailyOperations());
    locationMocks.requestCurrentLocation.mockReset();
    aiMocks.invokeAiGeneration.mockReset();
  });

  test('renders daily metrics and routes without GPS or generation on mount', async () => {
    render(<PegawaiDashboard />);

    expect(screen.getByText('Memuat dashboard…')).toBeOnTheScreen();

    expect(await screen.findByText('6/8 Sudah absen')).toBeOnTheScreen();
    expect(screen.getByText('4 Task hari ini')).toBeOnTheScreen();
    expect(screen.getByText('2 Draft AI menunggu')).toBeOnTheScreen();
    expect(screen.getByText('✅', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('📋', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('🤖', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('🗺️', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('👨‍🌾', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('2 peringatan')).toBeOnTheScreen();
    expect(screen.getByText('Cuaca Lahan')).toBeOnTheScreen();
    expect(screen.getByText('Sawah Timur')).toBeOnTheScreen();
    expect(screen.getByText('26.5°C sekarang · hujan ringan')).toBeOnTheScreen();
    expect(screen.getByText('Update 07:00 WIB')).toBeOnTheScreen();
    expect(
      screen.getByText('Ke depan 25–31°C · peluang hujan 70%')
    ).toBeOnTheScreen();
    expect(screen.getByText('Pagi, Rina')).toBeOnTheScreen();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledWith(
      '2026-07-30'
    );
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(aiMocks.invokeAiGeneration).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Review Draft AI' }));
    fireEvent.press(screen.getByRole('button', { name: 'Operasional Harian' }));
    fireEvent.press(screen.getByRole('button', { name: 'Kelola Lahan' }));
    fireEvent.press(screen.getByRole('button', { name: 'Kelola Petani' }));

    expect(routerMocks.__push).toHaveBeenNthCalledWith(
      1,
      '/(app)/ai-tasks'
    );
    expect(routerMocks.__push).toHaveBeenNthCalledWith(
      2,
      '/(app)/daily-operations'
    );
    expect(routerMocks.__push).toHaveBeenNthCalledWith(
      3,
      '/(app)/penataan-lahan'
    );
    expect(routerMocks.__push).toHaveBeenNthCalledWith(
      4,
      '/(app)/petani-management'
    );
  });

  test('retries all daily data with safe error copy', async () => {
    operationsMocks.fetchDailyOperations
      .mockRejectedValueOnce(new Error('provider raw response and key'))
      .mockResolvedValueOnce(dailyOperations());

    render(<PegawaiDashboard />);

    expect(
      await screen.findByText('Dashboard belum tersedia')
    ).toBeOnTheScreen();
    expect(screen.queryByText(/provider raw response/i)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(await screen.findByText('6/8 Sudah absen')).toBeOnTheScreen();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(2);
    expect(operationsMocks.fetchDailyOperations).toHaveBeenNthCalledWith(
      2,
      '2026-07-30'
    );
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(aiMocks.invokeAiGeneration).not.toHaveBeenCalled();
  });

  test('ignores stale daily data after the internal profile changes', async () => {
    const stale = deferred<DailyOperations>();
    operationsMocks.fetchDailyOperations
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(
        dailyOperations({
          attendance: dailyOperations().attendance.slice(0, 2),
          tasks: [],
          pendingDraftCount: 0,
        })
      );

    const view = render(<PegawaiDashboard />);
    profile = {
      ...profile,
      id: 'internal-2',
      nama: 'Dewi',
    };
    view.rerender(<PegawaiDashboard />);

    expect(await screen.findByText('2/2 Sudah absen')).toBeOnTheScreen();
    stale.resolve(dailyOperations());

    await waitFor(() => {
      expect(screen.getByText('2/2 Sudah absen')).toBeOnTheScreen();
      expect(screen.queryByText('6/8 Sudah absen')).toBeNull();
    });
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(2);
  });

  test('does not apply a pending response after unmount', async () => {
    const pending = deferred<DailyOperations>();
    operationsMocks.fetchDailyOperations.mockReturnValueOnce(pending.promise);

    const view = render(<PegawaiDashboard />);
    await waitFor(() => {
      expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    pending.resolve(dailyOperations());

    await Promise.resolve();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(1);
  });
});
