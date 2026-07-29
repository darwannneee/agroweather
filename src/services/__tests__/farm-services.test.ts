import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlotFormValues } from '@/lib/farm-types';

import { buildEvidencePath } from '../evidence';
import { mapPlotRow, toPlotInsert, updatePlot } from '../plots';

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
