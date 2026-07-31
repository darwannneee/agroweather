import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EvidenceAttemptCard } from '@/components/domain/evidence-attempt-card';
import {
  EvidencePicker,
  type EvidenceAsset,
} from '@/components/domain/evidence-picker';
import { LocationActionCard } from '@/components/domain/location-action-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors } from '@/constants/theme';
import { useLocationAction } from '@/hooks/use-location-action';
import { buildMvpAnalysisSummary } from '@/lib/analysis';
import type {
  EvidenceAttempt,
  FarmPlot,
  FarmTask,
  TaskPriority,
} from '@/lib/farm-types';
import { validateEvidenceUpload } from '@/lib/farm-validation';
import { evaluateGeofence, type GeofenceResult } from '@/lib/geofence';
import {
  accuracyLimitForRadius,
  validateLocationReading,
} from '@/lib/location-policy';
import { useAuth } from '@/services/auth-context';
import {
  fetchTaskEvidenceAttempts,
  uploadTaskEvidence,
} from '@/services/evidence';
import {
  openLocationSettings,
  requestCurrentLocation,
  type CurrentLocationResult,
  type GrantedLocationResult,
} from '@/services/location';
import { fetchPlotById } from '@/services/plots';
import { fetchTaskDetail, startTask } from '@/services/tasks';

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

const TASK_LOAD_ERROR =
  'Detail task belum dapat dimuat. Silakan coba lagi.';
const TASK_ASSIGNMENT_ERROR =
  'Task ini tidak ditugaskan kepada akun Anda.';
const EVIDENCE_UPLOAD_ERROR =
  'Bukti belum dapat diunggah. Periksa koneksi lalu coba lagi.';
const TASK_START_ERROR =
  'Lokasi valid, tetapi task belum dapat dimulai. Periksa koneksi lalu coba lagi.';

type LocationSettingsStatus = Extract<
  CurrentLocationResult['status'],
  'permission-blocked' | 'services-disabled'
>;

function formatDistance(distanceM: number | null): string {
  if (distanceM === null) return '-';
  if (distanceM < 1_000) return `${distanceM} m`;
  return `${(distanceM / 1_000).toFixed(2)} km`;
}

function readingErrorMessage(): string {
  return 'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.';
}

function submissionReadingErrorMessage(): string {
  return 'Akurasi GPS berubah. Bukti belum dikirim; pindah ke area terbuka lalu coba lagi.';
}

function locationSettingsStatus(
  result?: CurrentLocationResult
): LocationSettingsStatus | null {
  if (
    result?.status === 'permission-blocked' ||
    result?.status === 'services-disabled'
  ) {
    return result.status;
  }
  return null;
}

function mergeRegisteredAttempt(
  attempts: EvidenceAttempt[],
  registered: EvidenceAttempt
): EvidenceAttempt[] {
  const merged = attempts.some(({ id }) => id === registered.id)
    ? attempts
    : [...attempts, registered];
  return [...merged].sort(
    (a, b) => a.attemptNumber - b.attemptNumber
  );
}

