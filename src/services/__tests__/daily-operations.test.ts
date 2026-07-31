import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchDailyOperations } from '../daily-operations';

jest.mock('../supabase', () => ({ supabase: {} }));

function query(result: Record<string, unknown>) {
  const value: any = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    then: (
      resolve: (result: Record<string, unknown>) => unknown,
      reject: (error: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.in.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.limit.mockReturnValue(value);
  value.single.mockResolvedValue(result);
  value.maybeSingle.mockResolvedValue(result);
  return value;
}

test('aggregates every farmer with first valid attendance and daily tasks', async () => {
  const farmers = query({
    data: [
      { id: 'farmer-1', nama: 'Petani Satu' },
      { id: 'farmer-2', nama: 'Petani Dua' },
    ],
    error: null,
  });
  const attendance = query({
    data: [
      {
        id: 'attendance-1',
        farmer_id: 'farmer-1',
        lahan_id: 'plot-1',
        attendance_date: '2026-07-30',
        waktu_masuk: '2026-07-30T00:05:00.000Z',
        distance_m: 12,
        lat: -7.25,
        lng: 112.76,
        lahan: { nama_lahan: 'Sawah Utara' },
        users: { nama: 'Petani Satu' },
      },
      {
        id: 'attendance-later',
        farmer_id: 'farmer-1',
        lahan_id: 'plot-2',
        attendance_date: '2026-07-30',
        waktu_masuk: '2026-07-30T01:05:00.000Z',
        distance_m: 5,
        lat: -7.26,
        lng: 112.77,
        lahan: { nama_lahan: 'Sawah Selatan' },
        users: { nama: 'Petani Satu' },
      },
    ],
    error: null,
  });
  const tasks = query({
    data: [{
      id: 'task-1',
      lahan_id: 'plot-1',
      assigned_to: 'farmer-1',
      assigned_by: 'internal-1',
      judul: 'Periksa irigasi',
      deskripsi: null,
      status: 'sedang_dikerjakan',
      deadline: null,
      scheduled_for: '2026-07-30',
      priority: 'high',
      source: 'ai',
      ai_reason: 'Hujan siang hari.',
      requires_location: true,
      unlocked_at: '2026-07-30T00:10:00.000Z',
      lahan: { nama_lahan: 'Sawah Utara' },
      assigned_user: { nama: 'Petani Satu' },
    }],
    error: null,
  });
  const evidence = query({
    data: [{
      task_id: 'task-1',
      review_status: 'revision_requested',
      review_note: 'Foto terlalu gelap.',
      created_at: '2026-07-30T01:00:00.000Z',
    }],
    error: null,
  });
  const drafts = query({ data: null, error: null, count: 2 });
  const generation = query({
    data: {
      status: 'partial',
      completed_at: '2026-07-30T00:00:00.000Z',
      success_count: 1,
      skipped_count: 1,
      failed_count: 1,
    },
    error: null,
  });
  const weather = query({
    data: [{
      lahan_id: 'plot-1',
      observed_at: '2026-07-30T00:00:00.000Z',
      current_data: {
        description: 'hujan ringan',
        temperatureC: 26.5,
        humidityPercent: 82,
        rainMm: 0.4,
      },
      forecast_data: [{
        minTemperatureC: 25,
        maxTemperatureC: 31,
        rainProbability: 0.7,
      }],
      lahan: { nama_lahan: 'Sawah Utara' },
    }],
    error: null,
  });
  const queues: Record<string, any[]> = {
    users: [farmers],
    absensi: [attendance],
    tasks: [tasks],
    task_evidence: [evidence],
    ai_task_drafts: [drafts],
    ai_generation_runs: [generation],
    weather_snapshots: [weather],
  };
  const client = {
    from: jest.fn((table: string) => queues[table].shift()),
  } as unknown as SupabaseClient;

  const result = await fetchDailyOperations('2026-07-30', client);

  expect(result.attendance).toEqual([
    {
      farmerId: 'farmer-1',
      farmerName: 'Petani Satu',
      status: 'present',
      record: expect.objectContaining({
        id: 'attendance-1',
        plotName: 'Sawah Utara',
      }),
    },
    {
      farmerId: 'farmer-2',
      farmerName: 'Petani Dua',
      status: 'absent',
      record: null,
    },
  ]);
  expect(result.tasks[0]).toMatchObject({
    plotName: 'Sawah Utara',
    farmerName: 'Petani Satu',
    task: {
      scheduledFor: '2026-07-30',
      latestEvidence: {
        status: 'revision_requested',
        reviewNote: 'Foto terlalu gelap.',
      },
    },
  });
  expect(result.pendingDraftCount).toBe(2);
  expect(result.lastGeneration).toEqual({
    status: 'partial',
    completedAt: '2026-07-30T00:00:00.000Z',
    successCount: 1,
    skippedCount: 1,
    failedCount: 1,
  });
  expect(result.weather).toEqual([expect.objectContaining({
    plotId: 'plot-1',
    plotName: 'Sawah Utara',
    temperatureC: 26.5,
    forecastMinTemperatureC: 25,
    forecastMaxTemperatureC: 31,
    forecastMaxRainProbability: 0.7,
  })]);
  expect(attendance.eq).toHaveBeenCalledWith(
    'attendance_date',
    '2026-07-30',
  );
  expect(attendance.eq).toHaveBeenCalledWith('status_geofence', 'valid');
  expect(attendance.order).toHaveBeenCalledWith('waktu_masuk', {
    ascending: true,
  });
  expect(tasks.eq).toHaveBeenCalledWith('scheduled_for', '2026-07-30');
  expect(evidence.order).toHaveBeenCalledWith('created_at', {
    ascending: false,
  });
});

test('fails the task section when a required display name is missing', async () => {
  const queues: Record<string, any[]> = {
    users: [query({ data: [], error: null })],
    absensi: [query({ data: [], error: null })],
    tasks: [query({
      data: [{
        id: 'task-1',
        lahan_id: 'plot-1',
        assigned_to: 'farmer-1',
        assigned_by: null,
        judul: 'Task',
        deskripsi: null,
        status: 'belum_dikerjakan',
        deadline: null,
        scheduled_for: '2026-07-30',
        priority: 'medium',
        source: 'manual',
        ai_reason: null,
        requires_location: true,
        unlocked_at: null,
        lahan: null,
        assigned_user: { nama: 'Petani Satu' },
      }],
      error: null,
    })],
    task_evidence: [query({ data: [], error: null })],
    ai_task_drafts: [query({ data: null, error: null, count: 0 })],
    ai_generation_runs: [query({ data: null, error: null })],
    weather_snapshots: [query({ data: [], error: null })],
  };
  const client = {
    from: jest.fn((table: string) => queues[table].shift()),
  } as unknown as SupabaseClient;

  await expect(
    fetchDailyOperations('2026-07-30', client),
  ).rejects.toThrow('DAILY_TASK_DISPLAY_DATA_MISSING');
});
