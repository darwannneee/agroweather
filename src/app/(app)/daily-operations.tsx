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
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
import { MetricCard } from '@/components/ui/metric-card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
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
      <View style={styles.cardHeader}>
        <IconBadge icon="✅" label="Detail Kehadiran" tone="forest" />
        <View style={styles.cardCopy}>
          <AppText variant="subtitle">
            Detail Kehadiran {record.farmerName}
          </AppText>
          <AppText variant="small" color={Colors.muted}>
            Absensi valid dengan titik lokasi tersimpan.
          </AppText>
        </View>
      </View>
      <InfoRow icon="🌾" label="Lahan" value={`Lahan: ${record.plotName}`} />
      <InfoRow
        icon="🕒"
        label="Waktu masuk"
        value={`Waktu masuk: ${jakartaTime(record.checkedInAt)}`}
        tone="sky"
      />
      <InfoRow
        icon="📍"
        label="Jarak"
        value={`Jarak: ${
          record.distanceM === null
            ? 'Tidak tersedia'
            : `${Math.round(record.distanceM)} meter`
        }`}
        tone="amber"
      />
      <InfoRow
        icon="🛰️"
        label="Koordinat"
        value={`Koordinat: ${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`}
        tone="sky"
      />
      <AppButton
        label="Tutup detail absensi"
        variant="secondary"
        icon="×"
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
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="✅"
              value={`${operations?.attendance.filter((item) => item.status === 'present').length ?? 0}/${operations?.attendance.length ?? 0}`}
              label="Sudah absen"
              helper="Kehadiran valid hari ini"
            />
            <MetricCard
              icon="⏳"
              value={
                operations?.attendance.filter((item) => item.status === 'absent')
                  .length ?? 0
              }
              label="Belum absen"
              helper="Perlu dipantau internal"
              tone="amber"
            />
            <MetricCard
              icon="📋"
              value={operations?.tasks.length ?? 0}
              label="Task hari ini"
              helper="Semua status operasional"
              tone="sky"
            />
          </View>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <IconBadge icon="👨‍🌾" label="Kehadiran Hari Ini" tone="sky" />
              <View style={styles.cardCopy}>
                <AppText variant="title">Kehadiran Hari Ini</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Status absen petani berdasarkan data hari ini.
                </AppText>
              </View>
            </View>
            {operations?.attendance.length ? (
              operations.attendance.map((item) =>
                item.status === 'present' && item.record ? (
                  <AttendanceRow
                    key={item.farmerId}
                    farmerName={item.farmerName}
                    status="present"
                    record={item.record}
                    onPress={() => setSelectedAttendance(item.record)}
                  />
                ) : (
                  <AttendanceRow
                    key={item.farmerId}
                    farmerName={item.farmerName}
                    status="absent"
                    record={null}
                  />
                )
              )
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
            <View style={styles.sectionTitleRow}>
              <IconBadge icon="📋" label="Task Hari Ini" tone="forest" />
              <View style={styles.cardCopy}>
                <AppText variant="title">Task Hari Ini</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Filter cepat untuk review bukti dan progres lapangan.
                </AppText>
              </View>
            </View>
            <View style={styles.filters}>
              {filters.map((item) => (
                <AppButton
                  key={item.value}
                  label={item.label}
                  variant={filter === item.value ? 'forest' : 'secondary'}
                  icon={filter === item.value ? '✓' : undefined}
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
  metricsGrid: {
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  cardCopy: {
    flex: 1,
    gap: Spacing.one,
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
