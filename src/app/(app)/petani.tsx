import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { LocationActionCard } from '@/components/domain/location-action-card';
import { TaskCard, type TaskCardState } from '@/components/domain/task-card';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
import { useLocationAction } from '@/hooks/use-location-action';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import { evaluateGeofence } from '@/lib/geofence';
import {
  findNearestActivePlot,
  LOCATION_MAX_ACCURACY_M,
  validateLocationReading,
  type LocationReadingIssue,
} from '@/lib/location-policy';
import {
  checkInIfInsideRadius,
  type CheckInResult,
} from '@/services/attendance';
import { useAuth } from '@/services/auth-context';
import {
  type GrantedLocationResult,
  openLocationSettings,
} from '@/services/location';
import { fetchAssignedPlots } from '@/services/plots';
import { fetchFarmerTasks } from '@/services/tasks';

type AttendanceOutcome =
  | { kind: 'no-active-plot' }
  | { kind: 'reading-error'; issue: LocationReadingIssue; plot: FarmPlot }
  | { kind: 'checked'; plot: FarmPlot; result: CheckInResult }
  | { kind: 'network-error'; plot: FarmPlot };

type TaskViewModel = {
  task: FarmTask;
  plot: FarmPlot | null;
  state: TaskCardState;
};

function formatDistance(distanceM: number | null): string {
  if (distanceM === null) return 'Jarak tidak tersedia';
  if (distanceM < 1000) return `${distanceM} meter`;
  return `${(distanceM / 1000).toFixed(2)} km`;
}

function readingIssueMessage(
  issue: LocationReadingIssue,
  plot: FarmPlot
): string {
  switch (issue) {
    case 'invalid-coordinates':
      return 'Koordinat GPS tidak valid. Periksa pengaturan lokasi lalu coba lagi.';
    case 'missing-accuracy':
      return 'Akurasi GPS tidak tersedia. Pindah ke area terbuka lalu periksa lagi.';
    case 'stale':
      return 'Data GPS sudah kedaluwarsa. Periksa lagi untuk mengambil lokasi baru.';
    case 'low-accuracy':
      return `Akurasi GPS belum cukup untuk radius ${plot.radiusGeofenceM} meter. Pindah ke area terbuka lalu periksa lagi.`;
  }
}

function taskState(
  task: FarmTask,
  plot: FarmPlot | null,
  reading: GrantedLocationResult | null
): TaskCardState {
  if (task.status === 'selesai') return 'completed';
  if (!task.requiresLocation) return 'ready';
  if (!plot || !reading) return 'check-location';

  const issue = validateLocationReading(
    {
      ...reading.coords,
      accuracyM: reading.accuracyM,
      timestamp: reading.timestamp,
    },
    plot.radiusGeofenceM
  );
  if (issue) return 'check-location';

  const result = evaluateGeofence({
    user: reading.coords,
    plot: {
      latitude: plot.latCenter,
      longitude: plot.lngCenter,
      radiusMeters: plot.radiusGeofenceM,
    },
  });
  return result.unlocked ? 'ready' : 'outside';
}

