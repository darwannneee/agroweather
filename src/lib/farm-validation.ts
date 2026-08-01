import type { PlotFormErrors, PlotFormValues } from './farm-types';

export function normalizePlotIdParam(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function plotFormIsDirty(current: PlotFormValues, initial: PlotFormValues): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

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
      typeof values.latCenter !== 'number' || !Number.isFinite(values.latCenter)
        ? 'Latitude lahan wajib dipilih'
        : values.latCenter < -90 || values.latCenter > 90
          ? 'Latitude harus berada di antara -90 dan 90'
          : null,
    lngCenter:
      typeof values.lngCenter !== 'number' || !Number.isFinite(values.lngCenter)
        ? 'Longitude lahan wajib dipilih'
        : values.lngCenter < -180 || values.lngCenter > 180
          ? 'Longitude harus berada di antara -180 dan 180'
          : null,
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
