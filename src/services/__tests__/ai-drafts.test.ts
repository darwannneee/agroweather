import type { SupabaseClient } from '@supabase/supabase-js';

import {
  approveAiDraft,
  approveAiDrafts,
  fetchAiDrafts,
  fetchLatestAiGenerationLog,
  invokeAiGeneration,
  mapAiDraftRow,
  rejectAiDraft,
} from '../ai-drafts';

jest.mock('../supabase', () => ({ supabase: {} }));

const draftRow = {
  id: 'draft-1',
  lahan_id: 'plot-1',
  proposed_assignee_id: 'farmer-1',
  scheduled_for: '2026-07-30',
  judul: 'Periksa irigasi',
  deskripsi: 'Pastikan saluran tidak tersumbat.',
  priority: 'high' as const,
  requires_location: true,
  ai_reason: 'Hujan diperkirakan siang hari.',
  status: 'pending' as const,
  model: 'provider/model',
  created_at: '2026-07-29T22:00:00.000Z',
  lahan: { nama_lahan: 'Sawah Utara' },
  proposed_assignee: { nama: 'Petani Satu' },
  weather_snapshot: {
    observed_at: '2026-07-29T21:00:00.000Z',
    current_data: {
      description: 'hujan ringan',
      temperatureC: 28,
      humidityPercent: 80,
      windSpeedMps: 2,
      rainMm: 0.4,
      arbitraryProviderBody: { secret: 'ignored' },
    },
    forecast_data: [
      {
        minTemperatureC: 26,
        maxTemperatureC: 30,
        rainProbability: 0.4,
      },
      {
        minTemperatureC: 25,
        maxTemperatureC: 31,
        rainProbability: 0.8,
      },
    ],
  },
};

test('maps a draft and exposes only bounded weather summary fields', () => {
  expect(mapAiDraftRow(draftRow)).toEqual({
    id: 'draft-1',
    plotId: 'plot-1',
    plotName: 'Sawah Utara',
    proposedAssigneeId: 'farmer-1',
    proposedAssigneeName: 'Petani Satu',
    scheduledFor: '2026-07-30',
    title: 'Periksa irigasi',
    description: 'Pastikan saluran tidak tersumbat.',
    priority: 'high',
    requiresLocation: true,
    aiReason: 'Hujan diperkirakan siang hari.',
    status: 'pending',
    model: 'provider/model',
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
  });
});

test('filters draft reads by date and optional status', async () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  } as any;
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [draftRow], error: null });
  const client = {
    from: jest.fn(() => query),
  } as unknown as SupabaseClient;

  await expect(fetchAiDrafts({
    scheduledFor: '2026-07-30',
    status: 'pending',
    client,
  })).resolves.toHaveLength(1);

  expect(client.from).toHaveBeenCalledWith('ai_task_drafts');
  expect(query.eq).toHaveBeenCalledWith('scheduled_for', '2026-07-30');
  expect(query.eq).toHaveBeenCalledWith('status', 'pending');
  expect(query.order).toHaveBeenCalledWith('created_at', {
    ascending: false,
  });
});

test('invokes generation and maps the stable result', async () => {
  const invoke = jest.fn().mockResolvedValue({
    data: {
      runId: 'run-1',
      status: 'partial',
      successCount: 1,
      skippedCount: 1,
      failedCount: 1,
      draftCount: 0,
      warnings: [{ plotId: 'plot-2', code: 'model_error' }],
    },
    error: null,
  });
  const client = {
    functions: { invoke },
  } as unknown as SupabaseClient;

  const result = await invokeAiGeneration(['plot-1', 'plot-2'], client);

  expect(invoke).toHaveBeenCalledWith('generate-daily-tasks', {
    body: { plotIds: ['plot-1', 'plot-2'] },
  });
  expect(result).toMatchObject({
    runId: 'run-1',
    status: 'partial',
    draftCount: 0,
  });
});

test('logs safe diagnostics when generation invoke fails before a run exists', async () => {
  const error = Object.assign(new Error('Edge Function returned 500'), {
    context: {
      status: 500,
      json: jest.fn().mockResolvedValue({
        error: 'Generate task belum berhasil. Coba lagi.',
        code: 'GENERATION_FAILED',
        providerSecret: 'must-not-log',
      }),
    },
  });
  const invoke = jest.fn().mockResolvedValue({
    data: null,
    error,
  });
  const consoleSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const client = {
    functions: { invoke },
  } as unknown as SupabaseClient;

  try {
    await expect(invokeAiGeneration(['plot-1'], client)).rejects.toThrow(
      'Edge Function returned 500'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[AgroWeather] AI generation invoke failed',
      expect.objectContaining({
        stage: 'function_invoke',
        functionName: 'generate-daily-tasks',
        plotCount: 1,
        status: 500,
        response: {
          error: 'Generate task belum berhasil. Coba lagi.',
          code: 'GENERATION_FAILED',
        },
      })
    );
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(
      'must-not-log'
    );
  } finally {
    consoleSpy.mockRestore();
  }
});

