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
        <AppText variant="small" color={Colors.muted}>
          Lokasi tidak tersedia
        </AppText>
        <AppText variant="small">
          Waktu kirim: {formatWib(attempt.createdAt)}
        </AppText>
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
      <AppText variant="small">
        Koordinat: {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </AppText>
      <AppText variant="small">
        Jarak ke titik lahan: {geofence.distanceM ?? 0} meter ·{' '}
        {locationLabel} {plot.radiusGeofenceM} meter
      </AppText>
      <AppText variant="small">
        Waktu kirim: {formatWib(attempt.createdAt)}
      </AppText>
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
    setActionFeedback(null);
    setActionError(null);
    void loadReview();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadReview]);

  const latestAttempt = attempts.at(-1) ?? null;
  const reviewableAttempt =
    task?.status !== 'selesai' && latestAttempt?.status === 'pending'
      ? latestAttempt
      : null;
  const actionsBlocked = actionPending !== null;

  async function performReview(
    decision: 'accepted' | 'revision_requested'
  ) {
    if (!reviewableAttempt || actionActive.current) return;

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
        reviewableAttempt.id,
        decision,
        decision === 'accepted' ? null : normalizedNote
      );
      const refreshed = await loadReview(false);
      if (refreshed) {
        setReviewNote('');
        setActionFeedback(
          decision === 'accepted'
            ? 'Bukti diterima.'
            : 'Perbaikan bukti diminta.'
        );
      }
    } catch {
      setActionError(
        'Keputusan bukti belum dapat disimpan. Silakan coba lagi.'
      );
    } finally {
      actionActive.current = false;
      setActionPending(null);
    }
  }

  function confirmAcceptance() {
    if (!reviewableAttempt || actionActive.current) return;
    Alert.alert(
      'Terima bukti?',
      `Percobaan ${reviewableAttempt.attemptNumber} akan diterima dan task ditandai selesai.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Terima',
          onPress: () => {
            void performReview('accepted');
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
        <AppText variant="subtitle">Detail Task</AppText>
        <AppText variant="small">Lahan: {plot.namaLahan}</AppText>
        <AppText variant="small">
          Petani: {farmer?.nama ?? plot.farmerName ?? 'Tidak tersedia'}
        </AppText>
        <AppText variant="small">
          Prioritas: {priorityLabels[task.priority]}
        </AppText>
        <AppText variant="small">Jadwal: {task.scheduledFor}</AppText>
        <AppText variant="small">
          Instruksi: {task.deskripsi ?? 'Tidak ada instruksi tambahan.'}
        </AppText>
        {task.aiReason ? (
          <AppText variant="small">Alasan AI: {task.aiReason}</AppText>
        ) : null}
        <AppText variant="small">
          Bukti lokasi: {task.requiresLocation ? 'Wajib' : 'Tidak diwajibkan'}
        </AppText>
      </SurfaceCard>

      <View style={styles.section}>
        <AppText variant="title">Riwayat Bukti</AppText>
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
          <AppText variant="subtitle">
            Review Percobaan {reviewableAttempt.attemptNumber}
          </AppText>
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
                loading={actionPending === 'revision_requested'}
                disabled={actionsBlocked}
                onPress={() => void performReview('revision_requested')}
              />
            </View>
            <View style={styles.action}>
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
