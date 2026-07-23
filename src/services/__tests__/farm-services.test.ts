jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../supabase', () => ({ supabase: {} }));

import { buildEvidencePath } from '../evidence';
import { mapPlotRow, toPlotInsert } from '../plots';

describe('plot service mapping', () => {
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
    expect(
      toPlotInsert({
        namaLahan: 'Sawah Utara',
        farmerId: 'farmer-1',
        luasHektar: '2.5',
        jenisTanaman: 'Padi',
        faseLahan: 'Penyiraman',
        latCenter: -7.25,
        lngCenter: 112.76,
        radiusGeofenceM: 1000,
      })
    ).toEqual({
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
});

describe('evidence service helpers', () => {
  test('builds owner-scoped storage path', () => {
    expect(buildEvidencePath('farmer-1', 'task-1', 'jpg')).toMatch(
      /^farmer-1\/task-1\/[0-9]+\.jpg$/
    );
  });
});
