import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import { TaskReviewScreen } from '@/app/(app)/task-review/[id]';
import type {
  EvidenceAttempt,
  FarmPlot,
  FarmTask,
} from '@/lib/farm-types';
import type { AppUser } from '@/services/supabase';

jest.mock('expo-router', () => {
  let params: { id?: string | string[] } = { id: 'task-1' };
  return {
    useLocalSearchParams: () => params,
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

jest.mock('@/services/auth', () => ({
  fetchUserProfile: jest.fn(),
}));

jest.mock('@/services/evidence', () => ({
  fetchTaskEvidenceAttempts: jest.fn(),
  reviewTaskEvidence: jest.fn(),
}));

jest.mock('@/services/location', () => ({
  requestCurrentLocation: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  fetchPlotById: jest.fn(),
}));

jest.mock('@/services/tasks', () => ({
  fetchTaskDetail: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __setParams: (params: { id?: string | string[] }) => void;
};
const authMocks = jest.requireMock('@/services/auth') as {
  fetchUserProfile: jest.Mock;
};
const evidenceMocks = jest.requireMock('@/services/evidence') as {
  fetchTaskEvidenceAttempts: jest.Mock;
  reviewTaskEvidence: jest.Mock;
};
const locationMocks = jest.requireMock('@/services/location') as {
  requestCurrentLocation: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlotById: jest.Mock;
};
const taskMocks = jest.requireMock('@/services/tasks') as {
  fetchTaskDetail: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert');

const task: FarmTask = {
  id: 'task-1',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'staff-1',
  judul: 'Periksa irigasi utara',
  deskripsi: 'Bersihkan sumbatan lalu dokumentasikan kondisi saluran.',
  status: 'sedang_dikerjakan',
  deadline: null,
  scheduledFor: '2026-07-30',
  priority: 'high',
  source: 'ai',
  aiReason: 'Hujan diperkirakan meningkat pada siang hari.',
  requiresLocation: true,
  unlockedAt: '2026-07-30T00:30:00.000Z',
  latestEvidence: { status: 'pending', reviewNote: null },
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

const farmer: AppUser = {
  id: 'farmer-1',
  nama: 'Sari',
  email: 'sari@example.com',
  role: 'farmer',
};

function makeAttempt(
  overrides: Partial<EvidenceAttempt> &
    Pick<EvidenceAttempt, 'id' | 'attemptNumber'>
): EvidenceAttempt {
  const { id, attemptNumber, ...rest } = overrides;
  return {
    id,
    taskId: 'task-1',
    attemptNumber,
    photoPath: `farmer-1/task-1/${id}.jpg`,
    photoUrl: `https://signed.example/${id}`,
    note: 'Saluran sudah dibersihkan.',
    latitude: -7.25,
    longitude: 112.76,
    status: 'revision_requested',
    reviewNote: 'Foto pertama kurang jelas.',
    reviewedAt: '2026-07-30T01:30:00.000Z',
    createdAt: '2026-07-30T01:00:00.000Z',
    ...rest,
  };
}

const attempts: EvidenceAttempt[] = [
  makeAttempt({ id: 'evidence-1', attemptNumber: 1 }),
  makeAttempt({
    id: 'evidence-2',
    attemptNumber: 2,
    note: 'Foto ulang dari sisi saluran.',
    latitude: -7.23,
    status: 'pending',
    reviewNote: null,
    reviewedAt: null,
    createdAt: '2026-07-30T02:15:00.000Z',
  }),
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function renderLoaded() {
  render(<TaskReviewScreen />);
  await screen.findByText('Periksa irigasi utara');
}

function confirmLatestAlert(label: string) {
  const actions = alertSpy.mock.calls.at(-1)?.[2];
  const action = actions?.find((item) => item.text === label);
  act(() => {
    action?.onPress?.();
  });
}

describe('TaskReviewScreen', () => {
  beforeEach(() => {
    routerMocks.__setParams({ id: 'task-1' });
    alertSpy.mockClear();
    authMocks.fetchUserProfile.mockReset();
    authMocks.fetchUserProfile.mockResolvedValue(farmer);
    evidenceMocks.fetchTaskEvidenceAttempts.mockReset();
    evidenceMocks.fetchTaskEvidenceAttempts.mockResolvedValue(attempts);
    evidenceMocks.reviewTaskEvidence.mockReset();
    evidenceMocks.reviewTaskEvidence.mockResolvedValue(undefined);
    locationMocks.requestCurrentLocation.mockReset();
    plotMocks.fetchPlotById.mockReset();
    plotMocks.fetchPlotById.mockResolvedValue(plot);
    taskMocks.fetchTaskDetail.mockReset();
    taskMocks.fetchTaskDetail.mockResolvedValue(task);
  });

  test('renders internal task, plot, assignee, instructions, AI reason, priority, and date', async () => {
    await renderLoaded();

    expect(screen.getByText('Lahan: Sawah Utara')).toBeOnTheScreen();
    expect(screen.getByText('Petani: Sari')).toBeOnTheScreen();
    expect(screen.getByText('Prioritas: tinggi')).toBeOnTheScreen();
    expect(screen.getByText('Jadwal: 2026-07-30')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Instruksi: Bersihkan sumbatan lalu dokumentasikan kondisi saluran.'
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Alasan AI: Hujan diperkirakan meningkat pada siang hari.'
      )
    ).toBeOnTheScreen();
    expect(screen.getByText('Bukti lokasi: Wajib')).toBeOnTheScreen();
  });

  test('renders immutable evidence attempts oldest-first with signed images, notes, GPS context, and Jakarta time', async () => {
    await renderLoaded();

    const attemptHeadings = screen.getAllByText(/^Percobaan [12]$/);
    expect(
      attemptHeadings.map(({ props }) =>
        Array.isArray(props.children)
          ? props.children.join('')
          : props.children
      )
    ).toEqual(['Percobaan 1', 'Percobaan 2']);
    expect(
      screen.getByLabelText('Foto bukti percobaan 1')
    ).toHaveProp('source', { uri: 'https://signed.example/evidence-1' });
    expect(
      screen.getByLabelText('Foto bukti percobaan 2')
    ).toHaveProp('source', { uri: 'https://signed.example/evidence-2' });
    expect(
      screen.getByText('Catatan petani: Saluran sudah dibersihkan.')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Catatan petani: Foto ulang dari sisi saluran.')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Koordinat: -7.250000, 112.760000')
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Jarak ke titik lahan: 0 meter · Di dalam radius 1000 meter'
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        /Jarak ke titik lahan: [0-9]+ meter · Di luar radius 1000 meter/
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Waktu kirim: 30/07/2026 08.00 WIB')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Waktu kirim: 30/07/2026 09.15 WIB')
    ).toBeOnTheScreen();
  });

  test('shows missing location without requesting device GPS', async () => {
    evidenceMocks.fetchTaskEvidenceAttempts.mockResolvedValue([
      makeAttempt({
        id: 'evidence-no-location',
        attemptNumber: 1,
        latitude: null,
        longitude: null,
        status: 'pending',
        reviewNote: null,
      }),
    ]);

    await renderLoaded();

    expect(screen.getByText('Lokasi tidak tersedia')).toBeOnTheScreen();
    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
  });

  test('exposes review actions only for the latest pending attempt and accepts it after confirmation', async () => {
    evidenceMocks.fetchTaskEvidenceAttempts
      .mockResolvedValueOnce(attempts)
      .mockResolvedValueOnce([
        attempts[0],
        { ...attempts[1], status: 'accepted', reviewedAt: '2026-07-30T02:30:00.000Z' },
      ]);
    await renderLoaded();

    expect(
      screen.getAllByRole('button', { name: 'Terima Bukti' })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Minta Perbaikan' })
    ).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Terima Bukti' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Terima bukti?',
      'Percobaan 2 akan diterima dan task ditandai selesai.',
      expect.any(Array)
    );
    confirmLatestAlert('Terima');

    await waitFor(() => {
      expect(evidenceMocks.reviewTaskEvidence).toHaveBeenCalledWith(
        'evidence-2',
        'accepted',
        null
      );
    });
    expect(await screen.findByText('Bukti diterima.')).toBeOnTheScreen();
    expect(screen.getByText('Percobaan 1')).toBeOnTheScreen();
    expect(screen.getByText('Percobaan 2')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Terima Bukti' })).toBeNull();
  });

  test('requires a review note before requesting revision', async () => {
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', { name: 'Minta Perbaikan' })
    );
    expect(
      screen.getByText('Catatan perbaikan wajib diisi.')
    ).toBeOnTheScreen();
    expect(evidenceMocks.reviewTaskEvidence).not.toHaveBeenCalled();

    fireEvent.changeText(
      screen.getByLabelText('Catatan perbaikan'),
      'Ambil ulang foto lebih dekat ke saluran.'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Minta Perbaikan' })
    );

    await waitFor(() => {
      expect(evidenceMocks.reviewTaskEvidence).toHaveBeenCalledWith(
        'evidence-2',
        'revision_requested',
        'Ambil ulang foto lebih dekat ke saluran.'
      );
    });
  });

  test('renders grandfathered completion without evidence as read-only history', async () => {
    taskMocks.fetchTaskDetail.mockResolvedValue({
      ...task,
      status: 'selesai',
      latestEvidence: null,
    });
    evidenceMocks.fetchTaskEvidenceAttempts.mockResolvedValue([]);

    await renderLoaded();

    expect(
      screen.getByText('Diselesaikan sebelum alur review bukti')
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Terima Bukti' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Minta Perbaikan' })
    ).toBeNull();
  });

  test('serializes overlapping review confirmations and disables both actions', async () => {
    const pending = deferred<void>();
    evidenceMocks.reviewTaskEvidence.mockReturnValue(pending.promise);
    await renderLoaded();

    fireEvent.press(screen.getByRole('button', { name: 'Terima Bukti' }));
    const actions = alertSpy.mock.calls.at(-1)?.[2];
    const confirm = actions?.find((item) => item.text === 'Terima');
    act(() => {
      confirm?.onPress?.();
      confirm?.onPress?.();
    });

    expect(evidenceMocks.reviewTaskEvidence).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Terima Bukti' })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ busy: true, disabled: true })
    );
    expect(
      screen.getByRole('button', { name: 'Minta Perbaikan' })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true })
    );

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
  });

  test('sanitizes load and review errors', async () => {
    const rawLoadError = 'tasks relation private detail';
    taskMocks.fetchTaskDetail.mockRejectedValueOnce(new Error(rawLoadError));
    render(<TaskReviewScreen />);

    expect(
      await screen.findByText(
        'Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawLoadError)).toBeNull();

    const rawReviewError = 'review rpc private transaction detail';
    taskMocks.fetchTaskDetail.mockResolvedValue(task);
    evidenceMocks.reviewTaskEvidence.mockRejectedValue(
      new Error(rawReviewError)
    );
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));
    await screen.findByRole('button', { name: 'Terima Bukti' });
    fireEvent.press(screen.getByRole('button', { name: 'Terima Bukti' }));
    confirmLatestAlert('Terima');

    expect(
      await screen.findByText(
        'Keputusan bukti belum dapat disimpan. Silakan coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawReviewError)).toBeNull();
  });

  test('does not request GPS, weather, AI providers, or direct network access', async () => {
    await renderLoaded();

    expect(locationMocks.requestCurrentLocation).not.toHaveBeenCalled();
    const source = readFileSync(
      path.join(process.cwd(), 'src/app/(app)/task-review/[id].tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/requestCurrentLocation|expo-location/);
    expect(source).not.toMatch(/OPENWEATHER|OPENROUTER|EXPO_PUBLIC_[A-Z0-9_]*KEY/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
