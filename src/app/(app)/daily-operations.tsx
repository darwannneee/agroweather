import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AttendanceRow } from '@/components/domain/attendance-row';
import { RoleGuard } from '@/components/domain/role-guard';
import { TaskCard } from '@/components/domain/task-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  deriveTaskOperationalState,
  jakartaDate,
} from '@/lib/daily-operations';
import type { AttendanceRecord } from '@/lib/farm-types';
import {
  fetchDailyOperations,
  type DailyOperations,
} from '@/services/daily-operations';

const { width } = Dimensions.get('window');

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
  return `${values.hour}.${values.minute} WIB`;
}

// 1. Komponen Lokal: Kartu Insight Horizontal
function LocalInsightCard({ title, value, icon, subtitle, bgTone }: { title: string, value: string | number, icon: keyof typeof Feather.glyphMap, subtitle: string, bgTone: string }) {
  return (
    <View style={[styles.insightCard, { backgroundColor: bgTone }]}>
      <View style={styles.insightHeader}>
        <AppText variant="smallStrong" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</AppText>
        <View style={styles.insightIconWrapper}>
          <Feather name={icon} size={16} color={bgTone} />
        </View>
      </View>
      <AppText variant="display" style={styles.insightValue}>{value}</AppText>
      <AppText variant="small" style={{ color: 'rgba(255,255,255,0.9)' }}>{subtitle}</AppText>
    </View>
  );
}

// 2. Komponen Lokal: Filter Chip (Diperkecil agar lebih elegan)
function FilterChip({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) {
  return (
    <Pressable 
      onPress={onPress} 
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <AppText 
        variant="smallStrong" 
        color={selected ? Colors.surface : Colors.ink}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

// 3. Komponen Lokal: Baris Detail Modern (Sesuai gambar 1)
function LocalDetailRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap, label: string, value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconBox}>
        <Feather name={icon} size={18} color={Colors.ink} />
      </View>
      <View style={styles.detailTextContainer}>
        <AppText variant="smallStrong" color={Colors.ink}>{label}</AppText>
        <AppText variant="small" color={Colors.muted}>{value}</AppText>
      </View>
    </View>
  );
}

