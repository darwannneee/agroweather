import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import TaskDetailScreen from '@/app/(app)/task/[id]';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import type { CurrentLocationResult } from '@/services/location';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  let params: { id?: string | string[] } = { id: 'task-1' };

  return {
    useLocalSearchParams: () => params,
    useRouter: () => ({ back, replace }),
    __back: back,
    __replace: replace,
    __setParams: (next: typeof params) => {
      params = next;
    },
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('@/services/auth-context', () => ({
  useAuth: () => ({ profile: { id: 'farmer-1' } }),
}));

jest.mock('@/services/evidence', () => ({
  countTaskEvidence: jest.fn(),
  uploadTaskEvidence: jest.fn(),
}));

jest.mock('@/services/location', () => ({
  requestCurrentLocation: jest.fn(),
  openLocationSettings: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  fetchPlotById: jest.fn(),
}));

jest.mock('@/services/tasks', () => ({
  fetchTaskDetail: jest.fn(),
  markTaskComplete: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __setParams: (params: { id?: string | string[] }) => void;
};
const imagePickerMocks = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
  requestCameraPermissionsAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};
const evidenceMocks = jest.requireMock('@/services/evidence') as {
  countTaskEvidence: jest.Mock;
  uploadTaskEvidence: jest.Mock;
};
const locationMocks = jest.requireMock('@/services/location') as {
  requestCurrentLocation: jest.Mock;
  openLocationSettings: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlotById: jest.Mock;
};
const taskMocks = jest.requireMock('@/services/tasks') as {
  fetchTaskDetail: jest.Mock;
  markTaskComplete: jest.Mock;
};

const task: FarmTask = {
  id: 'task-1',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'staff-1',
  judul: 'Bersihkan saluran',
  deskripsi: 'Bersihkan saluran air di sisi utara.',
  status: 'belum_dikerjakan',
  deadline: null,
  requiresLocation: true,
  unlockedAt: null,
};

const plot: FarmPlot = {
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
};

function granted(
  coords = { latitude: plot.latCenter, longitude: plot.lngCenter }
): CurrentLocationResult {
  return {
    status: 'granted',
    coords,
    accuracyM: 10,
    timestamp: Date.now(),
    message: null,
    canOpenSettings: false,
  };
}

function lowAccuracy(): CurrentLocationResult {
  return {
    status: 'low-accuracy',
    coords: { latitude: plot.latCenter, longitude: plot.lngCenter },
    accuracyM: 250,
    timestamp: Date.now(),
    message: 'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.',
    canOpenSettings: false,
  };
}

async function chooseEvidence() {
  fireEvent.press(screen.getByText('Pilih Foto Bukti'));
  await waitFor(() => {
    expect(imagePickerMocks.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });
}

async function unlockTask() {
  fireEvent.press(await screen.findByRole('button', { name: 'Periksa Lokasi Task' }));
  await screen.findByText('Task siap dikerjakan');
}

describe('TaskDetailScreen', () => {
  beforeEach(() => {
    routerMocks.__setParams({ id: 'task-1' });
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockReset();
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    imagePickerMocks.launchImageLibraryAsync.mockReset();
    imagePickerMocks.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://evidence.jpg', mimeType: 'image/jpeg' }],
    });
    imagePickerMocks.requestCameraPermissionsAsync.mockReset();
    imagePickerMocks.launchCameraAsync.mockReset();
    evidenceMocks.countTaskEvidence.mockReset();
    evidenceMocks.countTaskEvidence.mockResolvedValue(0);
    evidenceMocks.uploadTaskEvidence.mockReset();
    evidenceMocks.uploadTaskEvidence.mockResolvedValue({
      id: 'evidence-1',
      path: 'farmer-1/task-1/evidence.jpg',
    });
    locationMocks.requestCurrentLocation.mockReset();
    locationMocks.openLocationSettings.mockReset();
    taskMocks.fetchTaskDetail.mockReset();
    taskMocks.fetchTaskDetail.mockResolvedValue(task);
    taskMocks.markTaskComplete.mockReset();
    taskMocks.markTaskComplete.mockResolvedValue(undefined);
    plotMocks.fetchPlotById.mockReset();
    plotMocks.fetchPlotById.mockResolvedValue(plot);
  });

  test('does not request GPS while loading task detail', async () => {
    render(<TaskDetailScreen />);

    await screen.findByRole('button', { name: 'Periksa Lokasi Task' });

    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test('requests a fresh GPS reading to unlock and another fresh reading before upload', async () => {
    const firstReading = granted();
    const secondReading = granted({ latitude: -7.2501, longitude: 112.7601 });
    locationMocks.requestCurrentLocation
      .mockResolvedValueOnce(firstReading)
      .mockResolvedValueOnce(secondReading);
    render(<TaskDetailScreen />);

    await unlockTask();
    await chooseEvidence();
    fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));

    await waitFor(() => {
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(2);
      expect(evidenceMocks.uploadTaskEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: secondReading.status === 'granted' ? secondReading.coords.latitude : null,
          lng: secondReading.status === 'granted' ? secondReading.coords.longitude : null,
        })
      );
    });
    expect(locationMocks.requestCurrentLocation).toHaveBeenNthCalledWith(1, {
      maxAccuracyM: 200,
    });
    expect(locationMocks.requestCurrentLocation).toHaveBeenNthCalledWith(2, {
      maxAccuracyM: 200,
    });
  });

  test('prevents an unlock recheck from overlapping a pending submission GPS check', async () => {
    let resolveSubmissionLocation!: (value: CurrentLocationResult) => void;
    locationMocks.requestCurrentLocation
      .mockResolvedValueOnce(granted())
      .mockImplementationOnce(
        () =>
          new Promise<CurrentLocationResult>((resolve) => {
            resolveSubmissionLocation = resolve;
          })
      );
    render(<TaskDetailScreen />);

    await unlockTask();
    await chooseEvidence();
    fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));
    await waitFor(() => {
      expect(locationMocks.requestCurrentLocation).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByRole('button', { name: 'Periksa Lagi' })).toBeNull();

    await act(async () => {
      resolveSubmissionLocation(granted());
    });
    await waitFor(() => {
      expect(evidenceMocks.uploadTaskEvidence).toHaveBeenCalledTimes(1);
    });
  });

  test('keeps the photo and note and skips upload when the second reading is outside', async () => {
    locationMocks.requestCurrentLocation
      .mockResolvedValueOnce(granted())
      .mockResolvedValueOnce(granted({ latitude: -7.5, longitude: 112.9 }));
    render(<TaskDetailScreen />);

    await unlockTask();
    await chooseEvidence();
    fireEvent.changeText(screen.getByLabelText('Catatan Bukti'), 'Saluran sudah bersih');
    fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));

    expect(await screen.findByText('Lokasi berubah. Bukti belum dikirim.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Saluran sudah bersih')).toBeOnTheScreen();
    expect(screen.getByText('Ganti Foto Bukti')).toBeOnTheScreen();
    expect(evidenceMocks.uploadTaskEvidence).not.toHaveBeenCalled();
  });

  test('keeps the photo and note and skips upload when the second reading has low accuracy', async () => {
    locationMocks.requestCurrentLocation
      .mockResolvedValueOnce(granted())
      .mockResolvedValueOnce(lowAccuracy());
    render(<TaskDetailScreen />);

    await unlockTask();
    await chooseEvidence();
    fireEvent.changeText(screen.getByLabelText('Catatan Bukti'), 'Foto pematang selesai');
    fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));

    expect(
      await screen.findByText(
        'Akurasi GPS berubah. Bukti belum dikirim; pindah ke area terbuka lalu coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Foto pematang selesai')).toBeOnTheScreen();
    expect(screen.getByText('Ganti Foto Bukti')).toBeOnTheScreen();
    expect(evidenceMocks.uploadTaskEvidence).not.toHaveBeenCalled();
  });

  test.each(['missing accuracy', 'a stale timestamp'] as const)(
    'keeps the draft and skips upload when the second reading has %s',
    async (issue) => {
      const invalidSubmissionReading = granted();
      locationMocks.requestCurrentLocation
        .mockResolvedValueOnce(granted())
        .mockResolvedValueOnce({
          ...invalidSubmissionReading,
          accuracyM:
            issue === 'missing accuracy'
              ? null
              : invalidSubmissionReading.accuracyM,
          timestamp:
            issue === 'a stale timestamp'
              ? Date.now() - 120_000
              : invalidSubmissionReading.timestamp,
        });
      render(<TaskDetailScreen />);

      await unlockTask();
      await chooseEvidence();
      fireEvent.changeText(screen.getByLabelText('Catatan Bukti'), 'Draft tetap tersimpan');
      fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));

      expect(
        await screen.findByText(
          'Akurasi GPS berubah. Bukti belum dikirim; pindah ke area terbuka lalu coba lagi.'
        )
      ).toBeOnTheScreen();
      expect(screen.getByDisplayValue('Draft tetap tersimpan')).toBeOnTheScreen();
      expect(screen.getByText('Ganti Foto Bukti')).toBeOnTheScreen();
      expect(evidenceMocks.uploadTaskEvidence).not.toHaveBeenCalled();
    }
  );

  test('shows normal submit without either GPS gate for a non-location task', async () => {
    taskMocks.fetchTaskDetail.mockResolvedValue({ ...task, requiresLocation: false });
    render(<TaskDetailScreen />);

    expect(await screen.findByRole('button', { name: 'Kirim Bukti' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Periksa Lokasi Task' })).toBeNull();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();

    await chooseEvidence();
    fireEvent.press(screen.getByRole('button', { name: 'Kirim Bukti' }));

    await waitFor(() => {
      expect(evidenceMocks.uploadTaskEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ lat: null, lng: null })
      );
    });
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test.each(['missing accuracy', 'a stale timestamp'] as const)(
    'blocks an unlock reading with %s before the geofence check',
    async (issue) => {
      const invalidUnlockReading = granted();
      locationMocks.requestCurrentLocation.mockResolvedValueOnce({
        ...invalidUnlockReading,
        accuracyM:
          issue === 'missing accuracy' ? null : invalidUnlockReading.accuracyM,
        timestamp:
          issue === 'a stale timestamp'
            ? Date.now() - 120_000
            : invalidUnlockReading.timestamp,
      });
      render(<TaskDetailScreen />);

      fireEvent.press(await screen.findByRole('button', { name: 'Periksa Lokasi Task' }));

      expect(
        await screen.findByText(
          'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.'
        )
      ).toBeOnTheScreen();
      expect(screen.queryByText('Pilih Foto Bukti')).toBeNull();
    }
  );

  test('opens app settings from a blocked location action', async () => {
    locationMocks.requestCurrentLocation.mockResolvedValueOnce({
      status: 'permission-blocked',
      coords: null,
      accuracyM: null,
      timestamp: null,
      message: 'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
      canOpenSettings: true,
    });
    render(<TaskDetailScreen />);

    fireEvent.press(await screen.findByRole('button', { name: 'Periksa Lokasi Task' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Buka Pengaturan' }));

    expect(locationMocks.openLocationSettings).toHaveBeenCalledTimes(1);
  });

  test('ignores a stale detail response after the route changes', async () => {
    let resolveFirst!: (value: FarmTask) => void;
    taskMocks.fetchTaskDetail
      .mockImplementationOnce(
        () => new Promise<FarmTask>((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce({
        ...task,
        id: 'task-2',
        judul: 'Periksa pompa',
      });
    const view = render(<TaskDetailScreen />);

    routerMocks.__setParams({ id: 'task-2' });
    view.rerender(<TaskDetailScreen />);
    expect(await screen.findByText('Periksa pompa')).toBeOnTheScreen();

    await act(async () => {
      resolveFirst(task);
    });
    await waitFor(() => {
      expect(plotMocks.fetchPlotById).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('Bersihkan saluran')).toBeNull();
  });

  test('does not show the AI placeholder card in the active workflow', async () => {
    render(<TaskDetailScreen />);

    await screen.findByText(task.judul);

    expect(screen.queryByText('Analisis AI MVP')).toBeNull();
  });
});
