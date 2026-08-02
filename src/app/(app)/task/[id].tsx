import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { EvidenceAttemptCard } from '@/components/domain/evidence-attempt-card';
import {
  EvidencePicker,
  type EvidenceAsset,
} from '@/components/domain/evidence-picker';
import { LocationActionCard } from '@/components/domain/location-action-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
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

const priorityColors: Record<TaskPriority, string> = {
  low: Colors.forest,
  medium: Colors.amberText,
  high: Colors.dangerText,
};

const TASK_LOAD_ERROR = 'Detail task belum dapat dimuat. Silakan coba lagi.';
const TASK_ASSIGNMENT_ERROR = 'Task ini tidak ditugaskan kepada akun Anda.';
const EVIDENCE_UPLOAD_ERROR = 'Bukti belum dapat diunggah. Periksa koneksi lalu coba lagi.';
const TASK_START_ERROR = 'Lokasi valid, tetapi task belum dapat dimulai. Periksa koneksi lalu coba lagi.';

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

function locationSettingsStatus(result?: CurrentLocationResult): LocationSettingsStatus | null {
  if (result?.status === 'permission-blocked' || result?.status === 'services-disabled') {
    return result.status;
  }
  return null;
}

function mergeRegisteredAttempt(attempts: EvidenceAttempt[], registered: EvidenceAttempt): EvidenceAttempt[] {
  const merged = attempts.some(({ id }) => id === registered.id) ? attempts : [...attempts, registered];
  return [...merged].sort((a, b) => a.attemptNumber - b.attemptNumber);
}

// --- Komponen Lokal UI ---
function LocalDetailRow({ icon, label, value, colorTone }: { icon: keyof typeof Feather.glyphMap, label: string, value: string, colorTone: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconBox}>
        <Feather name={icon} size={16} color={colorTone} />
      </View>
      <View style={styles.detailTextContainer}>
        <AppText variant="smallStrong" color={Colors.ink}>{label}</AppText>
        <AppText variant="small" color={Colors.muted}>{value}</AppText>
      </View>
    </View>
  );
}