export function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const { profile } = useAuth();
  const farmerId = profile?.id;
  const {
    state: locationActionState,
    run: runLocationAction,
    reset: resetLocationAction,
  } = useLocationAction();
  const loadVersion = useRef(0);
  const unlockVersion = useRef(0);
  const submissionVersion = useRef(0);
  const unlockActive = useRef(false);
  const submissionActive = useRef(false);
  const taskStarted = useRef(false);
  const [task, setTask] = useState<FarmTask | null>(null);
  const [plot, setPlot] = useState<FarmPlot | null>(null);
  const [attempts, setAttempts] = useState<EvidenceAttempt[]>([]);
  const [unlockReading, setUnlockReading] =
    useState<GrantedLocationResult | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockLocationError, setUnlockLocationError] =
    useState<string | null>(null);
  const [submitLocationError, setSubmitLocationError] =
    useState<string | null>(null);
  const [submitSettingsStatus, setSubmitSettingsStatus] =
    useState<LocationSettingsStatus | null>(null);
  const [submissionError, setSubmissionError] =
    useState<string | null>(null);
  const [submissionFeedback, setSubmissionFeedback] =
    useState<string | null>(null);
  const [asset, setAsset] = useState<EvidenceAsset | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const latestAttempt = attempts.at(-1) ?? null;
  const pendingReview = latestAttempt?.status === 'pending';
  const revisionNeeded = latestAttempt?.status === 'revision_requested';
  const completed =
    task?.status === 'selesai' || latestAttempt?.status === 'accepted';

  const analysisSummary = useMemo(() => {
    if (!task || !plot) return null;
    return buildMvpAnalysisSummary({
      plotName: plot.namaLahan,
      cropType: plot.jenisTanaman,
      phase: plot.faseLahan,
      taskTitle: task.judul,
      evidenceCount: attempts.length,
    });
  }, [attempts.length, plot, task]);

  const loadDetail = useCallback(async () => {
    const version = ++loadVersion.current;
    unlockVersion.current += 1;
    submissionVersion.current += 1;
    unlockActive.current = false;
    submissionActive.current = false;
    taskStarted.current = false;
    resetLocationAction();
    setLoading(true);
    setLoadError(null);
    setTask(null);
    setPlot(null);
    setAttempts([]);
    setUnlockReading(null);
    setGeofence(null);
    setUnlocked(false);
    setUnlockLocationError(null);
    setSubmitLocationError(null);
    setSubmitSettingsStatus(null);
    setSubmissionError(null);
    setSubmissionFeedback(null);
    setAsset(null);
    setNote('');
    setSubmitting(false);

    if (!taskId) {
      if (loadVersion.current === version) setLoading(false);
      return;
    }

    try {
      const nextTask = await fetchTaskDetail(taskId);
      if (loadVersion.current !== version) return;
      if (!farmerId || nextTask.assignedTo !== farmerId) {
        setLoadError(TASK_ASSIGNMENT_ERROR);
        return;
      }

      const [nextPlot, nextAttempts] = await Promise.all([
        fetchPlotById(nextTask.lahanId),
        fetchTaskEvidenceAttempts(nextTask.id),
      ]);
      if (loadVersion.current !== version) return;

      const nextLatest = nextAttempts.at(-1) ?? null;
      const workflowClosed =
        nextTask.status === 'selesai' ||
        nextLatest?.status === 'pending' ||
        nextLatest?.status === 'accepted';
      setTask(nextTask);
      setPlot(nextPlot);
      setAttempts(nextAttempts);
      taskStarted.current = nextTask.status !== 'belum_dikerjakan';
      setUnlocked(!nextTask.requiresLocation && !workflowClosed);
    } catch {
      if (loadVersion.current === version) {
        setLoadError(TASK_LOAD_ERROR);
      }
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, [farmerId, resetLocationAction, taskId]);

  useEffect(() => {
    void loadDetail();
    return () => {
      loadVersion.current += 1;
      unlockVersion.current += 1;
      submissionVersion.current += 1;
      unlockActive.current = false;
      submissionActive.current = false;
    };
  }, [loadDetail]);

  async function handleUnlock() {
    if (!task || !plot || pendingReview || completed) return;
    if (!task.requiresLocation) {
      setUnlocked(true);
      return;
    }
    if (submissionActive.current || unlockActive.current) return;

    const version = ++unlockVersion.current;
    unlockActive.current = true;
    setUnlockLocationError(null);
    setSubmitLocationError(null);
    setSubmitSettingsStatus(null);
    setSubmissionError(null);

    try {
      const result = await runLocationAction({
        maxAccuracyM: accuracyLimitForRadius(plot.radiusGeofenceM),
      });
      if (unlockVersion.current !== version) return;

      setUnlockReading(null);
      setGeofence(null);
      setUnlocked(false);
      if (result.status !== 'granted') return;

      const readingIssue = validateLocationReading(
        {
          ...result.coords,
          accuracyM: result.accuracyM,
          timestamp: result.timestamp,
        },
        plot.radiusGeofenceM
      );
      if (readingIssue) {
        setUnlockLocationError(readingErrorMessage());
        return;
      }

      const nextGeofence = evaluateGeofence({
        user: result.coords,
        plot: {
          latitude: plot.latCenter,
          longitude: plot.lngCenter,
          radiusMeters: plot.radiusGeofenceM,
        },
      });
      setGeofence(nextGeofence);
      if (!nextGeofence.unlocked) return;

      if (!taskStarted.current) {
        try {
          await startTask(task.id);
        } catch {
          if (unlockVersion.current === version) {
            setUnlockLocationError(TASK_START_ERROR);
          }
          return;
        }
        if (unlockVersion.current !== version) return;
        taskStarted.current = true;
        setTask((current) =>
          current
            ? { ...current, status: 'sedang_dikerjakan' }
            : current
        );
      }

      setUnlockReading(result);
      setUnlocked(true);
    } finally {
      if (unlockVersion.current === version) {
        unlockActive.current = false;
      }
    }
  }

  function showSubmitLocationError(
    message: string,
    result?: CurrentLocationResult
  ) {
    setSubmitLocationError(message);
    setSubmitSettingsStatus(locationSettingsStatus(result));
  }

  async function handleSubmit() {
    if (!task || !plot || !farmerId || pendingReview || completed) return;
    if (submissionActive.current || unlockActive.current) return;

    const validation = validateEvidenceUpload({
      unlocked,
      photoUri: asset?.uri ?? null,
    });
    if (validation) {
      Alert.alert('Validasi', validation);
      return;
    }
    if (!asset) return;

    const version = ++submissionVersion.current;
    submissionActive.current = true;
    setSubmitting(true);
    setSubmitLocationError(null);
    setSubmitSettingsStatus(null);
    setSubmissionError(null);
    setSubmissionFeedback(null);

    try {
      let submissionLocation: GrantedLocationResult | null = unlockReading;
      if (task.requiresLocation) {
        const fresh = await requestCurrentLocation({
          maxAccuracyM: accuracyLimitForRadius(plot.radiusGeofenceM),
        });
        if (submissionVersion.current !== version) return;

        if (fresh.status !== 'granted') {
          showSubmitLocationError(
            fresh.status === 'low-accuracy'
              ? submissionReadingErrorMessage()
              : fresh.message,
            fresh
          );
          return;
        }

        const readingIssue = validateLocationReading(
          {
            ...fresh.coords,
            accuracyM: fresh.accuracyM,
            timestamp: fresh.timestamp,
          },
          plot.radiusGeofenceM
        );
        if (readingIssue) {
          showSubmitLocationError(submissionReadingErrorMessage());
          return;
        }

        const freshGeofence = evaluateGeofence({
          user: fresh.coords,
          plot: {
            latitude: plot.latCenter,
            longitude: plot.lngCenter,
            radiusMeters: plot.radiusGeofenceM,
          },
        });
        if (!freshGeofence.unlocked) {
          showSubmitLocationError('Lokasi berubah. Bukti belum dikirim.');
          return;
        }
        submissionLocation = fresh;
      }

      const registered = await uploadTaskEvidence({
        taskId: task.id,
        farmerId,
        lahanId: plot.id,
        photoUri: asset.uri,
        contentType: asset.mimeType,
        note: note.trim() || null,
        lat: submissionLocation?.coords.latitude ?? null,
        lng: submissionLocation?.coords.longitude ?? null,
        aiPlaceholderSummary: analysisSummary,
      });
      if (submissionVersion.current !== version) return;

      const localAttempts = mergeRegisteredAttempt(attempts, registered);
      setAttempts(localAttempts);
      setTask((current) =>
        current
          ? {
              ...current,
              status: 'sedang_dikerjakan',
              latestEvidence: { status: 'pending', reviewNote: null },
            }
          : current
      );
      setAsset(null);
      setNote('');
      setUnlocked(false);
      setSubmissionFeedback(
        'Bukti terkirim dan menunggu review internal'
      );

      try {
        const [nextTask, nextAttempts] = await Promise.all([
          fetchTaskDetail(task.id),
          fetchTaskEvidenceAttempts(task.id),
        ]);
        if (
          submissionVersion.current === version &&
          nextTask.assignedTo === farmerId
        ) {
          setTask(nextTask);
          setAttempts(
            mergeRegisteredAttempt(nextAttempts, registered)
          );
        }
      } catch {
        // Registration already succeeded. Keep the local pending attempt so a
        // stale refresh cannot expose another upload action.
      }
    } catch {
      if (submissionVersion.current === version) {
        setSubmissionError(EVIDENCE_UPLOAD_ERROR);
      }
    } finally {
      if (submissionVersion.current === version) {
        submissionActive.current = false;
        setSubmitting(false);
      }
    }
  }

  function renderTaskLocationCard() {
    if (!task?.requiresLocation || pendingReview || completed) return null;

    if (locationActionState.status === 'checking') {
      return (
        <LocationActionCard
          state="checking"
          title="Mencari sinyal GPS…"
          message="Pastikan layanan lokasi perangkat menyala."
        />
      );
    }

    if (unlockLocationError) {
      return (
        <LocationActionCard
          state="warning"
          title="Task belum siap"
          message={unlockLocationError}
          actionLabel="Periksa Lagi"
          onAction={handleUnlock}
        />
      );
    }

    if (geofence?.unlocked && unlocked) {
      return (
        <LocationActionCard
          state="success"
          title="Task siap dikerjakan"
          message="Lokasi Anda sudah berada di dalam radius lahan."
          meta={`Jarak ke lahan ${formatDistance(geofence.distanceM)}`}
          actionLabel={submitting ? undefined : 'Periksa Lagi'}
          onAction={submitting ? undefined : handleUnlock}
        />
      );
    }

    if (geofence?.status === 'outside') {
      return (
        <LocationActionCard
          state="warning"
          title="Di luar radius task"
          message="Datang lebih dekat ke lahan lalu periksa lokasi lagi."
          meta={`Jarak ke lahan ${formatDistance(geofence.distanceM)}`}
          actionLabel="Periksa Lagi"
          onAction={handleUnlock}
        />
      );
    }

    if (locationActionState.status === 'error') {
      const result = locationActionState.result;
      const blocked = result.status === 'permission-blocked';
      const servicesDisabled = result.status === 'services-disabled';
      const settingsStatus = locationSettingsStatus(result);
      return (
        <LocationActionCard
          state={blocked || servicesDisabled ? 'danger' : 'warning'}
          title={
            blocked
              ? 'Izin lokasi diblokir'
              : servicesDisabled
                ? 'GPS perangkat belum aktif'
                : result.status === 'low-accuracy'
                  ? 'Akurasi GPS belum cukup baik'
                  : 'Lokasi belum dapat diperiksa'
          }
          message={result.message ?? 'Lokasi belum dapat diperiksa.'}
          actionLabel={settingsStatus ? 'Buka Pengaturan' : 'Periksa Lagi'}
          onAction={
            settingsStatus
              ? () => {
                  void openLocationSettings(settingsStatus);
                }
              : handleUnlock
          }
        />
      );
    }

    return (
      <LocationActionCard
        state="idle"
        title="Periksa lokasi sebelum mulai"
        message="GPS hanya diambil saat Anda menekan tombol ini."
        actionLabel="Periksa Lokasi Task"
        onAction={handleUnlock}
      />
    );
  }

  return (
    <AppScreen>
      {loading ? (
        <FeedbackState
          loading
          title="Memuat detail task…"
          message="Mengambil instruksi kerja terbaru."
        />
      ) : loadError ? (
        <FeedbackState
          title="Detail task belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadDetail()}
        />
      ) : !task || !plot ? (
        <FeedbackState
          title="Task tidak ditemukan"
          message="Periksa kembali task yang Anda buka."
        />
      ) : (
        <>
          <ScreenHeader
            eyebrow="Detail Task"
            title={task.judul}
            description={`${plot.namaLahan} · ${plot.jenisTanaman}`}
          />

          <SurfaceCard>
            <AppText variant="subtitle">Ringkasan Task</AppText>
            <AppText variant="small">Lahan: {plot.namaLahan}</AppText>
            <AppText variant="small">
              Prioritas: {priorityLabels[task.priority]}
            </AppText>
            <AppText variant="small">Jadwal: {task.scheduledFor}</AppText>
            <AppText variant="small">
              Instruksi: {task.deskripsi ?? 'Kerjakan sesuai arahan internal.'}
            </AppText>
            {task.aiReason ? (
              <AppText variant="small">Alasan AI: {task.aiReason}</AppText>
            ) : null}
            <AppText variant="small">
              Bukti lokasi: {task.requiresLocation ? 'Wajib' : 'Tidak diwajibkan'}
            </AppText>
          </SurfaceCard>

          {attempts.length > 0 ? (
            <>
              <AppText variant="title">Riwayat Bukti</AppText>
              {attempts.map((attempt) => (
                <EvidenceAttemptCard key={attempt.id} attempt={attempt} />
              ))}
            </>
          ) : null}

          {completed ? (
            <SurfaceCard>
              <AppText variant="subtitle" color={Colors.successText}>
                Task selesai
              </AppText>
              <AppText variant="small">
                Bukti telah diterima internal. Riwayat tetap dapat dilihat.
              </AppText>
            </SurfaceCard>
          ) : pendingReview ? (
            <SurfaceCard>
              <AppText variant="subtitle">Menunggu review internal</AppText>
              <AppText variant="small">
                Bukti terbaru sedang diperiksa. Pengiriman baru akan tersedia
                jika internal meminta perbaikan.
              </AppText>
            </SurfaceCard>
          ) : revisionNeeded ? (
            <SurfaceCard>
              <AppText variant="subtitle" color={Colors.dangerText}>
                Perlu perbaikan
              </AppText>
              <AppText variant="small">
                Catatan reviewer: {latestAttempt.reviewNote ?? 'Perbaiki bukti lalu kirim kembali.'}
              </AppText>
            </SurfaceCard>
          ) : null}

          {submissionFeedback ? (
            <AppText
              variant="smallStrong"
              color={Colors.successText}
              accessibilityLiveRegion="polite"
            >
              {submissionFeedback}
            </AppText>
          ) : null}

          {renderTaskLocationCard()}

          {unlocked && !pendingReview && !completed ? (
            <>
              <SurfaceCard>
                <AppText variant="subtitle">Foto Bukti</AppText>
                <EvidencePicker
                  asset={asset}
                  onChange={setAsset}
                  disabled={
                    submitting || locationActionState.status === 'checking'
                  }
                />
              </SurfaceCard>
              <FormField
                label="Catatan Bukti"
                inputProps={{
                  accessibilityLabel: 'Catatan Bukti',
                  value: note,
                  onChangeText: setNote,
                  placeholder: 'Contoh: Saluran air sudah dibersihkan',
                  multiline: true,
                  editable:
                    !submitting &&
                    locationActionState.status !== 'checking',
                }}
              />
              {submitLocationError ? (
                <LocationActionCard
                  state={submitSettingsStatus ? 'danger' : 'warning'}
                  title="Bukti belum dikirim"
                  message={submitLocationError}
                  actionLabel={
                    submitSettingsStatus ? 'Buka Pengaturan' : undefined
                  }
                  onAction={
                    submitSettingsStatus
                      ? () => {
                          void openLocationSettings(submitSettingsStatus);
                        }
                      : undefined
                  }
                />
              ) : null}
              {submissionError ? (
                <LocationActionCard
                  state="warning"
                  title="Bukti belum tersimpan"
                  message={submissionError}
                />
              ) : null}
              <AppButton
                label={
                  task.requiresLocation
                    ? 'Periksa GPS & Kirim Bukti'
                    : 'Kirim Bukti'
                }
                loading={submitting}
                disabled={locationActionState.status === 'checking'}
                onPress={handleSubmit}
              />
            </>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

export default function TaskDetailRoute() {
  return (
    <RoleGuard requiredRole="farmer">
      <TaskDetailScreen />
    </RoleGuard>
  );
}