// 4. Komponen Detail Absensi Menyatu (Merged Accordion Card)
// Komponen ini menggantikan AttendanceRow saat di-klik agar tidak ada "dua kartu terpisah".
function MergedAttendanceCard({
  farmerName,
  record,
  onClose,
}: {
  farmerName: string;
  record: AttendanceRecord;
  onClose: () => void;
}) {
  return (
    <SurfaceCard style={styles.mergedCardContainer}>
      {/* Area Header (Mirip dengan baris biasa) */}
      <Pressable onPress={onClose} style={styles.mergedCardHeader}>
        <View style={[styles.mergedIconBox, { backgroundColor: Colors.successBackground }]}>
          <Feather name="check-circle" size={20} color={Colors.forest} />
        </View>
        <View style={styles.mergedNameBox}>
          <AppText variant="subtitle">{farmerName}</AppText>
          <View style={styles.mergedMetaRow}>
            <Feather name="map-pin" size={12} color={Colors.muted} />
            <AppText variant="small" color={Colors.muted}>
              {jakartaTime(record.checkedInAt)} · {record.plotName}
            </AppText>
          </View>
        </View>
        <View style={styles.mergedStatusPill}>
          <AppText variant="label" color={Colors.forest}>Sudah absen</AppText>
        </View>
      </Pressable>

      <View style={styles.mergedDivider} />

      {/* Area Detail Lengkap */}
      <View style={styles.mergedDetails}>
        <AppText variant="smallStrong" style={{ marginBottom: 4 }}>Detail Petani</AppText>
        <AppText variant="small" color={Colors.muted} style={{ marginBottom: Spacing.four }}>
          Absensi valid dengan titik lokasi tersimpan.
        </AppText>
        
        <View style={styles.detailInfoGrid}>
          <LocalDetailRow icon="map" label="Lahan" value={record.plotName} />
          <LocalDetailRow icon="clock" label="Waktu Masuk" value={jakartaTime(record.checkedInAt)} />
          <LocalDetailRow 
            icon="map-pin" 
            label="Jarak GPS" 
            value={record.distanceM === null ? 'Tidak tersedia' : `${Math.round(record.distanceM)} meter dari pusat`} 
          />
          <LocalDetailRow 
            icon="crosshair" 
            label="Koordinat Lokasi" 
            value={`${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`} 
          />
        </View>

        <Pressable onPress={onClose} style={styles.closeBtn}>
          <AppText variant="smallStrong" color={Colors.forest}>Tutup detail absensi</AppText>
        </Pressable>
      </View>
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

  const absentCount = operations?.attendance.filter((item) => item.status === 'absent').length ?? 0;
  const presentCount = operations?.attendance.filter((item) => item.status === 'present').length ?? 0;
  const totalFarmers = operations?.attendance.length ?? 0;

  return (
    <AppScreen contentContainerStyle={styles.screenContainer}>

      {loading ? (
        <View style={[styles.paddedContent, { marginTop: Spacing.six }]}>
          <FeedbackState title="Memuat operasional…" loading />
        </View>
      ) : loadError ? (
        <View style={[styles.paddedContent, { marginTop: Spacing.six }]}>
          <FeedbackState
            title="Operasional belum tersedia"
            message={loadError}
            actionLabel="Coba Lagi"
            onAction={() => void loadOperations()}
          />
        </View>
      ) : (
        <>
          {/* Metrik Horizontal */}
          <View style={styles.metricsWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.insightScroll}
              snapToInterval={width * 0.75 + Spacing.three}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              <LocalInsightCard 
                title="Sudah Absen" 
                value={`${presentCount}/${totalFarmers}`} 
                icon="check-circle" 
                subtitle="Kehadiran valid hari ini" 
                bgTone={Colors.forest} 
              />
              <LocalInsightCard 
                title="Belum Absen" 
                value={absentCount} 
                icon="clock" 
                subtitle="Perlu dipantau internal" 
                bgTone={Colors.harvest} 
              />
              <LocalInsightCard 
                title="Total Task" 
                value={operations?.tasks.length ?? 0} 
                icon="list" 
                subtitle="Seluruh status operasional" 
                bgTone={Colors.skyText} 
              />
            </ScrollView>
          </View>

          {/* Bagian Kehadiran */}
          <View style={[styles.section, styles.paddedContent]}>
            {/* Header Section Modern (Sesuai Gambar 2) */}
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.sky }]}>
                <Feather name="users" size={24} color={Colors.skyText} />
              </View>
              <View style={styles.cardCopy}>
                <AppText variant="title">Kehadiran Hari Ini</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Daftar status masuk petani.
                </AppText>
              </View>
            </View>
            
            {operations?.attendance.length ? (
              <View style={styles.listContainer}>
                {operations.attendance.map((item) => {
                  const isPresent = item.status === 'present' && item.record;
                  const isExpanded = isPresent && selectedAttendance === item.record;
                  
                  return (
                    <View key={item.farmerId}>
                      {/* FIX: Jika Diekspansi, tampilkan kartu Accordion yang menyatu. Jika tidak, tampilkan baris biasa */}
                      {isPresent ? (
                        isExpanded ? (
                          <MergedAttendanceCard
                            farmerName={item.farmerName}
                            record={item.record!}
                            onClose={() => setSelectedAttendance(null)}
                          />
                        ) : (
                          <AttendanceRow
                            farmerName={item.farmerName}
                            status="present"
                            record={item.record!}
                            onPress={() => setSelectedAttendance(item.record)}
                          />
                        )
                      ) : (
                        <AttendanceRow
                          farmerName={item.farmerName}
                          status="absent"
                          record={null}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <FeedbackState
                title="Belum ada data absensi"
                message="Data kehadiran yang ditarik akan muncul di bagian ini."
              />
            )}
          </View>

          {/* Bagian Task */}
          <View style={[styles.section, styles.paddedContent]}>
            {/* Header Section Modern (Sesuai Gambar 3) */}
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.mint }]}>
                <Feather name="clipboard" size={24} color={Colors.forest} />
              </View>
              <View style={styles.cardCopy}>
                <AppText variant="title">Daftar Task</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Pantau progres dan review bukti.
                </AppText>
              </View>
            </View>

            {/* Filter Horizontal (Chips Kecil yang Proporsional) */}
            <View style={styles.filterWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {filters.map((item) => (
                  <FilterChip 
                    key={item.value}
                    label={item.label}
                    selected={filter === item.value}
                    onPress={() => setFilter(item.value)}
                  />
                ))}
              </ScrollView>
            </View>

            {visibleTasks.length ? (
              <View style={styles.listContainer}>
                {visibleTasks.map((item) => (
                  <View key={item.task.id} style={styles.task}>
                    <AppText variant="smallStrong" color={Colors.muted} style={styles.farmerLabel}>
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
                ))}
              </View>
            ) : (
              <FeedbackState
                title={
                  operations?.tasks.length
                    ? 'Tidak ada task di filter ini'
                    : 'Belum ada task hari ini'
                }
                message={
                  operations?.tasks.length
                    ? 'Pilih status filter lain untuk melihat task yang tersedia.'
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
  screenContainer: {
    paddingBottom: Spacing.seven,
    paddingHorizontal: 0, 
  },
  paddedContent: {
    paddingHorizontal: Spacing.five,
  },
  metricsWrapper: {
    marginBottom: Spacing.six,
    marginTop: Spacing.four,
  },
  insightScroll: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  insightCard: {
    width: width * 0.75, 
    padding: Spacing.five,
    borderRadius: 24, 
    justifyContent: 'space-between',
    minHeight: 160,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  insightIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightValue: {
    color: Colors.surface,
    marginBottom: Spacing.one,
  },
  section: {
    marginBottom: Spacing.six,
    gap: Spacing.four,
  },
  // Style baru untuk Section Header agar mirip gambar 2 & 3
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sectionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14, // Membuat kotak melengkung (squircle)
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  listContainer: {
    gap: Spacing.three,
  },
  // Styles Khusus untuk Accordion Absensi yang Menyatu
  mergedCardContainer: {
    padding: 0, // Padding dihilangkan agar header bisa mentok ke ujung
    overflow: 'hidden',
  },
  mergedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: Colors.surface,
  },
  mergedIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergedNameBox: {
    flex: 1,
    marginLeft: Spacing.three,
    gap: 2,
  },
  mergedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mergedStatusPill: {
    backgroundColor: Colors.successBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  mergedDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.four,
  },
  mergedDetails: {
    padding: Spacing.four,
  },
  detailInfoGrid: {
    gap: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextContainer: {
    flex: 1,
    gap: 2,
  },
  closeBtn: {
    marginTop: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
  },
  // Filter Styles Diperkecil
  filterWrapper: {
    marginHorizontal: -Spacing.five, 
  },
  filterScroll: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  filterChip: {
    paddingHorizontal: 12, // Diperkecil dari sebelumnya
    paddingVertical: 8,    // Diperkecil
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
  },
  filterChipSelected: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
  },
  // Task Styles
  task: {
    gap: Spacing.two,
  },
  farmerLabel: {
    marginLeft: Spacing.one,
  }
});

export default function DailyOperationsRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <DailyOperationsScreen />
    </RoleGuard>
  );
}