export type PlotStatus = 'aktif' | 'tidak aktif';

export type PlotFormValues = {
  namaLahan: string;
  farmerId: string | null;
  farmerIds: string[];
  primaryFarmerId: string | null;
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
  farmerIds?: string[];
  farmerNames?: string[];
  primaryFarmerId?: string | null;
  luasHektar: number | null;
  jenisTanaman: string;
  faseLahan: string | null;
  latCenter: number;
  lngCenter: number;
  radiusGeofenceM: number;
  status: PlotStatus;
};

export type FarmTaskStatus = 'belum_dikerjakan' | 'sedang_dikerjakan' | 'selesai';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskSource = 'manual' | 'ai';
export type EvidenceReviewStatus =
  | 'pending'
  | 'accepted'
  | 'revision_requested';
export type AiDraftStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'superseded';
export type GenerationStatus = 'running' | 'succeeded' | 'partial' | 'failed';

export type LatestEvidenceSummary = {
  status: EvidenceReviewStatus;
  reviewNote: string | null;
};

export type FarmTask = {
  id: string;
  lahanId: string;
  assignedTo: string;
  assignedBy: string | null;
  judul: string;
  deskripsi: string | null;
  status: FarmTaskStatus;
  deadline: string | null;
  scheduledFor: string;
  priority: TaskPriority;
  source: TaskSource;
  aiReason: string | null;
  requiresLocation: boolean;
  unlockedAt: string | null;
  latestEvidence: LatestEvidenceSummary | null;
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

export type AttendanceRecord = {
  id: string;
  farmerId: string;
  farmerName: string;
  plotId: string;
  plotName: string;
  attendanceDate: string;
  checkedInAt: string;
  distanceM: number | null;
  latitude: number;
  longitude: number;
};

export type DraftWeatherSummary = {
  observedAt: string;
  description: string;
  temperatureC: number;
  humidityPercent: number;
  windSpeedMps: number;
  rainMm: number;
  forecastMinTemperatureC: number | null;
  forecastMaxTemperatureC: number | null;
  forecastMaxRainProbability: number | null;
};

export type DashboardWeatherSummary = DraftWeatherSummary & {
  plotId: string;
  plotName: string;
};

export type AiTaskDraft = {
  id: string;
  plotId: string;
  plotName: string;
  proposedAssigneeId: string;
  proposedAssigneeName: string;
  scheduledFor: string;
  title: string;
  description: string;
  priority: TaskPriority;
  requiresLocation: boolean;
  aiReason: string;
  status: AiDraftStatus;
  model: string;
  weather: DraftWeatherSummary;
  createdAt: string;
};

export type EvidenceAttempt = {
  id: string;
  taskId: string;
  attemptNumber: number;
  photoPath: string;
  photoUrl: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  status: EvidenceReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type OperationalTask = {
  task: FarmTask;
  plotName: string;
  farmerName: string;
};
