import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type {
  EvidenceAttempt,
  FarmPlot,
  FarmTask,
  TaskPriority,
} from '@/lib/farm-types';
import { evaluateGeofence } from '@/lib/geofence';
import { fetchUserProfile } from '@/services/auth';
import {
  fetchTaskEvidenceAttempts,
  reviewTaskEvidence,
} from '@/services/evidence';
import { fetchPlotById } from '@/services/plots';
import type { AppUser } from '@/services/supabase';
import { fetchTaskDetail } from '@/services/tasks';

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

type ReviewActionContext = {
  taskId: string;
  evidenceId: string;
  attemptNumber: number;
  lifecycleVersion: number;
};

function Divider() {
  return <View style={styles.divider} />;
}

function SectionHeader({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={22} color={Colors.forest} />
      </View>
      <View style={styles.sectionHeaderCopy}>
        <AppText variant="subtitle">{title}</AppText>
        {subtitle ? <AppText variant="small" color={Colors.muted}>{subtitle}</AppText> : null}
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value, valueColor }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={18} color={Colors.muted} style={styles.detailIcon} />
      <View style={styles.detailContent}>
        <AppText variant="small" color={Colors.muted}>{label}</AppText>
        <AppText variant="bodyStrong" color={valueColor || Colors.ink}>{value}</AppText>
      </View>
    </View>
  );
}

function formatWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';

  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${parts} WIB`;
}

function EvidenceViewer({ attempt, plot }: { attempt: EvidenceAttempt; plot: FarmPlot }) {
  const hasLocation = attempt.latitude !== null && attempt.longitude !== null;
  const isPending = attempt.status === 'pending';
  const isAccepted = attempt.status === 'accepted';
  
  const statusColor = isAccepted ? Colors.forest : (isPending ? '#D97706' : Colors.dangerText);
  const statusLabel = isAccepted ? 'Diterima' : (isPending ? 'Menunggu Review' : 'Revisi Diminta');
  const statusIcon = isAccepted ? 'checkmark-circle' : (isPending ? 'time' : 'alert-circle');

  let geofence = null;
  let locationLabel = 'Lokasi tidak tersedia';
  let locationColor: string = Colors.muted; 
  let locationIcon: keyof typeof Ionicons.glyphMap = 'location-outline';

  if (hasLocation) {
    geofence = evaluateGeofence({
      user: { latitude: attempt.latitude as number, longitude: attempt.longitude as number },
      plot: { latitude: plot.latCenter, longitude: plot.lngCenter, radiusMeters: plot.radiusGeofenceM },
    });
    const unlocked = geofence.unlocked;
    locationLabel = unlocked ? 'Sesuai Radius Lahan' : 'Di Luar Radius Lahan';
    locationColor = unlocked ? Colors.forest : '#D97706';
    locationIcon = unlocked ? 'checkmark-circle-outline' : 'warning-outline';
  }

  return (
    <SurfaceCard style={styles.evidenceCard}>
      <View style={styles.evidenceHeader}>
        <View style={styles.evidenceHeaderLeft}>
          <AppText variant="subtitle">Percobaan {attempt.attemptNumber}</AppText>
          <AppText variant="small" color={Colors.muted}>{formatWib(attempt.createdAt)}</AppText>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: `${statusColor}10` }]}>
          <Ionicons name={statusIcon} size={14} color={statusColor} />
          <AppText variant="smallStrong" color={statusColor}>{statusLabel}</AppText>
        </View>
      </View>

      {attempt.photoUrl ? (
        <Image 
          accessibilityLabel={`Foto percobaan ${attempt.attemptNumber}`}
          source={{ uri: attempt.photoUrl }} 
          style={styles.evidencePhoto} 
          resizeMode="cover" 
        />
      ) : (
        <View style={styles.noPhotoBox}>
          <Ionicons name="image-outline" size={32} color={Colors.border} />
          <AppText variant="small" color={Colors.muted}>Foto tidak dilampirkan</AppText>
        </View>
      )}

      <View style={styles.evidenceDetails}>
        <DetailItem icon="document-text-outline" label="Catatan Petani" value={attempt.note || '-'} />
        {attempt.reviewNote && (
          <DetailItem icon="chatbox-ellipses-outline" label="Catatan Evaluasi" value={attempt.reviewNote} valueColor={Colors.dangerText} />
        )}
      </View>

      <Divider />

      <View style={styles.locationWrapper}>
        <View style={styles.locationTitleRow}>
          <Ionicons name={locationIcon} size={18} color={locationColor} />
          <AppText variant="smallStrong" color={locationColor}>{locationLabel}</AppText>
        </View>
        
        {hasLocation && geofence && (
          <View style={styles.locationGrid}>
            <View style={styles.locationGridItem}>
              <AppText variant="label" color={Colors.muted}>Koordinat GPS</AppText>
              <AppText variant="smallStrong">{Number(attempt.latitude).toFixed(5)}, {Number(attempt.longitude).toFixed(5)}</AppText>
            </View>
            <View style={styles.locationGridItem}>
              <AppText variant="label" color={Colors.muted}>Jarak ke Pusat</AppText>
              <AppText variant="smallStrong">{geofence.distanceM ?? 0} meter</AppText>
            </View>
          </View>
        )}
      </View>
    </SurfaceCard>
  );
}

export function TaskReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [task, setTask] = useState<FarmTask | null>(null);
  const [plot, setPlot] = useState<FarmPlot | null>(null);
  const [farmer, setFarmer] = useState<AppUser | null>(null);
  const [attempts, setAttempts] = useState<EvidenceAttempt[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewNoteError, setReviewNoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<'accepted' | 'revision_requested' | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const requestVersion = useRef(0);
  const actionActive = useRef(false);
  const actionLifecycleVersion = useRef(0);
  const mounted = useRef(true);
  const taskIdRef = useRef(taskId);
  const reviewableEvidenceIdRef = useRef<string | null>(null);
  taskIdRef.current = taskId;

  const loadReview = useCallback(async (showLoading = true): Promise<boolean> => {
    const version = ++requestVersion.current;
    if (showLoading) setLoading(true);
    setLoadError(null);

    if (!taskId) {
      setLoadError('Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      if (showLoading) setLoading(false);
      return false;
    }

    try {
      const nextTask = await fetchTaskDetail(taskId);
      if (requestVersion.current !== version) return false;
      const [nextPlot, nextFarmer, nextAttempts] = await Promise.all([
        fetchPlotById(nextTask.lahanId),
        fetchUserProfile(nextTask.assignedTo),
        fetchTaskEvidenceAttempts(nextTask.id),
      ]);
      if (requestVersion.current !== version) return false;

      setTask(nextTask);
      setPlot(nextPlot);
      setFarmer(nextFarmer);
      setAttempts(nextAttempts);
      return true;
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      }
      return false;
    } finally {
      if (showLoading && requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [taskId]);

  useEffect(() => {
    const lifecycleVersion = ++actionLifecycleVersion.current;
    actionActive.current = false;
    setActionPending(null);
    setActionFeedback(null);
    setActionError(null);
    void loadReview();
    return () => {
      requestVersion.current += 1;
      if (actionLifecycleVersion.current === lifecycleVersion) {
        actionLifecycleVersion.current += 1;
      }
    };
  }, [loadReview]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      actionLifecycleVersion.current += 1;
      actionActive.current = false;
      requestVersion.current += 1;
    };
  }, []);

  const latestAttempt = attempts.at(-1) ?? null;
  const reviewableAttempt = task?.status !== 'selesai' && latestAttempt?.status === 'pending' ? latestAttempt : null;
  reviewableEvidenceIdRef.current = reviewableAttempt?.id ?? null;
  const actionsBlocked = actionPending !== null;

  function reviewActionContext(): ReviewActionContext | null {
    if (!taskId || !reviewableAttempt) return null;
    return {
      taskId,
      evidenceId: reviewableAttempt.id,
      attemptNumber: reviewableAttempt.attemptNumber,
      lifecycleVersion: actionLifecycleVersion.current,
    };
  }

  function isCurrentRouteContext(context: ReviewActionContext): boolean {
    return mounted.current && taskIdRef.current === context.taskId && actionLifecycleVersion.current === context.lifecycleVersion;
  }

  function isCurrentReviewContext(context: ReviewActionContext): boolean {
    return isCurrentRouteContext(context) && reviewableEvidenceIdRef.current === context.evidenceId;
  }

  async function performReview(decision: 'accepted' | 'revision_requested', context: ReviewActionContext) {
    if (!isCurrentReviewContext(context) || actionActive.current) return;

    const normalizedNote = reviewNote.trim();
    if (decision === 'revision_requested' && !normalizedNote) {
      setReviewNoteError('Catatan revisi wajib diisi agar petani mengerti kekurangannya.');
      return;
    }

    actionActive.current = true;
    setActionPending(decision);
    setActionFeedback(null);
    setActionError(null);
    setReviewNoteError(null);
    
    try {
      await reviewTaskEvidence(context.evidenceId, decision, decision === 'accepted' ? null : normalizedNote);
      if (!isCurrentRouteContext(context)) return;
      const refreshed = await loadReview(false);
      if (refreshed && isCurrentRouteContext(context)) {
        setReviewNote('');
        setActionFeedback(decision === 'accepted' ? 'Bukti diterima. Tugas telah diselesaikan.' : 'Permintaan revisi telah dikirim ke petani.');
      }
    } catch {
      if (isCurrentRouteContext(context)) {
        setActionError('Gagal memproses keputusan. Silakan periksa koneksi internet Anda.');
      }
    } finally {
      if (isCurrentRouteContext(context)) {
        actionActive.current = false;
        setActionPending(null);
      }
    }
  }

  function confirmAcceptance() {
    const context = reviewActionContext();
    if (!context || actionActive.current) return;
    Alert.alert(
      'Setujui Pekerjaan?',
      `Tugas ini akan ditandai selesai dan petani akan mendapatkan notifikasi persetujuan.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Setujui', onPress: () => void performReview('accepted', context) },
      ]
    );
  }

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Mempersiapkan data..." loading />
      </AppScreen>
    );
  }

  if (loadError || !task || !plot) {
    return (
      <AppScreen>
        <FeedbackState
          title="Gagal Memuat Data"
          message={loadError ?? 'Terjadi kesalahan sistem.'}
          actionLabel="Muat Ulang"
          onAction={() => void loadReview()}
        />
      </AppScreen>
    );
  }

  // Menggunakan Hardcoded Hex Colors agar dijamin kontras dengan background putih.
  const priorityColor = 
    task.priority === 'high' ? '#DC2626' : // Merah Gelap (Tailwind Red 600)
    task.priority === 'medium' ? '#D97706' : // Oranye Gelap (Tailwind Amber 600)
    '#059669'; // Hijau Gelap (Tailwind Emerald 600)

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: Spacing.seven, paddingTop: Spacing.two }}>
      <SurfaceCard style={styles.cardSection}>
        {/* Judul Dipindah ke Dalam Card */}
        <View style={styles.cardTitleArea}>
          <AppText variant="title">{task.judul}</AppText>
          <AppText variant="body" color={Colors.muted}>Evaluasi bukti pelaksanaan tugas</AppText>
        </View>

        <Divider />
        <SectionHeader icon="information-circle-outline" title="Informasi Pekerjaan" />
        
        <DetailItem icon="leaf-outline" label="Lokasi Lahan" value={plot.namaLahan} />
        <DetailItem icon="person-outline" label="Dikerjakan Oleh" value={farmer?.nama ?? plot.farmerName ?? 'Anonim'} />
        <DetailItem icon="flag-outline" label="Tingkat Prioritas" value={priorityLabels[task.priority]} valueColor={priorityColor} />
        <DetailItem icon="calendar-outline" label="Jadwal Eksekusi" value={task.scheduledFor} />
        <DetailItem icon="list-outline" label="Instruksi Utama" value={task.deskripsi ?? 'Tidak ada instruksi khusus.'} />
        {task.aiReason && <DetailItem icon="hardware-chip-outline" label="Dasar Rekomendasi AI" value={task.aiReason} valueColor={Colors.skyText} />}
        <DetailItem icon="location-outline" label="Syarat Lokasi" value={task.requiresLocation ? 'Wajib di Area Lahan' : 'Bebas'} />
      </SurfaceCard>

      <View style={styles.historySection}>
        <AppText variant="subtitle" style={styles.sectionHeading}>Riwayat Pengiriman Bukti</AppText>
        
        {attempts.length > 0 ? (
          attempts.map((attempt) => (
            <EvidenceViewer key={attempt.id} attempt={attempt} plot={plot} />
          ))
        ) : task.status === 'selesai' ? (
          <SurfaceCard style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={Colors.forest} style={{ marginBottom: 8 }} />
            <AppText variant="smallStrong">Tugas Diselesaikan Otomatis</AppText>
            <AppText variant="small" color={Colors.muted}>Tidak ada bukti foto yang dilampirkan.</AppText>
          </SurfaceCard>
        ) : (
          <FeedbackState title="Belum Ada Bukti" message="Petani belum mengunggah hasil pekerjaan." />
        )}
      </View>

      {reviewableAttempt && (
        <View style={styles.reviewFormArea}>
          <SurfaceCard style={styles.activeReviewCard}>
            <SectionHeader icon="shield-checkmark-outline" title="Formulir Evaluasi" subtitle="Berikan keputusan untuk bukti terbaru" />
            <Divider />
            
            <FormField
              label="Catatan Revisi (Opsional)"
              error={reviewNoteError}
              leftIcon={<Ionicons name="create-outline" size={20} color={Colors.muted} />}
              inputProps={{
                placeholder: 'Berikan alasan jika bukti ditolak...',
                value: reviewNote,
                editable: !actionsBlocked,
                maxLength: 1_000,
                multiline: true,
                onChangeText: setReviewNote,
              }}
            />

            {actionError && (
              <AppText variant="smallStrong" color={Colors.dangerText} style={{ marginTop: Spacing.two }}>
                {actionError}
              </AppText>
            )}

            <View style={styles.actionButtons}>
              <View style={styles.btnWrapper}>
                <AppButton
                  label="Minta Revisi"
                  variant="danger"
                  loading={actionPending === 'revision_requested'}
                  disabled={actionsBlocked}
                  onPress={() => {
                    const context = reviewActionContext();
                    if (context) void performReview('revision_requested', context);
                  }}
                />
              </View>
              <View style={styles.btnWrapper}>
                <AppButton
                  label="Terima Bukti"
                  variant="forest"
                  loading={actionPending === 'accepted'}
                  disabled={actionsBlocked}
                  onPress={confirmAcceptance}
                />
              </View>
            </View>
          </SurfaceCard>
        </View>
      )}

      {actionFeedback && (
        <SurfaceCard style={styles.successFeedback}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.forest} />
          <AppText variant="smallStrong" color={Colors.forest}>{actionFeedback}</AppText>
        </SurfaceCard>
      )}
    </AppScreen>
  );
}

export default function TaskReviewRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <TaskReviewScreen />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  cardTitleArea: {
    marginBottom: Spacing.one,
  },
  cardSection: {
    padding: Spacing.four,
    gap: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.button,
    backgroundColor: `${Colors.forest}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.four,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  detailIcon: {
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  historySection: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  sectionHeading: {
    marginLeft: Spacing.one,
    marginBottom: Spacing.one,
  },
  evidenceCard: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.four,
  },
  evidenceHeaderLeft: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  evidencePhoto: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.canvas,
  },
  noPhotoBox: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  evidenceDetails: {
    padding: Spacing.four,
    paddingBottom: 0,
  },
  locationWrapper: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  locationGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.canvas,
    borderRadius: Radius.input,
    padding: Spacing.three,
  },
  locationGridItem: {
    flex: 1,
    gap: 2,
  },
  reviewFormArea: {
    marginTop: Spacing.four,
  },
  activeReviewCard: {
    borderColor: Colors.border,
    borderWidth: 1.5,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  btnWrapper: {
    flex: 1,
  },
  successFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: `${Colors.forest}15`,
    borderColor: Colors.forest,
    marginTop: Spacing.four,
  },
});