// Tombol kustom untuk menghindari error Type AppButton bawaan
function ActionButton({ label, icon, onPress, disabled, loading }: { label: string, icon: keyof typeof Feather.glyphMap, onPress: () => void, disabled?: boolean, loading?: boolean }) {
  return (
    <Pressable 
      onPress={onPress} 
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionButton,
        (pressed || disabled || loading) && styles.actionButtonPressed
      ]}
    >
      <Feather name={icon} size={18} color={Colors.surface} />
      <AppText variant="bodyStrong" color={Colors.surface}>
        {loading ? 'Memproses...' : label}
      </AppText>
    </Pressable>
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
  const [unlockReading, setUnlockReading] = useState<GrantedLocationResult | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockLocationError, setUnlockLocationError] = useState<string | null>(null);
  const [submitLocationError, setSubmitLocationError] = useState<string | null>(null);
  const [submitSettingsStatus, setSubmitSettingsStatus] = useState<LocationSettingsStatus | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [asset, setAsset] = useState<EvidenceAsset | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const latestAttempt = attempts.at(-1) ?? null;
  const pendingReview = latestAttempt?.status === 'pending';
  const revisionNeeded = latestAttempt?.status === 'revision_requested';
  const completed = task?.status === 'selesai' || latestAttempt?.status === 'accepted';

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
          current ? { ...current, status: 'sedang_dikerjakan' } : current
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

  function showSubmitLocationError(message: string, result?: CurrentLocationResult) {
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
            fresh.status === 'low-accuracy' ? submissionReadingErrorMessage() : fresh.message,
            fresh
          );
          return;
        }

        const readingIssue = validateLocationReading(
          { ...fresh.coords, accuracyM: fresh.accuracyM, timestamp: fresh.timestamp },
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
        current ? { ...current, status: 'sedang_dikerjakan', latestEvidence: { status: 'pending', reviewNote: null } } : current
      );
      setAsset(null);
      setNote('');
      setUnlocked(false);
      setSubmissionFeedback('Bukti terkirim dan menunggu review internal');

      try {
        const [nextTask, nextAttempts] = await Promise.all([
          fetchTaskDetail(task.id),
          fetchTaskEvidenceAttempts(task.id),
        ]);
        if (submissionVersion.current === version && nextTask.assignedTo === farmerId) {
          setTask(nextTask);
          setAttempts(mergeRegisteredAttempt(nextAttempts, registered));
        }
      } catch {
        // Registration already succeeded.
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
          onAction={settingsStatus ? () => { void openLocationSettings(settingsStatus); } : handleUnlock}
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
        <View style={styles.contentContainer}>
          {/* Header Action / Title - Modernized */}
          <View style={styles.titleArea}>
            <AppText variant="display" color={Colors.ink}>{task.judul}</AppText>
            <View style={styles.titleMeta}>
              <Feather name="map" size={14} color={Colors.muted} />
              <AppText variant="small" color={Colors.muted}>
                {plot.namaLahan} · {plot.jenisTanaman}
              </AppText>
            </View>
          </View>

          {/* Ringkasan Task Modern */}
          <SurfaceCard style={styles.cardLayout}>
            <View style={styles.cardHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.mint }]}>
                <Feather name="file-text" size={20} color={Colors.forest} />
              </View>
              <View style={styles.cardCopy}>
                <AppText variant="subtitle">Ringkasan Task</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Instruksi dan jadwal penugasan.
                </AppText>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.detailInfoGrid}>
               <LocalDetailRow icon="flag" label="Prioritas" value={priorityLabels[task.priority]} colorTone={priorityColors[task.priority]} />
               <LocalDetailRow icon="calendar" label="Jadwal" value={task.scheduledFor} colorTone={Colors.ink} />
               <LocalDetailRow icon="align-left" label="Instruksi" value={task.deskripsi ?? 'Kerjakan sesuai arahan.'} colorTone={Colors.ink} />
               {task.aiReason && (
                 <LocalDetailRow icon="cpu" label="Alasan AI" value={task.aiReason} colorTone={Colors.amberText} />
               )}
               <LocalDetailRow 
                 icon={task.requiresLocation ? "map-pin" : "paperclip"} 
                 label="Bukti GPS" 
                 value={task.requiresLocation ? 'Wajib di lokasi' : 'Opsional'} 
                 colorTone={task.requiresLocation ? Colors.forest : Colors.muted} 
               />
            </View>
          </SurfaceCard>

          {/* Riwayat Bukti Section */}
          {attempts.length > 0 && (
            <View style={styles.sectionMargin}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: Colors.sky }]}>
                  <Feather name="camera" size={20} color={Colors.skyText} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText variant="subtitle">Riwayat Bukti</AppText>
                  <AppText variant="small" color={Colors.muted}>
                    Catatan pengiriman untuk task ini.
                  </AppText>
                </View>
              </View>
              <View style={styles.attemptsContainer}>
                {attempts.map((attempt) => (
                  <EvidenceAttemptCard key={attempt.id} attempt={attempt} />
                ))}
              </View>
            </View>
          )}

          {/* Status Workflow Section */}
          {completed ? (
            <SurfaceCard style={styles.cardLayout}>
              <View style={styles.cardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: Colors.successBackground }]}>
                  <Feather name="check-circle" size={20} color={Colors.forest} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText variant="subtitle" color={Colors.forest}>Task Selesai</AppText>
                  <AppText variant="small" color={Colors.muted}>Status akhir telah disetujui.</AppText>
                </View>
              </View>
            </SurfaceCard>
          ) : pendingReview ? (
            <SurfaceCard style={styles.cardLayout}>
              <View style={styles.cardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: Colors.warningBackground }]}>
                  <Feather name="clock" size={20} color={Colors.amberText} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText variant="subtitle" color={Colors.amberText}>Menunggu Review</AppText>
                  <AppText variant="small" color={Colors.muted}>Bukti sedang diperiksa oleh internal.</AppText>
                </View>
              </View>
            </SurfaceCard>
          ) : revisionNeeded ? (
            <SurfaceCard style={styles.cardLayout}>
              <View style={styles.cardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: Colors.dangerBackground }]}>
                  <Feather name="alert-triangle" size={20} color={Colors.dangerText} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText variant="subtitle" color={Colors.dangerText}>Perlu Perbaikan</AppText>
                  <AppText variant="small" color={Colors.muted}>Ikuti catatan reviewer untuk kirim ulang.</AppText>
                </View>
              </View>
              <View style={styles.divider} />
              <AppText variant="smallStrong" color={Colors.dangerText}>Catatan Reviewer:</AppText>
              <AppText variant="small" color={Colors.ink}>{latestAttempt?.reviewNote ?? '-'}</AppText>
            </SurfaceCard>
          ) : null}

          {submissionFeedback && (
            <AppText variant="smallStrong" color={Colors.successText} style={{ textAlign: 'center', marginTop: Spacing.two }}>
              {submissionFeedback}
            </AppText>
          )}

          {renderTaskLocationCard()}

          {/* Form Pengiriman Bukti Baru */}
          {unlocked && !pendingReview && !completed && (
            <View style={styles.submissionSection}>
               <AppText variant="subtitle" style={{ marginBottom: Spacing.two }}>Unggah Bukti Baru</AppText>
              <EvidencePicker
                asset={asset}
                onChange={setAsset}
                disabled={submitting || locationActionState.status === 'checking'}
              />
              <FormField
                label="Catatan Lapangan"
                inputProps={{
                  accessibilityLabel: 'Catatan Lapangan',
                  value: note,
                  onChangeText: setNote,
                  placeholder: 'Cth: Gulma sudah dibersihkan',
                  multiline: true,
                  editable: !submitting && locationActionState.status !== 'checking',
                }}
              />
              {submitLocationError && (
                <LocationActionCard
                  state={submitSettingsStatus ? 'danger' : 'warning'}
                  title="Bukti belum dikirim"
                  message={submitLocationError}
                  actionLabel={submitSettingsStatus ? 'Buka Pengaturan' : undefined}
                  onAction={submitSettingsStatus ? () => { void openLocationSettings(submitSettingsStatus); } : undefined}
                />
              )}
              {submissionError && (
                <LocationActionCard state="warning" title="Bukti belum tersimpan" message={submissionError} />
              )}
              
              <View style={styles.submitBtn}>
                <ActionButton
                  label={task.requiresLocation ? 'Periksa GPS & Kirim' : 'Kirim Bukti'}
                  icon={task.requiresLocation ? 'map-pin' : 'upload'}
                  loading={submitting}
                  disabled={locationActionState.status === 'checking' || !asset}
                  onPress={handleSubmit}
                />
              </View>
            </View>
          )}
        </View>
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

const styles = StyleSheet.create({
  contentContainer: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  titleArea: {
    marginBottom: Spacing.two,
  },
  titleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cardLayout: {
    padding: Spacing.four,
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sectionIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.four,
  },
  detailInfoGrid: {
    gap: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  detailIconBox: {
    width: 24,
    alignItems: 'center',
    paddingTop: 2,
  },
  detailTextContainer: {
    flex: 1,
  },
  sectionMargin: {
    marginTop: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  attemptsContainer: {
    gap: Spacing.three,
  },
  submissionSection: {
    marginTop: Spacing.four,
    gap: Spacing.four,
  },
  submitBtn: {
    marginTop: Spacing.two,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.forest,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.button,
    minHeight: 48,
  },
  actionButtonPressed: {
    opacity: 0.7,
  }
});