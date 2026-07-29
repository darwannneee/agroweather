import { validateEvidenceUpload, validatePlotForm } from '../farm-validation';

describe('validatePlotForm', () => {
  const valid = {
    namaLahan: 'Sawah Utara',
    farmerId: 'farmer-1',
    luasHektar: '2.5',
    jenisTanaman: 'Padi',
    faseLahan: 'Penyiraman',
    latCenter: -7.250445,
    lngCenter: 112.768845,
    radiusGeofenceM: 1000,
  };

  test('accepts valid plot form values', () => {
    expect(validatePlotForm(valid)).toEqual({
      namaLahan: null,
      luasHektar: null,
      jenisTanaman: null,
      faseLahan: null,
      latCenter: null,
      lngCenter: null,
      radiusGeofenceM: null,
    });
  });

  test('rejects missing required text fields', () => {
    expect(
      validatePlotForm({
        ...valid,
        namaLahan: ' ',
        jenisTanaman: '',
        faseLahan: '',
      })
    ).toMatchObject({
      namaLahan: 'Nama lahan wajib diisi',
      jenisTanaman: 'Jenis tanaman wajib diisi',
      faseLahan: 'Fase lahan wajib diisi',
    });
  });

  test('rejects invalid area and geofence radius', () => {
    expect(
      validatePlotForm({
        ...valid,
        luasHektar: '0',
        radiusGeofenceM: 0,
      })
    ).toMatchObject({
      luasHektar: 'Luas lahan harus lebih dari 0',
      radiusGeofenceM: 'Radius harus lebih dari 0 meter',
    });
  });

  test('rejects missing map center', () => {
    expect(
      validatePlotForm({
        ...valid,
        latCenter: null,
        lngCenter: null,
      })
    ).toMatchObject({
      latCenter: 'Latitude lahan wajib dipilih',
      lngCenter: 'Longitude lahan wajib dipilih',
    });
  });

  test('rejects coordinates outside geographic bounds', () => {
    expect(validatePlotForm({ ...valid, latCenter: 90.01 }).latCenter).toBe(
      'Latitude harus berada di antara -90 dan 90'
    );
    expect(validatePlotForm({ ...valid, lngCenter: 180.01 }).lngCenter).toBe(
      'Longitude harus berada di antara -180 dan 180'
    );
  });
});

describe('validateEvidenceUpload', () => {
  test('requires unlocked task', () => {
    expect(validateEvidenceUpload({ unlocked: false, photoUri: 'file://photo.jpg' })).toBe(
      'Task belum terbuka karena petani belum berada dalam radius lahan'
    );
  });

  test('requires selected photo', () => {
    expect(validateEvidenceUpload({ unlocked: true, photoUri: null })).toBe(
      'Foto bukti wajib dipilih'
    );
  });

  test('accepts unlocked task with photo', () => {
    expect(validateEvidenceUpload({ unlocked: true, photoUri: 'file://photo.jpg' })).toBeNull();
  });
});
