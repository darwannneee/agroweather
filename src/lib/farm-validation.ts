import type { PlotFormErrors, PlotFormValues } from './farm-types';

export function validatePlotForm(values: PlotFormValues): PlotFormErrors {
  const area = Number(values.luasHektar);

  return {
    namaLahan: values.namaLahan.trim() ? null : 'Nama lahan wajib diisi',
    luasHektar:
      values.luasHektar.trim() && Number.isFinite(area) && area > 0
        ? null
        : 'Luas lahan harus lebih dari 0',
    jenisTanaman: values.jenisTanaman.trim() ? null : 'Jenis tanaman wajib diisi',
    faseLahan: values.faseLahan.trim() ? null : 'Fase lahan wajib diisi',
    latCenter:
      typeof values.latCenter === 'number' && Number.isFinite(values.latCenter)
        ? null
        : 'Latitude lahan wajib dipilih',
    lngCenter:
      typeof values.lngCenter === 'number' && Number.isFinite(values.lngCenter)
        ? null
        : 'Longitude lahan wajib dipilih',
    radiusGeofenceM:
      Number.isInteger(values.radiusGeofenceM) && values.radiusGeofenceM > 0
        ? null
        : 'Radius harus lebih dari 0 meter',
  };
}

export function validateEvidenceUpload(input: {
  unlocked: boolean;
  photoUri: string | null;
}): string | null {
  if (!input.unlocked) {
    return 'Task belum terbuka karena petani belum berada dalam radius lahan';
  }
  if (!input.photoUri) return 'Foto bukti wajib dipilih';
  return null;
}