export function PetaniDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const {
    state: locationState,
    run: runLocationAction,
    reset: resetLocationAction,
  } = useLocationAction();
  const farmerId = profile?.id;
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [validatedReading, setValidatedReading] =
    useState<GrantedLocationResult | null>(null);
  const [attendanceOutcome, setAttendanceOutcome] =
    useState<AttendanceOutcome | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const attendanceRequestVersion = useRef(0);
  const attendanceInFlight = useRef(false);
  const mounted = useRef(true);
  const farmerIdRef = useRef(farmerId);
  farmerIdRef.current = farmerId;

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    if (!farmerId) {
      if (requestVersion.current === version) {
        setPlots([]);
        setTasks([]);
        setLoading(false);
      }
      return;
    }

    try {
      const [nextPlots, nextTasks] = await Promise.all([
        fetchAssignedPlots(farmerId),
        fetchFarmerTasks(farmerId),
      ]);
      if (requestVersion.current === version) {
        setPlots(nextPlots);
        setTasks(nextTasks);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Data lahan dan tugas belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [farmerId]);

  useEffect(() => {
    void loadDashboard();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attendanceRequestVersion.current += 1;
      attendanceInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    attendanceRequestVersion.current += 1;
    attendanceInFlight.current = false;
    setAttendanceBusy(false);
    setAttendanceOutcome(null);
    setValidatedReading(null);
    resetLocationAction();
  }, [farmerId, resetLocationAction]);

  const activePlotCount = useMemo(
    () => plots.filter((plot) => plot.status === 'aktif').length,
    [plots]
  );

  const taskViewModels = useMemo(() => {
    const plotsById = new Map(plots.map((plot) => [plot.id, plot]));
    return tasks.map((currentTask): TaskViewModel => {
      const plot = plotsById.get(currentTask.lahanId) ?? null;
      return {
        task: currentTask,
        plot,
        state: taskState(currentTask, plot, validatedReading),
      };
    });
  }, [plots, tasks, validatedReading]);

  const readyTasks = taskViewModels.filter((item) => item.state === 'ready');
  const locationTasks = taskViewModels.filter(
    (item) => item.state === 'check-location' || item.state === 'outside'
  );
  const completedTasks = taskViewModels.filter(
    (item) => item.state === 'completed'
  );

  const checkAttendance = useCallback(async () => {
    if (!farmerId || attendanceInFlight.current) return;

    attendanceInFlight.current = true;
    const version = ++attendanceRequestVersion.current;
    const requestFarmerId = farmerId;
    const isCurrentRequest = () =>
      mounted.current &&
      attendanceRequestVersion.current === version &&
      farmerIdRef.current === requestFarmerId;

    setAttendanceBusy(true);
    setAttendanceOutcome(null);
    setValidatedReading(null);

    try {
      const location = await runLocationAction({
        maxAccuracyM: LOCATION_MAX_ACCURACY_M,
      });
      if (!isCurrentRequest() || location.status !== 'granted') return;

      const nearest = findNearestActivePlot(plots, location.coords);
      if (!nearest) {
        setAttendanceOutcome({ kind: 'no-active-plot' });
        return;
      }

      const issue = validateLocationReading(
        {
          ...location.coords,
          accuracyM: location.accuracyM,
          timestamp: location.timestamp,
        },
        nearest.plot.radiusGeofenceM
      );
      if (issue) {
        setAttendanceOutcome({
          kind: 'reading-error',
          issue,
          plot: nearest.plot,
        });
        return;
      }

      setValidatedReading(location);
      try {
        const result = await checkInIfInsideRadius({
          farmerId: requestFarmerId,
          plot: nearest.plot,
          userLocation: location.coords,
        });
        if (isCurrentRequest()) {
          setAttendanceOutcome({ kind: 'checked', plot: nearest.plot, result });
        }
      } catch {
        if (isCurrentRequest()) {
          setAttendanceOutcome({ kind: 'network-error', plot: nearest.plot });
        }
      }
    } finally {
      if (isCurrentRequest()) {
        attendanceInFlight.current = false;
        setAttendanceBusy(false);
      }
    }
  }, [farmerId, plots, runLocationAction]);

  function handleSignOut() {
    Alert.alert('Keluar', 'Yakin ingin keluar dari AgroWeather?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }

  function openTask(task: FarmTask) {
    router.push({
      pathname: '/(app)/task/[id]',
      params: { id: task.id },
    });
  }

  function renderAttendanceCard() {
    if (attendanceBusy || locationState.status === 'checking') {
      const persisting = locationState.status !== 'checking';
      return (
        <LocationActionCard
          state="checking"
          title={persisting ? 'Menyimpan kehadiran…' : 'Mencari sinyal GPS…'}
          message={
            persisting
              ? 'Tunggu sampai absensi selesai disimpan.'
              : 'Tetap di area lahan sampai pembacaan lokasi selesai.'
          }
        />
      );
    }

    if (attendanceOutcome?.kind === 'reading-error') {
      return (
        <LocationActionCard
          state="warning"
          title="Pembacaan GPS belum dapat dipakai"
          message={readingIssueMessage(
            attendanceOutcome.issue,
            attendanceOutcome.plot
          )}
          meta={`Lahan terdekat: ${attendanceOutcome.plot.namaLahan}`}
          actionLabel="Periksa Lagi"
          onAction={() => void checkAttendance()}
        />
      );
    }

    if (attendanceOutcome?.kind === 'no-active-plot') {
      return (
        <LocationActionCard
          state="neutral"
          title="Belum ada lahan aktif"
          message="Hubungi internal untuk memastikan penugasan lahan Anda."
          actionLabel="Periksa Lagi"
          onAction={() => void checkAttendance()}
        />
      );
    }

    if (attendanceOutcome?.kind === 'network-error') {
      return (
        <LocationActionCard
          state="danger"
          title="Absensi belum tersimpan"
          message="GPS berhasil, tetapi absensi belum tersimpan. Coba lagi."
          meta={`Lahan: ${attendanceOutcome.plot.namaLahan}`}
          actionLabel="Periksa Lagi"
          onAction={() => void checkAttendance()}
        />
      );
    }

    if (attendanceOutcome?.kind === 'checked') {
      const { plot, result } = attendanceOutcome;
      if (!result.unlocked) {
        return (
          <LocationActionCard
            state="warning"
            title="Di luar radius lahan"
            message={`Anda belum berada di dalam radius ${plot.namaLahan}.`}
            meta={`${formatDistance(result.distanceM)} dari titik lahan • Radius ${plot.radiusGeofenceM} meter`}
            actionLabel="Periksa Lagi"
            onAction={() => void checkAttendance()}
          />
        );
      }

      return (
        <LocationActionCard
          state="success"
          title={
            result.attendanceCreated
              ? 'Kehadiran tercatat'
              : 'Kehadiran sudah tercatat'
          }
          message={
            result.attendanceCreated
              ? `Anda berada di dalam radius ${plot.namaLahan}. Absensi berhasil disimpan.`
              : `Anda berada di dalam radius ${plot.namaLahan}. Absensi hari ini sudah ada.`
          }
          meta={`${formatDistance(result.distanceM)} dari titik lahan • Radius ${plot.radiusGeofenceM} meter`}
          actionLabel="Periksa Lagi"
          onAction={() => void checkAttendance()}
        />
      );
    }

    if (locationState.status === 'error') {
      const result = locationState.result;
      const canOpenSettings = result.canOpenSettings;
      return (
        <LocationActionCard
          state="danger"
          title="GPS tidak dapat digunakan"
          message={
            result.message ??
            'Lokasi belum ditemukan. Pindah ke area terbuka lalu periksa lagi.'
          }
          actionLabel={canOpenSettings ? 'Buka Pengaturan' : 'Periksa Lagi'}
          onAction={
            canOpenSettings
              ? () => {
                  void openLocationSettings(result.status);
                }
              : () => void checkAttendance()
          }
        />
      );
    }

    return (
      <LocationActionCard
        state="idle"
        title="Cek lokasi saat Anda siap"
        message="GPS hanya diambil setelah tombol ditekan dan tidak berjalan otomatis."
        actionLabel="Aktifkan GPS & Cek Kehadiran"
        onAction={() => void checkAttendance()}
      />
    );
  }

  function renderTaskSection(title: string, items: TaskViewModel[]) {
    if (items.length === 0) return null;
    return (
      <View style={styles.taskSection}>
        <AppText variant="subtitle">{title}</AppText>
        {items.map(({ task: currentTask, plot, state }) => (
          <TaskCard
            key={currentTask.id}
            task={currentTask}
            plotName={plot?.namaLahan ?? 'Lahan tidak ditemukan'}
            state={state}
            radiusM={plot?.radiusGeofenceM}
            onPress={() => openTask(currentTask)}
          />
        ))}
      </View>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Field First"
        title={`Halo, ${profile?.nama ?? 'Petani'}`}
        description="Cek kehadiran secara sadar, lalu lanjutkan tugas sesuai kondisi lahan."
        action={
          <AppButton label="Keluar" variant="secondary" onPress={handleSignOut} />
        }
      />

      {loading ? (
        <FeedbackState title="Memuat dashboard…" loading />
      ) : loadError ? (
        <FeedbackState
          title="Dashboard belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadDashboard()}
        />
      ) : (
        <>
          {renderAttendanceCard()}

          <View style={styles.metrics}>
            <SurfaceCard style={styles.metricCard}>
              <AppText variant="title">{activePlotCount}</AppText>
              <AppText variant="small" color={Colors.muted}>
                Lahan aktif
              </AppText>
            </SurfaceCard>
            <SurfaceCard style={styles.metricCard}>
              <AppText variant="title">{tasks.length}</AppText>
              <AppText variant="small" color={Colors.muted}>
                Total tugas
              </AppText>
            </SurfaceCard>
          </View>

          <View style={styles.tasks}>
            <AppText variant="title">Tugas Saya</AppText>
            {tasks.length === 0 ? (
              <FeedbackState
                title="Belum ada tugas"
                message="Tugas baru dari internal akan tampil di sini."
              />
            ) : (
              <>
                {renderTaskSection('Siap dikerjakan', readyTasks)}
                {renderTaskSection('Perlu cek lokasi', locationTasks)}
                {renderTaskSection('Selesai', completedTasks)}
              </>
            )}
          </View>
        </>
      )}
    </AppScreen>
  );
}

export default function PetaniScreen() {
  return (
    <RoleGuard requiredRole="farmer">
      <PetaniDashboard />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
  },
  tasks: {
    gap: Spacing.three,
  },
  taskSection: {
    gap: Spacing.three,
  },
});