test('fetches latest generation log with per-target draft counts', async () => {
  const runQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
  };
  runQuery.select.mockReturnValue(runQuery);
  runQuery.eq.mockReturnValue(runQuery);
  runQuery.order.mockReturnValue(runQuery);
  runQuery.limit.mockReturnValue(runQuery);
  runQuery.maybeSingle.mockResolvedValue({
    data: {
      id: 'run-1',
      trigger: 'manual',
      scheduled_for: '2026-07-30',
      status: 'succeeded',
      model: 'provider/model',
      plot_count: 1,
      success_count: 1,
      skipped_count: 0,
      failed_count: 0,
      warning_summary: [],
      started_at: '2026-07-29T22:00:00.000Z',
      completed_at: '2026-07-29T22:00:02.000Z',
    },
    error: null,
  });
  const targetQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };
  targetQuery.select.mockReturnValue(targetQuery);
  targetQuery.eq.mockReturnValue(targetQuery);
  targetQuery.order.mockResolvedValue({
    data: [{
      id: 'target-1',
      run_id: 'run-1',
      lahan_id: 'plot-1',
      scheduled_for: '2026-07-30',
      status: 'succeeded',
      draft_count: 0,
      error_code: null,
      result_summary: 'Tidak ada pekerjaan aman hari ini.',
      is_current: true,
      version: 2,
      created_at: '2026-07-29T22:00:01.000Z',
      completed_at: '2026-07-29T22:00:02.000Z',
      lahan: { nama_lahan: 'Sawah Utara' },
    }],
    error: null,
  });
  const client = {
    from: jest.fn((table: string) =>
      table === 'ai_generation_runs' ? runQuery : targetQuery
    ),
  } as unknown as SupabaseClient;

  await expect(fetchLatestAiGenerationLog({
    scheduledFor: '2026-07-30',
    client,
  })).resolves.toMatchObject({
    runId: 'run-1',
    draftCount: 0,
    targets: [{
      plotName: 'Sawah Utara',
      status: 'succeeded',
      draftCount: 0,
      summary: 'Tidak ada pekerjaan aman hari ini.',
    }],
  });

  expect(client.from).toHaveBeenCalledWith('ai_generation_runs');
  expect(client.from).toHaveBeenCalledWith('ai_generation_targets');
  expect(runQuery.eq).toHaveBeenCalledWith(
    'scheduled_for',
    '2026-07-30'
  );
  expect(targetQuery.eq).toHaveBeenCalledWith('run_id', 'run-1');
});

test('uses constrained approval and rejection RPC payloads', async () => {
  const rpc = jest.fn()
    .mockResolvedValueOnce({ data: 'task-1', error: null })
    .mockResolvedValueOnce({
      data: ['task-1', 'task-2'],
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: null });
  const client = { rpc } as unknown as SupabaseClient;

  await expect(approveAiDraft({
    draftId: 'draft-1',
    assigneeId: 'farmer-1',
    title: ' Periksa irigasi ',
    description: ' Pastikan saluran tidak tersumbat. ',
    priority: 'high',
    requiresLocation: true,
  }, client)).resolves.toBe('task-1');
  await expect(
    approveAiDrafts(['draft-1', 'draft-2'], client),
  ).resolves.toEqual(['task-1', 'task-2']);
  await rejectAiDraft('draft-1', ' Tidak sesuai kondisi. ', client);

  expect(rpc).toHaveBeenNthCalledWith(1, 'approve_ai_task_draft', {
    p_draft_id: 'draft-1',
    p_assignee_id: 'farmer-1',
    p_judul: 'Periksa irigasi',
    p_deskripsi: 'Pastikan saluran tidak tersumbat.',
    p_priority: 'high',
    p_requires_location: true,
  });
  expect(rpc).toHaveBeenNthCalledWith(
    2,
    'bulk_approve_ai_task_drafts',
    { p_draft_ids: ['draft-1', 'draft-2'] },
  );
  expect(rpc).toHaveBeenNthCalledWith(3, 'reject_ai_task_draft', {
    p_draft_id: 'draft-1',
    p_reason: 'Tidak sesuai kondisi.',
  });
});
