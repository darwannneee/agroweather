import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { AttendanceRow } from '@/components/domain/attendance-row';
import { RoleGuard } from '@/components/domain/role-guard';
import { TaskCard } from '@/components/domain/task-card';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Spacing } from '@/constants/theme';
import {
  deriveTaskOperationalState,
  jakartaDate,
} from '@/lib/daily-operations';
import type { AttendanceRecord } from '@/lib/farm-types';
import {
  fetchDailyOperations,
  type DailyOperations,
} from '@/services/daily-operations';

type OperationsFilter =
  | 'all'
  | 'not-started'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';

const filters: { value: OperationsFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'not-started', label: 'Belum dimulai' },
  { value: 'pending-review', label: 'Menunggu review' },
  { value: 'revision-needed', label: 'Perlu perbaikan' },
  { value: 'completed', label: 'Selesai' },
];

function jakartaTime(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return `${values.hour}:${values.minute} WIB`;
}

function AttendanceDetail({
  record,
  onClose,
}: {
  record: AttendanceRecord;
  onClose: () => void;
}) {
  return (
    <SurfaceCard>
      <AppText variant="subtitle">
        Detail Kehadiran {record.farmerName}
      </AppText>
      <AppText variant="small">Lahan: {record.plotName}</AppText>
      <AppText variant="small">
        Waktu masuk: {jakartaTime(record.checkedInAt)}
      </AppText>
      <AppText variant="small">
        Jarak:{' '}
        {record.distanceM === null
          ? 'Tidak tersedia'
          : `${Math.round(record.distanceM)} meter`}
      </AppText>
      <AppText variant="small">
        Koordinat: {record.latitude.toFixed(6)},{' '}
        {record.longitude.toFixed(6)}
      </AppText>
      <AppButton
        label="Tutup detail absensi"
        variant="secondary"
        onPress={onClose}
      />
    </SurfaceCard>
  );
}

export function DailyOperationsScreen() {
  const router = useRouter();
  const [operations, setOperations] = useState<DailyOperations | null>(null);
  const [filter, setFilter] = useState<OperationsFilter>('all');
  const [selectedAttendance, setSelectedAttendance] =
    useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadOperations = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    try {
      const nextOperations = await fetchDailyOperations(jakartaDate());
      if (requestVersion.current === version) {
        setOperations(nextOperations);
        setSelectedAttendance(null);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Data harian belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOperations();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadOperations]);

  const visibleTasks = useMemo(() => {
    const tasks = operations?.tasks ?? [];
    return filter === 'all'
      ? tasks
      : tasks.filter(
          ({ task }) => deriveTaskOperationalState(task) === filter
        );
  }, [filter, operations]);

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Operasional Harian"
        title="Kehadiran & Task"
        description="Status tersimpan untuk hari ini. Membuka detail tidak meminta GPS."
      />

      {loading ? (
        <FeedbackState title="Memuat operasional…" loading />
      ) : loadError ? (
        <FeedbackState
          title="Operasional belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadOperations()}
        />
      ) : (
        <>
          <View style={styles.section}>
            <AppText variant="title">Kehadiran Hari Ini</AppText>
            {operations?.attendance.length ? (
              operations.attendance.map((item) => (
                <AttendanceRow
                  key={item.farmerId}
                  farmerName={item.farmerName}
                  status={item.status}
                  record={item.record}
                  onPress={
                    item.status === 'present' && item.record
                      ? () => setSelectedAttendance(item.record)
                      : undefined
                  }
                />
              ))
            ) : (
              <FeedbackState
                title="Belum ada data absensi"
                message="Kehadiran valid akan muncul di bagian ini."
              />
            )}
          </View>

          {selectedAttendance ? (
            <AttendanceDetail
              record={selectedAttendance}
              onClose={() => setSelectedAttendance(null)}
            />
          ) : null}

          <View style={styles.section}>
            <AppText variant="title">Task Hari Ini</AppText>
            <View style={styles.filters}>
              {filters.map((item) => (
                <AppButton
                  key={item.value}
                  label={item.label}
                  variant={filter === item.value ? 'forest' : 'secondary'}
                  accessibilityState={{ selected: filter === item.value }}
                  onPress={() => setFilter(item.value)}
                />
              ))}
            </View>

            {visibleTasks.length ? (
              visibleTasks.map((item) => (
                <View key={item.task.id} style={styles.task}>
                  <AppText variant="smallStrong">
                    Petani: {item.farmerName}
                  </AppText>
                  <TaskCard
                    task={item.task}
                    plotName={item.plotName}
                    state={deriveTaskOperationalState(item.task)}
                    onPress={() =>
                      router.push(
                        `/(app)/task-review/${item.task.id}` as Href
                      )
                    }
                  />
                </View>
              ))
            ) : (
              <FeedbackState
                title={
                  operations?.tasks.length
                    ? 'Tidak ada task untuk filter ini'
                    : 'Belum ada task hari ini'
                }
                message={
                  operations?.tasks.length
                    ? 'Pilih status lain untuk melihat task.'
                    : 'Task yang dijadwalkan hari ini akan muncul di sini.'
                }
              />
            )}
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  filters: {
    gap: Spacing.two,
  },
  task: {
    gap: Spacing.one,
  },
});

export default function DailyOperationsRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <DailyOperationsScreen />
    </RoleGuard>
  );
}
