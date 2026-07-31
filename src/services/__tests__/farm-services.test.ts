import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlotFormValues } from '@/lib/farm-types';

import { checkInIfInsideRadius } from '../attendance';
import { buildEvidencePath } from '../evidence';
import { mapPlotRow, toPlotInsert, updatePlot } from '../plots';
import {
  createTaskForPlot,
  fetchFarmerTasks,
  mapTaskRow,
  startTask,
} from '../tasks';

jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../supabase', () => ({ supabase: {} }));

describe('plot service mapping', () => {
  const validForm: PlotFormValues = {
    namaLahan: 'Sawah Utara',
    farmerId: 'farmer-1',
    luasHektar: '2.5',
    jenisTanaman: 'Padi',
    faseLahan: 'Penyiraman',
    latCenter: -7.25,
    lngCenter: 112.76,
    radiusGeofenceM: 1000,
  };

  test('maps Supabase lahan row into app plot shape', () => {
    expect(
      mapPlotRow({
        id: 'plot-1',
        nama_lahan: 'Sawah Utara',
        farmer_id: 'farmer-1',
        jenis_tanaman: 'Padi',
        luas_hektar: 2.5,
        lat_center: -7.25,
        lng_center: 112.76,
        radius_geofence_m: 1000,
        fase_lahan: 'Penyiraman',
        status: 'aktif',
      })
    ).toEqual({
      id: 'plot-1',
      namaLahan: 'Sawah Utara',
      farmerId: 'farmer-1',
      farmerName: null,
      jenisTanaman: 'Padi',
      luasHektar: 2.5,
      latCenter: -7.25,
      lngCenter: 112.76,
      radiusGeofenceM: 1000,
      faseLahan: 'Penyiraman',
      status: 'aktif',
    });
  });

  test('converts validated form values into lahan insert payload', () => {
    expect(toPlotInsert(validForm)).toEqual({
      nama_lahan: 'Sawah Utara',
      farmer_id: 'farmer-1',
      luas_hektar: 2.5,
      jenis_tanaman: 'Padi',
      fase_lahan: 'Penyiraman',
      lat_center: -7.25,
      lng_center: 112.76,
      radius_geofence_m: 1000,
      status: 'aktif',
    });
  });

  test('does not reactivate a plot while updating its form fields', async () => {
    const eq = jest.fn(async () => ({ error: null }));
    const update = jest.fn((_payload: Record<string, unknown>) => ({ eq }));
    const from = jest.fn(() => ({ update }));
    const client = { from } as unknown as SupabaseClient;

    await updatePlot('plot-1', validForm, client);

    expect(from).toHaveBeenCalledWith('lahan');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).not.toHaveProperty('status');
    expect(eq).toHaveBeenCalledWith('id', 'plot-1');
  });
});

describe('evidence service helpers', () => {
  test('builds owner-scoped storage path', () => {
    expect(buildEvidencePath('farmer-1', 'task-1', 'jpg')).toMatch(
      /^farmer-1\/task-1\/[0-9]+\.jpg$/
    );
  });
});

