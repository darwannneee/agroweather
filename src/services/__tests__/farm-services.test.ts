import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlotFormValues } from '@/lib/farm-types';

import { buildEvidencePath } from '../evidence';
import { mapPlotRow, toPlotInsert, updatePlot } from '../plots';
import { mapTaskRow } from '../tasks';

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
  test('maps daily operation fields from a Supabase task row', () => {
    expect(
      mapTaskRow({
        id: 'task-1',
        lahan_id: 'plot-1',
        assigned_to: 'farmer-1',
        assigned_by: 'internal-1',
        judul: 'Periksa irigasi',
        deskripsi: 'Pastikan aliran air merata.',
        status: 'belum_dikerjakan',
        deadline: null,
        scheduled_for: '2026-07-30',
        priority: 'high',
        source: 'ai',
        ai_reason: 'Curah hujan diperkirakan rendah.',
        requires_location: true,
        unlocked_at: null,
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
      latestEvidence: null,
    });
  });
});
