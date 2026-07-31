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

import { AiTasksScreen } from '@/app/(app)/ai-tasks';
import type { AiTaskDraft, FarmPlot } from '@/lib/farm-types';
import type { GenerationInvocationResult } from '@/services/ai-drafts';
import type { AppUser } from '@/services/supabase';

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

jest.mock('@/lib/daily-operations', () => ({
  jakartaDate: () => '2026-07-30',
}));

jest.mock('@/services/ai-drafts', () => ({
  approveAiDrafts: jest.fn(),
  fetchAiDrafts: jest.fn(),
  fetchLatestAiGenerationLog: jest.fn(),
  invokeAiGeneration: jest.fn(),
}));

jest.mock('@/services/auth', () => ({
  fetchFarmers: jest.fn(),
}));

jest.mock('@/services/plots', () => ({
  fetchPlots: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __push: jest.Mock;
};
const draftMocks = jest.requireMock('@/services/ai-drafts') as {
  approveAiDrafts: jest.Mock;
  fetchAiDrafts: jest.Mock;
  fetchLatestAiGenerationLog: jest.Mock;
  invokeAiGeneration: jest.Mock;
};
const authMocks = jest.requireMock('@/services/auth') as {
  fetchFarmers: jest.Mock;
};
const plotMocks = jest.requireMock('@/services/plots') as {
  fetchPlots: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert');

const farmers: AppUser[] = [
  {
    id: 'farmer-1',
    nama: 'Petani Satu',
    email: 'satu@example.com',
    role: 'farmer',
  },
  {
    id: 'farmer-2',
    nama: 'Petani Dua',
    email: 'dua@example.com',
    role: 'farmer',
  },
];

const plots: FarmPlot[] = [
  {
    id: 'plot-1',
    namaLahan: 'Sawah Utara',
    farmerId: 'farmer-1',
    farmerName: 'Petani Satu',
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
    farmerId: 'farmer-2',
    farmerName: 'Petani Dua',
    luasHektar: 1.5,
    jenisTanaman: 'Jagung',
    faseLahan: 'Tanam',
    latCenter: -7.26,
    lngCenter: 112.77,
    radiusGeofenceM: 700,
    status: 'aktif',
  },
  {
    id: 'plot-3',
    namaLahan: 'Sawah Tanpa Petani',
    farmerId: null,
    farmerName: null,
    luasHektar: 1,
    jenisTanaman: 'Padi',
    faseLahan: 'Tanam',
    latCenter: -7.27,
    lngCenter: 112.78,
    radiusGeofenceM: 500,
    status: 'aktif',
  },
  {
    id: 'plot-4',
    namaLahan: 'Sawah Nonaktif',
    farmerId: 'farmer-1',
    farmerName: 'Petani Satu',
    luasHektar: 1,
    jenisTanaman: 'Padi',
    faseLahan: 'Panen',
    latCenter: -7.28,
    lngCenter: 112.79,
    radiusGeofenceM: 500,
    status: 'tidak aktif',
  },
];

function makeDraft(
  overrides: Partial<AiTaskDraft> & Pick<AiTaskDraft, 'id' | 'title'>
): AiTaskDraft {
  const { id, title, ...rest } = overrides;
  return {
    id,
    plotId: 'plot-1',
    plotName: 'Sawah Utara',
    proposedAssigneeId: 'farmer-1',
    proposedAssigneeName: 'Petani Satu',
    scheduledFor: '2026-07-30',
    title,
    description: 'Periksa saluran dan catat kondisi lahan hari ini.',
    priority: 'high',
    requiresLocation: true,
    aiReason: 'Hujan diperkirakan turun siang ini.',
    status: 'pending',
    model: 'provider/model-private',
    weather: {
      observedAt: '2026-07-29T21:00:00.000Z',
      description: 'hujan ringan',
      temperatureC: 28,
      humidityPercent: 80,
      windSpeedMps: 2,
      rainMm: 0.4,
      forecastMinTemperatureC: 25,
      forecastMaxTemperatureC: 31,
      forecastMaxRainProbability: 0.8,
    },
    createdAt: '2026-07-29T22:00:00.000Z',
    ...rest,
  };
}

const drafts: AiTaskDraft[] = [
  makeDraft({ id: 'draft-1', title: 'Periksa irigasi utara' }),
  makeDraft({
    id: 'draft-2',
    title: 'Cek pertumbuhan jagung',
    plotId: 'plot-2',
    plotName: 'Sawah Selatan',
    proposedAssigneeId: 'farmer-2',
    proposedAssigneeName: 'Petani Dua',
    priority: 'low',
  }),
  makeDraft({
    id: 'draft-3',
    title: 'Amankan pematang utara',
    proposedAssigneeId: 'farmer-2',
    proposedAssigneeName: 'Petani Dua',
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
  render(<AiTasksScreen />);
  await screen.findByText('Periksa irigasi utara');
}

function selectPlot(name = 'Sawah Utara') {
  fireEvent.press(
    screen.getByRole('button', { name: `Pilih lahan ${name}` })
  );
}

function generationResult(
  overrides: Partial<GenerationInvocationResult> & { draftCount?: number }
): GenerationInvocationResult {
  return {
    runId: 'run-1',
    status: 'succeeded',
    successCount: 2,
    skippedCount: 0,
    failedCount: 0,
    draftCount: 2,
    warnings: [],
    ...overrides,
  } as GenerationInvocationResult;
}

describe('AiTasksScreen', () => {
  beforeEach(() => {
    routerMocks.__push.mockReset();
    alertSpy.mockClear();
    draftMocks.approveAiDrafts.mockReset();
    draftMocks.approveAiDrafts.mockResolvedValue(['task-1', 'task-2']);
    draftMocks.fetchAiDrafts.mockReset();
    draftMocks.fetchAiDrafts.mockResolvedValue(drafts);
    draftMocks.fetchLatestAiGenerationLog.mockReset();
    draftMocks.fetchLatestAiGenerationLog.mockResolvedValue(null);
    draftMocks.invokeAiGeneration.mockReset();
    draftMocks.invokeAiGeneration.mockResolvedValue(generationResult({}));
    authMocks.fetchFarmers.mockReset();
    authMocks.fetchFarmers.mockResolvedValue(farmers);
    plotMocks.fetchPlots.mockReset();
    plotMocks.fetchPlots.mockResolvedValue(plots);
  });

  test('loads pending drafts for the Jakarta operational date', async () => {
    await renderLoaded();

    expect(draftMocks.fetchAiDrafts).toHaveBeenCalledWith({
      scheduledFor: '2026-07-30',
      status: 'pending',
    });
    expect(screen.getByText('Cek pertumbuhan jagung')).toBeOnTheScreen();
  });

  test('loads the latest persisted generation log on entry', async () => {
    draftMocks.fetchLatestAiGenerationLog.mockResolvedValue({
      runId: 'run-latest',
      trigger: 'manual',
      scheduledFor: '2026-07-30',
      status: 'succeeded',
      model: 'provider/model',
      plotCount: 1,
      successCount: 1,
      skippedCount: 0,
      failedCount: 0,
      draftCount: 0,
      warnings: [],
      startedAt: '2026-07-29T22:00:00.000Z',
      completedAt: '2026-07-29T22:00:02.000Z',
      targets: [{
        id: 'target-1',
        plotId: 'plot-1',
        plotName: 'Sawah Utara',
        status: 'succeeded',
        draftCount: 0,
        errorCode: null,
        summary: 'Tidak ada pekerjaan aman hari ini.',
        isCurrent: true,
        version: 1,
        createdAt: '2026-07-29T22:00:01.000Z',
        completedAt: '2026-07-29T22:00:02.000Z',
      }],
    });

    await renderLoaded();

    expect(await screen.findByText('Log Generasi Terakhir')).toBeOnTheScreen();
    expect(screen.getByText('Run ID: run-latest')).toBeOnTheScreen();
    expect(screen.getByText('Draft pending dibuat: 0')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Sawah Utara: sukses, 0 draft. Ringkasan: Tidak ada pekerjaan aman hari ini.'
      )
    ).toBeOnTheScreen();
  });

  test('offers only active assigned plots for accessible explicit selection', async () => {
    await renderLoaded();

    const assignedPlot = screen.getByRole('button', {
      name: 'Pilih lahan Sawah Utara',
    });
    expect(assignedPlot).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false })
    );

    fireEvent.press(assignedPlot);

    expect(assignedPlot).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true })
    );
    expect(
      screen.getByRole('button', { name: 'Pilih lahan Sawah Selatan' })
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Pilih lahan Sawah Tanpa Petani' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Pilih lahan Sawah Nonaktif' })
    ).toBeNull();
    expect(
      screen.getByText(
        '1 lahan aktif belum memiliki petani dan tidak dapat dipilih.'
      )
    ).toBeOnTheScreen();
  });

  test('never generates without a selected plot and shows controlled validation', async () => {
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', { name: 'Generate Task AI' })
    );

    expect(draftMocks.invokeAiGeneration).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Pilih minimal satu lahan aktif yang sudah memiliki petani.'
      )
    ).toBeOnTheScreen();
  });

  test('generates only after an explicit press and serializes repeated presses', async () => {
    const pending = deferred<GenerationInvocationResult>();
    draftMocks.invokeAiGeneration.mockReturnValue(pending.promise);
    await renderLoaded();

    expect(draftMocks.invokeAiGeneration).not.toHaveBeenCalled();
    selectPlot();
    const button = screen.getByRole('button', { name: 'Generate Task AI' });
    fireEvent.press(button);
    fireEvent.press(button);

    expect(draftMocks.invokeAiGeneration).toHaveBeenCalledTimes(1);
    expect(draftMocks.invokeAiGeneration).toHaveBeenCalledWith(['plot-1']);
    expect(button).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true, busy: true })
    );

    await act(async () => {
      pending.resolve(generationResult({}));
      await pending.promise;
    });
  });

  test.each([
    [
      generationResult({ status: 'succeeded', successCount: 2 }),
      'Generasi selesai: 2 draft pending dibuat dari 2 lahan.',
    ],
    [
      generationResult({
        status: 'succeeded',
        successCount: 1,
        draftCount: 0,
      }),
      'Generasi selesai tanpa draft pending: 1 lahan diproses, tetapi AI menghasilkan 0 draft.',
    ],
    [
      generationResult({
        status: 'partial',
        successCount: 1,
        skippedCount: 1,
        failedCount: 1,
        draftCount: 1,
        warnings: [{ plotId: 'plot-2', code: 'model_error' }],
      }),
      'Generasi selesai sebagian: 1 draft pending dibuat, 1 lahan dilewati, 1 lahan gagal.',
    ],
    [
      generationResult({
        status: 'failed',
        successCount: 0,
        failedCount: 2,
      }),
      'Generasi gagal: belum ada draft yang dibuat.',
    ],
  ])(
    'shows safe result copy for %s generation',
    async (result, expectedCopy) => {
      draftMocks.invokeAiGeneration.mockResolvedValue(result);
      await renderLoaded();
      selectPlot();

      fireEvent.press(
        screen.getByRole('button', { name: 'Generate Task AI' })
      );

      expect(await screen.findByText(expectedCopy)).toBeOnTheScreen();
      if (result.warnings.length > 0) {
        expect(
          screen.getByText('1 lahan menghasilkan peringatan dan perlu diperiksa.')
        ).toBeOnTheScreen();
      }
      expect(screen.queryByText('model_error')).toBeNull();
    }
  );

  test('shows generation log details when a successful run creates zero pending drafts', async () => {
    draftMocks.fetchAiDrafts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    draftMocks.invokeAiGeneration.mockResolvedValue(
      generationResult({
        status: 'succeeded',
        successCount: 1,
        draftCount: 0,
        warnings: [],
      })
    );
    render(<AiTasksScreen />);
    await screen.findByText('Belum ada draft pending');
    selectPlot();

    fireEvent.press(
      screen.getByRole('button', { name: 'Generate Task AI' })
    );

    expect(
      await screen.findByText(
        'Generasi selesai tanpa draft pending: 1 lahan diproses, tetapi AI menghasilkan 0 draft.'
      )
    ).toBeOnTheScreen();
    expect(screen.getByText('Log Generasi Terakhir')).toBeOnTheScreen();
    expect(screen.getByText('Run ID: run-1')).toBeOnTheScreen();
    expect(screen.getByText('Draft pending dibuat: 0')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Tidak ada warning teknis. AI bisa saja mengembalikan 0 task karena menilai belum ada pekerjaan aman atau urgent untuk hari ini.'
      )
    ).toBeOnTheScreen();
  });

  test('shows per-plot warning details after generation', async () => {
    draftMocks.invokeAiGeneration.mockResolvedValue(
      generationResult({
        status: 'partial',
        successCount: 0,
        failedCount: 1,
        draftCount: 0,
        warnings: [{ plotId: 'plot-1', code: 'model_error' }],
      })
    );
    await renderLoaded();
    selectPlot();

    fireEvent.press(
      screen.getByRole('button', { name: 'Generate Task AI' })
    );

    expect(
      await screen.findByText(
        'Sawah Utara: OpenRouter gagal membuat draft. Kode: model_error'
      )
    ).toBeOnTheScreen();
  });

  test('logs the UI boundary when generation fails before run log exists', async () => {
    const error = new Error('network unavailable');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    draftMocks.invokeAiGeneration.mockRejectedValue(error);
    await renderLoaded();
    selectPlot();

    try {
      fireEvent.press(
        screen.getByRole('button', { name: 'Generate Task AI' })
      );

      expect(
        await screen.findByText(
          'Generasi Task AI belum dapat dijalankan. Silakan coba lagi.'
        )
      ).toBeOnTheScreen();
      expect(
        screen.getByText('Request generate gagal sebelum log run tersimpan.')
      ).toBeOnTheScreen();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AgroWeather] AI generation screen failed',
        expect.objectContaining({
          stage: 'screen_generate',
          plotCount: 1,
          message: 'network unavailable',
        })
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('reloads pending drafts after generation completes', async () => {
    draftMocks.fetchAiDrafts
      .mockResolvedValueOnce(drafts)
      .mockResolvedValueOnce([
        ...drafts,
        makeDraft({ id: 'draft-4', title: 'Draft hasil terbaru' }),
      ]);
    await renderLoaded();
    selectPlot();

    fireEvent.press(
      screen.getByRole('button', { name: 'Generate Task AI' })
    );

    expect(await screen.findByText('Draft hasil terbaru')).toBeOnTheScreen();
    expect(draftMocks.fetchAiDrafts).toHaveBeenCalledTimes(2);
  });

  test('composes plot, farmer, and priority filters without mutating source drafts', async () => {
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', { name: 'Filter lahan Sawah Utara' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Filter petani Petani Dua' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Filter prioritas tinggi' })
    );

    expect(screen.getByText('Amankan pematang utara')).toBeOnTheScreen();
    expect(screen.queryByText('Periksa irigasi utara')).toBeNull();
    expect(screen.queryByText('Cek pertumbuhan jagung')).toBeNull();

    fireEvent.press(
      screen.getByRole('button', { name: 'Reset semua filter' })
    );

    expect(screen.getByText('Periksa irigasi utara')).toBeOnTheScreen();
    expect(screen.getByText('Cek pertumbuhan jagung')).toBeOnTheScreen();
    expect(screen.getByText('Amankan pematang utara')).toBeOnTheScreen();
  });

  test('confirms exact selection and invokes one transactional bulk approval', async () => {
    const pending = deferred<string[]>();
    draftMocks.approveAiDrafts.mockReturnValue(pending.promise);
    await renderLoaded();
    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih draft Periksa irigasi utara' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih draft Cek pertumbuhan jagung' })
    );

    const bulkButton = screen.getByRole('button', {
      name: 'Setujui Terpilih',
    });
    fireEvent.press(bulkButton);

    expect(alertSpy).toHaveBeenCalledWith(
      'Setujui 2 draft?',
      'Semua draft terpilih akan dibuat menjadi task dalam satu transaksi.',
      expect.any(Array)
    );

    const actions = alertSpy.mock.calls.at(-1)?.[2];
    const confirm = actions?.find((action) => action.text === 'Setujui');
    act(() => {
      confirm?.onPress?.();
      confirm?.onPress?.();
    });

    expect(draftMocks.approveAiDrafts).toHaveBeenCalledTimes(1);
    expect(draftMocks.approveAiDrafts).toHaveBeenCalledWith([
      'draft-1',
      'draft-2',
    ]);
    await waitFor(() => {
      expect(bulkButton).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ disabled: true, busy: true })
      );
    });

    await act(async () => {
      pending.resolve(['task-1', 'task-2']);
      await pending.promise;
    });

    await waitFor(() => {
      expect(draftMocks.fetchAiDrafts).toHaveBeenCalledTimes(2);
    });
  });

  test('reloads after an atomic stale-draft failure without exposing backend details', async () => {
    const rawError = 'draft-2 was superseded: postgres transaction detail';
    draftMocks.approveAiDrafts.mockRejectedValue(new Error(rawError));
    await renderLoaded();
    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih draft Periksa irigasi utara' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Setujui Terpilih' })
    );

    const confirm = alertSpy.mock.calls
      .at(-1)?.[2]
      ?.find((action) => action.text === 'Setujui');
    act(() => {
      confirm?.onPress?.();
    });

    expect(
      await screen.findByText(
        'Draft berubah atau belum dapat disetujui. Daftar terbaru sudah dimuat.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawError)).toBeNull();
    expect(draftMocks.fetchAiDrafts).toHaveBeenCalledTimes(2);
  });

  test('blocks stale draft approval when the post-failure refresh also fails', async () => {
    const rawApprovalError = 'draft version conflict: private database detail';
    const rawRefreshError = 'network provider detail';
    draftMocks.approveAiDrafts.mockRejectedValue(
      new Error(rawApprovalError)
    );
    draftMocks.fetchAiDrafts
      .mockResolvedValueOnce(drafts)
      .mockRejectedValueOnce(new Error(rawRefreshError));
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih draft Periksa irigasi utara' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Setujui Terpilih' })
    );
    const confirm = alertSpy.mock.calls
      .at(-1)?.[2]
      ?.find((action) => action.text === 'Setujui');
    act(() => {
      confirm?.onPress?.();
    });

    expect(
      await screen.findByText(
        'Draft berubah atau belum dapat disetujui. Daftar terbaru belum dapat dimuat. Muat ulang sebelum mencoba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawApprovalError)).toBeNull();
    expect(screen.queryByText(rawRefreshError)).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Pilih draft Periksa irigasi utara',
      })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false, disabled: true })
    );
    expect(
      screen.getByRole('button', { name: 'Setujui Terpilih' })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true })
    );
    expect(
      screen.getByRole('button', { name: 'Muat Ulang Draft' })
    ).toBeOnTheScreen();
    const staleDraftCard = screen.getByRole('button', {
      name: /Buka draft AI Periksa irigasi utara/,
    });
    expect(staleDraftCard).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true })
    );
    fireEvent.press(staleDraftCard);
    expect(routerMocks.__push).not.toHaveBeenCalled();
  });

  test('unlocks approval only after an explicit stale-draft refresh succeeds', async () => {
    draftMocks.approveAiDrafts.mockRejectedValue(new Error('stale draft'));
    draftMocks.fetchAiDrafts
      .mockResolvedValueOnce(drafts)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(drafts.slice(1));
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih draft Periksa irigasi utara' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Setujui Terpilih' })
    );
    const confirm = alertSpy.mock.calls
      .at(-1)?.[2]
      ?.find((action) => action.text === 'Setujui');
    act(() => {
      confirm?.onPress?.();
    });

    const retryButton = await screen.findByRole('button', {
      name: 'Muat Ulang Draft',
    });
    fireEvent.press(retryButton);

    expect(
      await screen.findByText('Daftar draft terbaru berhasil dimuat.')
    ).toBeOnTheScreen();
    expect(screen.queryByText('Periksa irigasi utara')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Pilih draft Cek pertumbuhan jagung',
      })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false, disabled: false })
    );
    expect(
      screen.queryByRole('button', { name: 'Muat Ulang Draft' })
    ).toBeNull();
    expect(draftMocks.fetchAiDrafts).toHaveBeenCalledTimes(3);
  });

  test('opens a draft card on its review route', async () => {
    await renderLoaded();

    fireEvent.press(
      screen.getByRole('button', {
        name: /Buka draft AI Periksa irigasi utara/,
      })
    );

    expect(routerMocks.__push).toHaveBeenCalledWith(
      '/(app)/ai-tasks/draft-1'
    );
  });

  test('does not contain provider keys or a direct network call', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/app/(app)/ai-tasks/index.tsx'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(
      /OPENWEATHER|OPENROUTER|EXPO_PUBLIC_[A-Z0-9_]*KEY/
    );
  });
});
