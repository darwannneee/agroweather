import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EvidenceAttemptCard } from '@/components/domain/evidence-attempt-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
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
  low: 'rendah',
  medium: 'sedang',
  high: 'tinggi',
};

type ReviewActionContext = {
  taskId: string;
  evidenceId: string;
  attemptNumber: number;
  lifecycleVersion: number;
};

function formatWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${values.day}/${values.month}/${values.year} ${values.hour}.${values.minute} WIB`;
}

function EvidenceLocation({
  attempt,
  plot,
}: {
  attempt: EvidenceAttempt;
  plot: FarmPlot;
}) {
  const hasLocation =
    attempt.latitude !== null && attempt.longitude !== null;

  if (!hasLocation) {
    return (
      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="📍" label="Lokasi bukti" tone="neutral" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Lokasi bukti</AppText>
            <AppText variant="small" color={Colors.muted}>
              Lokasi tidak tersedia
            </AppText>
          </View>
        </View>
        <InfoRow
          icon="🕒"
          label="Waktu kirim"
          value={`Waktu kirim: ${formatWib(attempt.createdAt)}`}
          tone="sky"
        />
      </SurfaceCard>
    );
  }

  const latitude = attempt.latitude as number;
  const longitude = attempt.longitude as number;
  const geofence = evaluateGeofence({
    user: { latitude, longitude },
    plot: {
      latitude: plot.latCenter,
      longitude: plot.lngCenter,
      radiusMeters: plot.radiusGeofenceM,
    },
  });
  const locationLabel = geofence.unlocked
    ? 'Di dalam radius'
    : 'Di luar radius';

  return (
    <SurfaceCard>
      <View style={styles.cardHeader}>
        <IconBadge
          icon={geofence.unlocked ? '✅' : '⚠️'}
          label="Lokasi bukti"
          tone={geofence.unlocked ? 'forest' : 'amber'}
        />
        <View style={styles.cardCopy}>
          <AppText variant="subtitle">Lokasi bukti</AppText>
          <AppText variant="small" color={Colors.muted}>
            Validasi jarak bukti terhadap radius lahan.
          </AppText>
        </View>
      </View>
      <InfoRow
        icon="🛰️"
        label="Koordinat"
        value={`Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
        tone="sky"
      />
      <InfoRow
        icon="📍"
        label="Jarak"
        value={`Jarak ke titik lahan: ${geofence.distanceM ?? 0} meter · ${locationLabel} ${plot.radiusGeofenceM} meter`}
        tone={geofence.unlocked ? 'forest' : 'amber'}
      />
      <InfoRow
        icon="🕒"
        label="Waktu kirim"
        value={`Waktu kirim: ${formatWib(attempt.createdAt)}`}
        tone="sky"
      />
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
  const [reviewNoteError, setReviewNoteError] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<
    'accepted' | 'revision_requested' | null
  >(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const actionActive = useRef(false);
  const actionLifecycleVersion = useRef(0);
  const mounted = useRef(true);
  const taskIdRef = useRef(taskId);
  const reviewableEvidenceIdRef = useRef<string | null>(null);
  taskIdRef.current = taskId;

  const loadReview = useCallback(
    async (showLoading = true): Promise<boolean> => {
      const version = ++requestVersion.current;
      if (showLoading) setLoading(true);
      setLoadError(null);

      if (!taskId) {
        setLoadError(
          'Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
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
          setLoadError(
            'Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.'
          );
        }
        return false;
      } finally {
        if (showLoading && requestVersion.current === version) {
          setLoading(false);
        }
      }
    },
    [taskId]
  );

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
  const reviewableAttempt =
    task?.status !== 'selesai' && latestAttempt?.status === 'pending'
      ? latestAttempt
      : null;
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
    return (
      mounted.current &&
      taskIdRef.current === context.taskId &&
      actionLifecycleVersion.current === context.lifecycleVersion
    );
  }

  function isCurrentReviewContext(context: ReviewActionContext): boolean {
    return (
      isCurrentRouteContext(context) &&
      reviewableEvidenceIdRef.current === context.evidenceId
    );
  }

  async function performReview(
    decision: 'accepted' | 'revision_requested',
    context: ReviewActionContext
  ) {
    if (!isCurrentReviewContext(context) || actionActive.current) return;

    const normalizedNote = reviewNote.trim();
    if (decision === 'revision_requested' && !normalizedNote) {
      setReviewNoteError('Catatan perbaikan wajib diisi.');
      return;
    }

    actionActive.current = true;
    setActionPending(decision);
    setActionFeedback(null);
    setActionError(null);
    setReviewNoteError(null);
    try {
      await reviewTaskEvidence(
        context.evidenceId,
        decision,
        decision === 'accepted' ? null : normalizedNote
      );
      if (!isCurrentRouteContext(context)) return;
      const refreshed = await loadReview(false);
      if (refreshed && isCurrentRouteContext(context)) {
        setReviewNote('');
        setActionFeedback(
          decision === 'accepted'
            ? 'Bukti diterima.'
            : 'Perbaikan bukti diminta.'
        );
      }
    } catch {
      if (isCurrentRouteContext(context)) {
        setActionError(
          'Keputusan bukti belum dapat disimpan. Silakan coba lagi.'
        );
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
      'Terima bukti?',
      `Percobaan ${context.attemptNumber} akan diterima dan task ditandai selesai.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Terima',
          onPress: () => {
            void performReview('accepted', context);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memuat detail review…" loading />
      </AppScreen>
    );
  }

  if (loadError || !task || !plot) {
    return (
      <AppScreen>
        <FeedbackState
          title="Review bukti belum tersedia"
          message={
            loadError ??
            'Detail review belum dapat dimuat. Periksa koneksi lalu coba lagi.'
          }
          actionLabel="Coba Lagi"
          onAction={() => void loadReview()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Review Bukti Task"
        title={task.judul}
        description="Periksa riwayat bukti tersimpan sebelum memberi keputusan."
      />

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="📝" label="Detail Task" tone="forest" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Detail Task</AppText>
            <AppText variant="small" color={Colors.muted}>
              Konteks pekerjaan sebelum memberi keputusan review.
            </AppText>
          </View>
        </View>
        <InfoRow icon="🌾" label="Lahan" value={`Lahan: ${plot.namaLahan}`} />
        <InfoRow
          icon="👨‍🌾"
          label="Petani"
          value={`Petani: ${farmer?.nama ?? plot.farmerName ?? 'Tidak tersedia'}`}
          tone="sky"
        />
        <InfoRow
          icon="🚦"
          label="Prioritas"
          value={`Prioritas: ${priorityLabels[task.priority]}`}
          tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'amber' : 'forest'}
        />
        <InfoRow
          icon="📅"
          label="Jadwal"
          value={`Jadwal: ${task.scheduledFor}`}
          tone="sky"
        />
        <InfoRow
          icon="📋"
          label="Instruksi"
          value={`Instruksi: ${task.deskripsi ?? 'Tidak ada instruksi tambahan.'}`}
        />
        {task.aiReason ? (
          <InfoRow
            icon="🤖"
            label="Alasan AI"
            value={`Alasan AI: ${task.aiReason}`}
            tone="amber"
          />
        ) : null}
        <InfoRow
          icon={task.requiresLocation ? '📍' : '📎'}
          label="Bukti lokasi"
          value={`Bukti lokasi: ${task.requiresLocation ? 'Wajib' : 'Tidak diwajibkan'}`}
          tone={task.requiresLocation ? 'forest' : 'neutral'}
        />
      </SurfaceCard>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <IconBadge icon="📸" label="Riwayat Bukti" tone="sky" />
          <View style={styles.cardCopy}>
            <AppText variant="title">Riwayat Bukti</AppText>
            <AppText variant="small" color={Colors.muted}>
              Bukti terbaru yang pending bisa diterima atau diminta revisi.
            </AppText>
          </View>
        </View>
        {attempts.length > 0 ? (
          attempts.map((attempt) => (
            <View key={attempt.id} style={styles.attempt}>
              <EvidenceAttemptCard attempt={attempt} />
              <EvidenceLocation attempt={attempt} plot={plot} />
            </View>
          ))
        ) : task.status === 'selesai' ? (
          <SurfaceCard>
            <AppText variant="small" color={Colors.muted}>
              Diselesaikan sebelum alur review bukti
            </AppText>
          </SurfaceCard>
        ) : (
          <FeedbackState
            title="Belum ada bukti"
            message="Bukti yang dikirim petani akan muncul di sini."
          />
        )}
      </View>

      {reviewableAttempt ? (
        <SurfaceCard>
          <View style={styles.cardHeader}>
            <IconBadge icon="⚖️" label="Review Percobaan" tone="amber" />
            <View style={styles.cardCopy}>
              <AppText variant="subtitle">
                Review Percobaan {reviewableAttempt.attemptNumber}
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Beri keputusan untuk bukti pending terbaru.
              </AppText>
            </View>
          </View>
          <FormField
            label="Catatan perbaikan"
            error={reviewNoteError}
            help="Wajib diisi jika bukti perlu diperbaiki."
            inputProps={{
              accessibilityLabel: 'Catatan perbaikan',
              value: reviewNote,
              editable: !actionsBlocked,
              maxLength: 1_000,
              multiline: true,
              onChangeText: setReviewNote,
            }}
          />
          {actionError ? (
            <AppText
              variant="smallStrong"
              color={Colors.dangerText}
              accessibilityLiveRegion="polite"
            >
              {actionError}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <AppButton
                label="Minta Perbaikan"
                variant="danger"
                icon="↺"
                loading={actionPending === 'revision_requested'}
                disabled={actionsBlocked}
                onPress={() => {
                  const context = reviewActionContext();
                  if (context) {
                    void performReview('revision_requested', context);
                  }
                }}
              />
            </View>
            <View style={styles.action}>
              <AppButton
                label="Terima Bukti"
                variant="forest"
                icon="✓"
                loading={actionPending === 'accepted'}
                disabled={actionsBlocked}
                onPress={confirmAcceptance}
              />
            </View>
          </View>
        </SurfaceCard>
      ) : null}

      {actionFeedback ? (
        <AppText
          variant="smallStrong"
          color={Colors.successText}
          accessibilityLiveRegion="polite"
        >
          {actionFeedback}
        </AppText>
      ) : null}
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  cardCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  attempt: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
