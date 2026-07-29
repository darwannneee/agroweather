import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  EvidencePicker,
  type EvidenceAsset,
} from '@/components/domain/evidence-picker';
import { LocationActionCard } from '@/components/domain/location-action-card';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { buildMvpAnalysisSummary } from '@/lib/analysis';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import { validateEvidenceUpload } from '@/lib/farm-validation';
import { evaluateGeofence, type GeofenceResult } from '@/lib/geofence';
import {
  accuracyLimitForRadius,
  validateLocationReading,
} from '@/lib/location-policy';
import { useLocationAction } from '@/hooks/use-location-action';
import { useAuth } from '@/services/auth-context';
import { countTaskEvidence, uploadTaskEvidence } from '@/services/evidence';
import {
  openLocationSettings,
  requestCurrentLocation,
  type CurrentLocationResult,
  type GrantedLocationResult,
} from '@/services/location';
import { fetchPlotById } from '@/services/plots';
import { fetchTaskDetail, markTaskComplete } from '@/services/tasks';

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

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { profile } = useAuth();
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
  const [task, setTask] = useState<FarmTask | null>(null);
  const [plot, setPlot] = useState<FarmPlot | null>(null);
  const [unlockReading, setUnlockReading] = useState<GrantedLocationResult | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockLocationError, setUnlockLocationError] = useState<string | null>(null);
  const [submitLocationError, setSubmitLocationError] = useState<string | null>(null);
  const [submitCanOpenSettings, setSubmitCanOpenSettings] = useState(false);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [asset, setAsset] = useState<EvidenceAsset | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const analysisSummary = useMemo(() => {
    if (!task || !plot) return null;
    return buildMvpAnalysisSummary({
      plotName: plot.namaLahan,
      cropType: plot.jenisTanaman,
      phase: plot.faseLahan,
      taskTitle: task.judul,
      evidenceCount,
    });
  }, [evidenceCount, plot, task]);

  const loadDetail = useCallback(async () => {
    const version = ++loadVersion.current;
    unlockVersion.current += 1;
    submissionVersion.current += 1;
    unlockActive.current = false;
    submissionActive.current = false;
    resetLocationAction();
    setLoading(true);
    setLoadError(null);
    setTask(null);
    setPlot(null);
    setUnlockReading(null);
    setGeofence(null);
    setUnlocked(false);
    setUnlockLocationError(null);
    setSubmitLocationError(null);
    setSubmitCanOpenSettings(false);
    setEvidenceCount(0);
    setAsset(null);
    setNote('');
    setSubmitting(false);

    if (!taskId) {
      if (loadVersion.current === version) setLoading(false);
      return;
    }

    try {
      const nextTask = await fetchTaskDetail(taskId);
      const [nextPlot, nextEvidenceCount] = await Promise.all([
        fetchPlotById(nextTask.lahanId),
        countTaskEvidence(nextTask.id),
      ]);
      if (loadVersion.current !== version) return;

      setTask(nextTask);
      setPlot(nextPlot);
      setEvidenceCount(nextEvidenceCount);
      setUnlocked(!nextTask.requiresLocation);
    } catch (error) {
      if (loadVersion.current !== version) return;
      setLoadError(error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, [resetLocationAction, taskId]);

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
    if (!task || !plot) return;
    if (!task.requiresLocation) {
      setUnlocked(true);
      return;
    }
    if (submissionActive.current || unlockActive.current) return;

    const version = ++unlockVersion.current;
    unlockActive.current = true;
    setUnlockLocationError(null);
    setSubmitLocationError(null);
    setSubmitCanOpenSettings(false);

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
      setUnlockReading(result);
      setGeofence(nextGeofence);
      setUnlocked(nextGeofence.unlocked);
    } finally {
      if (unlockVersion.current === version) unlockActive.current = false;
    }
  }

  function showSubmitLocationError(
    message: string,
    result?: CurrentLocationResult
  ) {
    setSubmitLocationError(message);
    setSubmitCanOpenSettings(Boolean(result?.canOpenSettings));
  }

  async function handleSubmit() {
    if (!task || !plot || !profile) return;
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
    setSubmitCanOpenSettings(false);

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

      await uploadTaskEvidence({
        taskId: task.id,
        farmerId: profile.id,
        lahanId: plot.id,
        photoUri: asset.uri,
        contentType: asset.mimeType,
        note: note.trim() || null,
        lat: submissionLocation?.coords.latitude ?? null,
        lng: submissionLocation?.coords.longitude ?? null,
        aiPlaceholderSummary: analysisSummary,
      });
      await markTaskComplete(task.id);
      if (submissionVersion.current !== version) return;

      Alert.alert('Bukti tersimpan', 'Task selesai dan bukti pekerjaan sudah diunggah.', [
        { text: 'OK', onPress: () => router.replace('/(app)/petani') },
      ]);
    } catch (error) {
      if (submissionVersion.current !== version) return;
      Alert.alert(
        'Gagal upload bukti',
        error instanceof Error ? error.message : 'Terjadi kesalahan'
      );
    } finally {
      if (submissionVersion.current === version) {
        submissionActive.current = false;
        setSubmitting(false);
      }
    }
  }

  function renderTaskLocationCard() {
    if (!task?.requiresLocation) return null;

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
          title="Akurasi GPS belum cukup baik"
          message={unlockLocationError}
          actionLabel="Periksa Lagi"
          onAction={handleUnlock}
        />
      );
    }

    if (geofence?.unlocked) {
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
          actionLabel={result.canOpenSettings ? 'Buka Pengaturan' : 'Periksa Lagi'}
          onAction={
            result.canOpenSettings
              ? () => {
                  void openLocationSettings();
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
          onAction={() => {
            void loadDetail();
          }}
        />
      ) : !task || !plot ? (
        <FeedbackState
          title="Task tidak ditemukan"
          message="Periksa kembali task yang Anda buka."
        />
      ) : (
        <>
          <ScreenHeader
            eyebrow="Detail Tugas"
            title={task.judul}
            description={`${plot.namaLahan} · ${plot.jenisTanaman}`}
          />

          {renderTaskLocationCard()}

          <SurfaceCard>
            <AppText variant="subtitle">Instruksi</AppText>
            <AppText>
              {task.deskripsi ?? 'Kerjakan sesuai arahan internal.'}
            </AppText>
          </SurfaceCard>

          {unlocked ? (
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
                    !submitting && locationActionState.status !== 'checking',
                }}
              />
              {submitLocationError ? (
                <LocationActionCard
                  state={submitCanOpenSettings ? 'danger' : 'warning'}
                  title="Bukti belum dikirim"
                  message={submitLocationError}
                  actionLabel={
                    submitCanOpenSettings ? 'Buka Pengaturan' : undefined
                  }
                  onAction={
                    submitCanOpenSettings
                      ? () => {
                          void openLocationSettings();
                        }
                      : undefined
                  }
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
