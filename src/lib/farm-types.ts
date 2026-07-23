export type PlotStatus = 'aktif' | 'tidak aktif';

export type PlotFormValues = {
  namaLahan: string;
  farmerId: string | null;
  luasHektar: string;
  jenisTanaman: string;
  faseLahan: string;
  latCenter: number | null;
  lngCenter: number | null;
  radiusGeofenceM: number;
};

export type PlotFormErrors = {
  namaLahan: string | null;
  luasHektar: string | null;
  jenisTanaman: string | null;
  faseLahan: string | null;
  latCenter: string | null;
  lngCenter: string | null;
  radiusGeofenceM: string | null;
};

export type FarmPlot = {
  id: string;
  namaLahan: string;
  farmerId: string | null;
  farmerName?: string | null;
  luasHektar: number | null;
  jenisTanaman: string;
  faseLahan: string | null;
  latCenter: number;
  lngCenter: number;
  radiusGeofenceM: number;
  status: PlotStatus;
};

export type FarmTaskStatus = 'belum_dikerjakan' | 'sedang_dikerjakan' | 'selesai';

export type FarmTask = {
  id: string;
  lahanId: string;
  assignedTo: string;
  assignedBy: string | null;
  judul: string;
  deskripsi: string | null;
  status: FarmTaskStatus;
  deadline: string | null;
  requiresLocation: boolean;
  unlockedAt: string | null;
};

export type TaskEvidence = {
  id: string;
  taskId: string;
  farmerId: string;
  lahanId: string;
  photoPath: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  aiPlaceholderSummary: string | null;
  createdAt: string;
};