describe('task service mapping', () => {
  const taskRow = {
    id: 'task-1',
    lahan_id: 'plot-1',
    assigned_to: 'farmer-1',
    assigned_by: 'internal-1',
    judul: 'Periksa irigasi',
    deskripsi: 'Pastikan aliran air merata.',
    status: 'belum_dikerjakan' as const,
    deadline: null,
    scheduled_for: '2026-07-30',
    priority: 'high' as const,
    source: 'ai' as const,
    ai_reason: 'Curah hujan diperkirakan rendah.',
    requires_location: true,
    unlocked_at: null,
  };

  test('maps daily fields and the latest evidence summary', () => {
    expect(
      mapTaskRow(taskRow, {
        task_id: 'task-1',
        review_status: 'revision_requested',
        review_note: 'Foto terlalu gelap.',
        created_at: '2026-07-30T01:00:00.000Z',
      })
    ).toEqual({
      id: 'task-1',
      lahanId: 'plot-1',
      assignedTo: 'farmer-1',
      assignedBy: 'internal-1',
      judul: 'Periksa irigasi',
      deskripsi: 'Pastikan aliran air merata.',
      status: 'belum_dikerjakan',
      deadline: null,
      scheduledFor: '2026-07-30',
      priority: 'high',
      source: 'ai',
      aiReason: 'Curah hujan diperkirakan rendah.',
      requiresLocation: true,
      unlockedAt: null,
      latestEvidence: {
        status: 'revision_requested',
        reviewNote: 'Foto terlalu gelap.',
      },
    });
  });

  test('fetches only the requested day and attaches newest task evidence', async () => {
    const taskQuery: any = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
    };
    taskQuery.select.mockReturnValue(taskQuery);
    taskQuery.eq.mockReturnValue(taskQuery);
    taskQuery.order.mockResolvedValue({ data: [taskRow], error: null });

    const evidenceQuery: any = {
      select: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
    };
    evidenceQuery.select.mockReturnValue(evidenceQuery);
    evidenceQuery.in.mockReturnValue(evidenceQuery);
    evidenceQuery.order.mockResolvedValue({
      data: [
        {
          task_id: 'task-1',
          review_status: 'pending',
          review_note: null,
          created_at: '2026-07-30T02:00:00.000Z',
        },
        {
          task_id: 'task-1',
          review_status: 'revision_requested',
          review_note: 'Older',
          created_at: '2026-07-30T01:00:00.000Z',
        },
      ],
      error: null,
    });
    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce(taskQuery)
        .mockReturnValueOnce(evidenceQuery),
    } as unknown as SupabaseClient;

    const result = await fetchFarmerTasks(
      'farmer-1',
      '2026-07-30',
      client,
    );

    expect(taskQuery.eq).toHaveBeenCalledWith('assigned_to', 'farmer-1');
    expect(taskQuery.eq).toHaveBeenCalledWith(
      'scheduled_for',
      '2026-07-30',
    );
    expect(evidenceQuery.in).toHaveBeenCalledWith('task_id', ['task-1']);
    expect(result[0].latestEvidence).toEqual({
      status: 'pending',
      reviewNote: null,
    });
  });

  test('creates only explicit manual task fields and starts through RPC', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const rpc = jest.fn().mockResolvedValue({ data: taskRow, error: null });
    const client = {
      from: jest.fn(() => ({ insert })),
      rpc,
    } as unknown as SupabaseClient;

    await createTaskForPlot({
      lahanId: 'plot-1',
      assignedTo: 'farmer-1',
      assignedBy: 'internal-1',
      judul: ' Periksa saluran ',
      deskripsi: null,
      deadline: null,
      scheduledFor: '2026-07-30',
      priority: 'medium',
      requiresLocation: true,
    }, client);
    await startTask('task-1', client);

    expect(insert).toHaveBeenCalledWith({
      lahan_id: 'plot-1',
      assigned_to: 'farmer-1',
      assigned_by: 'internal-1',
      judul: 'Periksa saluran',
      deskripsi: null,
      deadline: null,
      scheduled_for: '2026-07-30',
      priority: 'medium',
      source: 'manual',
      requires_location: true,
    });
    expect(rpc).toHaveBeenCalledWith('start_assigned_task', {
      p_task_id: 'task-1',
    });
  });
});

describe('attendance service', () => {
  test('keeps foreground geofence precheck and registers attendance by RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: 'attendance-1',
        farmer_id: 'farmer-1',
        lahan_id: 'plot-1',
        attendance_date: '2026-07-30',
        waktu_masuk: '2026-07-30T00:00:00.000Z',
        distance_m: 0,
        lat: -7.25,
        lng: 112.76,
      },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await checkInIfInsideRadius({
      farmerId: 'farmer-1',
      plot: {
        id: 'plot-1',
        namaLahan: 'Sawah Utara',
        farmerId: 'farmer-1',
        luasHektar: 2,
        jenisTanaman: 'Padi',
        faseLahan: 'Penyiraman',
        latCenter: -7.25,
        lngCenter: 112.76,
        radiusGeofenceM: 100,
        status: 'aktif',
      },
      userLocation: { latitude: -7.25, longitude: 112.76 },
    }, client);

    expect(rpc).toHaveBeenCalledWith('register_attendance', {
      p_lahan_id: 'plot-1',
      p_lat: -7.25,
      p_lng: 112.76,
    });
    expect(result).toMatchObject({
      unlocked: true,
      attendanceCreated: true,
      attendance: {
        id: 'attendance-1',
        farmerId: 'farmer-1',
        plotName: 'Sawah Utara',
      },
    });
  });
});
