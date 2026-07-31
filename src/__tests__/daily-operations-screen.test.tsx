import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import {
  DailyOperationsScreen,
} from '@/app/(app)/daily-operations';
import type { FarmTask } from '@/lib/farm-types';
import type { DailyOperations } from '@/services/daily-operations';

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

jest.mock('@/services/daily-operations', () => ({
  fetchDailyOperations: jest.fn(),
}));

jest.mock('@/services/auth-context', () => ({
  useAuth: jest.fn(),
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

const baseTask: FarmTask = {
  id: 'task-new',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Task belum dimulai',
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
};

function operations(
  overrides: Partial<DailyOperations> = {}
): DailyOperations {
  return {
    scheduledFor: '2026-07-30',
    attendance: [
      {
        farmerId: 'farmer-1',
        farmerName: 'Sari',
        status: 'present',
        record: {
          id: 'attendance-1',
          farmerId: 'farmer-1',
          farmerName: 'Sari',
          plotId: 'plot-1',
          plotName: 'Sawah Utara',
          attendanceDate: '2026-07-30',
          checkedInAt: '2026-07-29T22:42:00.000Z',
          distanceM: 12.4,
          latitude: -7.25,
          longitude: 112.76,
        },
      },
      {
        farmerId: 'farmer-2',
        farmerName: 'Budi',
        status: 'absent',
        record: null,
      },
    ],
    tasks: [
      {
        task: baseTask,
        plotName: 'Sawah Utara',
        farmerName: 'Sari',
      },
      {
        task: {
          ...baseTask,
          id: 'task-pending',
          judul: 'Task menunggu review',
          status: 'sedang_dikerjakan',
          latestEvidence: { status: 'pending', reviewNote: null },
        },
        plotName: 'Sawah Selatan',
        farmerName: 'Budi',
      },
      {
        task: {
          ...baseTask,
          id: 'task-revision',
          judul: 'Task perlu perbaikan',
          status: 'sedang_dikerjakan',
          latestEvidence: {
            status: 'revision_requested',
            reviewNote: 'Foto kurang terang.',
          },
        },
        plotName: 'Kebun Barat',
        farmerName: 'Sari',
      },
      {
        task: {
          ...baseTask,
          id: 'task-done',
          judul: 'Task selesai',
          status: 'selesai',
          latestEvidence: { status: 'accepted', reviewNote: null },
        },
        plotName: 'Kebun Timur',
        farmerName: 'Budi',
      },
    ],
    pendingDraftCount: 1,
    lastGeneration: null,
    ...overrides,
  };
}

describe('DailyOperationsScreen', () => {
  beforeEach(() => {
    routerMocks.__push.mockReset();
    operationsMocks.fetchDailyOperations.mockReset();
    operationsMocks.fetchDailyOperations.mockResolvedValue(operations());
    locationMocks.requestCurrentLocation.mockReset();
    aiMocks.invokeAiGeneration.mockReset();
  });

  test('reads database state on mount without GPS or AI generation', async () => {
    render(<DailyOperationsScreen />);

    expect(screen.getByText('Memuat operasional…')).toBeOnTheScreen();
    expect(await screen.findByText('Sari')).toBeOnTheScreen();
    expect(screen.getByText('Budi')).toBeOnTheScreen();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledWith(
      '2026-07-30'
    );
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(aiMocks.invokeAiGeneration).not.toHaveBeenCalled();
  });

  test('opens present attendance detail while absent attendance stays static', async () => {
    render(<DailyOperationsScreen />);

    const presentAction = await screen.findByRole('button', {
      name: /Buka detail kehadiran Sari/i,
    });
    expect(
      screen.queryByRole('button', { name: /Buka detail kehadiran Budi/i })
    ).toBeNull();

    fireEvent.press(presentAction);

    expect(screen.getByText('Detail Kehadiran Sari')).toBeOnTheScreen();
    expect(screen.getAllByText('Lahan: Sawah Utara')).toHaveLength(2);
    expect(screen.getByText('Waktu masuk: 05:42 WIB')).toBeOnTheScreen();
    expect(screen.getByText('Jarak: 12 meter')).toBeOnTheScreen();
    expect(
      screen.getByText('Koordinat: -7.250000, 112.760000')
    ).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('button', { name: 'Tutup detail absensi' })
    );
    expect(screen.queryByText('Detail Kehadiran Sari')).toBeNull();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(1);
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test('filters tasks by operational status and opens internal review', async () => {
    render(<DailyOperationsScreen />);

    expect(
      await screen.findByText('Task belum dimulai')
    ).toBeOnTheScreen();
    expect(screen.getByText('Task menunggu review')).toBeOnTheScreen();
    expect(screen.getByText('Task perlu perbaikan')).toBeOnTheScreen();
    expect(screen.getByText('Task selesai')).toBeOnTheScreen();

    fireEvent.press(
      screen.getAllByRole('button', { name: 'Menunggu review' })[0]
    );
    expect(screen.getByText('Task menunggu review')).toBeOnTheScreen();
    expect(screen.queryByText('Task belum dimulai')).toBeNull();
    expect(screen.queryByText('Task perlu perbaikan')).toBeNull();
    expect(screen.queryByText('Task selesai')).toBeNull();

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Buka tugas Task menunggu review',
      })
    );
    expect(routerMocks.__push).toHaveBeenCalledWith(
      '/(app)/task-review/task-pending'
    );
  });

  test('keeps available sections visible when another section is empty', async () => {
    operationsMocks.fetchDailyOperations.mockResolvedValueOnce(
      operations({ tasks: [] })
    );

    render(<DailyOperationsScreen />);

    expect(await screen.findByText('Sari')).toBeOnTheScreen();
    expect(screen.getByText('Belum ada task hari ini')).toBeOnTheScreen();
    expect(screen.queryByText('Belum ada data absensi')).toBeNull();
  });

  test('renders a complete empty state without provider details', async () => {
    operationsMocks.fetchDailyOperations.mockResolvedValueOnce(
      operations({ attendance: [], tasks: [] })
    );

    render(<DailyOperationsScreen />);

    expect(
      await screen.findByText('Belum ada data absensi')
    ).toBeOnTheScreen();
    expect(screen.getByText('Belum ada task hari ini')).toBeOnTheScreen();
    expect(screen.queryByText(/OpenWeather|OpenRouter|provider/i)).toBeNull();
  });

  test('shows safe error copy and retries without requesting GPS', async () => {
    operationsMocks.fetchDailyOperations
      .mockRejectedValueOnce(new Error('OPENWEATHER_KEY raw provider body'))
      .mockResolvedValueOnce(operations());

    render(<DailyOperationsScreen />);

    expect(
      await screen.findByText('Operasional belum tersedia')
    ).toBeOnTheScreen();
    expect(screen.queryByText(/OPENWEATHER_KEY|provider body/i)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(await screen.findByText('Sari')).toBeOnTheScreen();
    expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(2);
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    expect(aiMocks.invokeAiGeneration).not.toHaveBeenCalled();
  });

  test('ignores a late response after unmount', async () => {
    let resolve!: (value: DailyOperations) => void;
    operationsMocks.fetchDailyOperations.mockReturnValueOnce(
      new Promise<DailyOperations>((resolvePromise) => {
        resolve = resolvePromise;
      })
    );

    const view = render(<DailyOperationsScreen />);
    view.unmount();
    resolve(operations());

    await waitFor(() => {
      expect(operationsMocks.fetchDailyOperations).toHaveBeenCalledTimes(1);
    });
  });
});
