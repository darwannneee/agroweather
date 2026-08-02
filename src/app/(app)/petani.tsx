import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationActionCard } from '@/components/domain/location-action-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { TaskCard, type TaskCardState } from '@/components/domain/task-card';
import { WeatherSummaryCard } from '@/components/domain/weather-summary-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLocationAction } from '@/hooks/use-location-action';
import {
  deriveTaskOperationalState,
  jakartaDate,
  sortDailyTasks,
} from '@/lib/daily-operations';
import type {
  AttendanceRecord,
  DashboardWeatherSummary,
  FarmPlot,
  FarmTask,
} from '@/lib/farm-types';
import { evaluateGeofence } from '@/lib/geofence';
import {
  LOCATION_MAX_ACCURACY_M,
  findNearestActivePlot,
  validateLocationReading,
  type LocationReadingIssue,
} from '@/lib/location-policy';
import {
  checkInIfInsideRadius,
  fetchFarmerAttendanceForDate,
  type CheckInResult,
} from '@/services/attendance';
import { useAuth } from '@/services/auth-context';
import {
  openLocationSettings,
  type GrantedLocationResult,
} from '@/services/location';
import { fetchAssignedPlots } from '@/services/plots';
import { fetchFarmerTasks } from '@/services/tasks';
import { fetchLatestWeatherForPlots } from '@/services/weather';

const { width } = Dimensions.get('window');

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

// --- Fungsi Bantuan ---
function formatDistance(distanceM: number | null): string {
  if (distanceM === null) return 'Jarak tidak tersedia';
  if (distanceM < 1000) return `${distanceM} meter`;
  return `${(distanceM / 1000).toFixed(2)} km`;
}

function formatAttendanceTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return `${values.hour}:${values.minute} WIB`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function readingIssueMessage(issue: LocationReadingIssue, plot: FarmPlot): string {
  switch (issue) {
    case 'invalid-coordinates': return 'Koordinat GPS tidak valid. Periksa pengaturan.';
    case 'missing-accuracy': return 'Akurasi GPS tidak tersedia. Pindah ke area terbuka.';
    case 'stale': return 'Data GPS sudah kedaluwarsa. Periksa lagi.';
    case 'low-accuracy': return `Akurasi GPS belum cukup untuk radius ${plot.radiusGeofenceM}m.`;
  }
}

function taskState(task: FarmTask, plot: FarmPlot | null, reading: GrantedLocationResult | null): TaskCardState {
  if (task.status === 'selesai') return 'completed';
  if (!task.requiresLocation) return 'ready';
  if (!plot || !reading) return 'check-location';

  const issue = validateLocationReading(
    { ...reading.coords, accuracyM: reading.accuracyM, timestamp: reading.timestamp },
    plot.radiusGeofenceM
  );
  if (issue) return 'check-location';

  const result = evaluateGeofence({
    user: reading.coords,
    plot: { latitude: plot.latCenter, longitude: plot.lngCenter, radiusMeters: plot.radiusGeofenceM },
  });
  return result.unlocked ? 'ready' : 'outside';
}

function farmerTaskCardState(task: FarmTask, plot: FarmPlot | null, reading: GrantedLocationResult | null): TaskCardState {
  const operational = deriveTaskOperationalState(task);
  if (operational === 'pending-review') return 'pending-review';
  if (operational === 'revision-needed') return 'revision-needed';
  if (operational === 'completed') return 'completed';
  return taskState(task, plot, reading);
}

// --- Komponen Lokal UI ---
function InsightCard({ title, value, icon, subtitle, bgTone }: { title: string, value: string | number, icon: keyof typeof Feather.glyphMap, subtitle: string, bgTone: string }) {
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

export function PetaniDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state: locationState,
    run: runLocationAction,
    reset: resetLocationAction,
  } = useLocationAction();
  
  const farmerId = profile?.id;
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [weather, setWeather] = useState<DashboardWeatherSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [validatedReading, setValidatedReading] = useState<GrantedLocationResult | null>(null);
  const [attendanceOutcome, setAttendanceOutcome] = useState<AttendanceOutcome | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

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
        setPlots([]); setTasks([]); setWeather([]); setAttendance(null); setLoading(false);
      }
      return;
    }

    try {
      const date = jakartaDate();
      const [nextPlots, nextTasks, nextAttendance] = await Promise.all([
        fetchAssignedPlots(farmerId),
        fetchFarmerTasks(farmerId, date),
        fetchFarmerAttendanceForDate(farmerId, date),
      ]);
      const nextWeather = await fetchLatestWeatherForPlots(nextPlots.map((plot) => plot.id));
      
      if (requestVersion.current === version) {
        setPlots(nextPlots);
        setTasks(sortDailyTasks(nextTasks.filter((task) => task.scheduledFor === date)));
        setWeather(nextWeather);
        setAttendance(nextAttendance);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Data belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void loadDashboard();
    return () => { requestVersion.current += 1; };
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
    setAttendance(null);
    setValidatedReading(null);
    resetLocationAction();
  }, [farmerId, resetLocationAction]);

  const activePlotCount = useMemo(() => plots.filter((plot) => plot.status === 'aktif').length, [plots]);

  const taskViewModels = useMemo(() => {
    const plotsById = new Map(plots.map((plot) => [plot.id, plot]));
    return tasks.map((currentTask): TaskViewModel => {
      const plot = plotsById.get(currentTask.lahanId) ?? null;
      return { task: currentTask, plot, state: farmerTaskCardState(currentTask, plot, validatedReading) };
    });
  }, [plots, tasks, validatedReading]);

  const checkAttendance = useCallback(async () => {
    if (!farmerId || attendanceInFlight.current) return;

    attendanceInFlight.current = true;
    const version = ++attendanceRequestVersion.current;
    const requestFarmerId = farmerId;
    const isCurrentRequest = () => mounted.current && attendanceRequestVersion.current === version && farmerIdRef.current === requestFarmerId;

    setAttendanceBusy(true);
    setAttendanceOutcome(null);
    setValidatedReading(null);

    try {
      const location = await runLocationAction({ maxAccuracyM: LOCATION_MAX_ACCURACY_M });
      if (!isCurrentRequest() || location.status !== 'granted') return;

      const nearest = findNearestActivePlot(plots, location.coords);
      if (!nearest) { setAttendanceOutcome({ kind: 'no-active-plot' }); return; }

      const issue = validateLocationReading({ ...location.coords, accuracyM: location.accuracyM, timestamp: location.timestamp }, nearest.plot.radiusGeofenceM);
      if (issue) { setAttendanceOutcome({ kind: 'reading-error', issue, plot: nearest.plot }); return; }

      setValidatedReading(location);
      try {
        const result = await checkInIfInsideRadius({ farmerId: requestFarmerId, plot: nearest.plot, userLocation: location.coords });
        if (isCurrentRequest()) {
          if (result.attendance) setAttendance(result.attendance);
          setAttendanceOutcome({ kind: 'checked', plot: nearest.plot, result });
        }
      } catch {
        if (isCurrentRequest()) setAttendanceOutcome({ kind: 'network-error', plot: nearest.plot });
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
      { text: 'Keluar', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  function renderAttendanceAction() {
    if (attendanceBusy || locationState.status === 'checking') {
      const persisting = locationState.status !== 'checking';
      return <LocationActionCard state="checking" title={persisting ? 'Menyimpan kehadiran…' : 'Mencari sinyal GPS…'} message="Mohon tunggu sebentar." />;
    }
    // Jika sudah absen, maka komponen tidak perlu dirender sama sekali
    if (attendance) return null; 
    
    if (attendanceOutcome?.kind === 'reading-error') {
      return <LocationActionCard state="warning" title="Pembacaan GPS belum stabil" message={readingIssueMessage(attendanceOutcome.issue, attendanceOutcome.plot)} actionLabel="Periksa Lagi" onAction={() => void checkAttendance()} />;
    }
    if (attendanceOutcome?.kind === 'no-active-plot') {
      return <LocationActionCard state="neutral" title="Belum ada lahan aktif" message="Hubungi koordinator." actionLabel="Periksa Lagi" onAction={() => void checkAttendance()} />;
    }
    if (attendanceOutcome?.kind === 'network-error') {
      return <LocationActionCard state="danger" title="Gagal menyimpan" message="Silakan coba lagi." actionLabel="Periksa Lagi" onAction={() => void checkAttendance()} />;
    }
    if (attendanceOutcome?.kind === 'checked' && !attendanceOutcome.result.unlocked) {
      return <LocationActionCard state="warning" title="Di luar radius lahan" message={`Anda berjarak ${formatDistance(attendanceOutcome.result.distanceM)}`} actionLabel="Periksa Lagi" onAction={() => void checkAttendance()} />;
    }
    if (locationState.status === 'error') {
      const result = locationState.result;
      return <LocationActionCard state="danger" title="GPS bermasalah" message={result.message ?? 'Lokasi belum ditemukan.'} actionLabel={result.canOpenSettings ? 'Buka Pengaturan' : 'Periksa Lagi'} onAction={result.canOpenSettings ? () => void openLocationSettings(result.status) : () => void checkAttendance()} />;
    }
    
    return <LocationActionCard state="idle" title="Belum absen" message="Tekan untuk mengirim kehadiran." actionLabel="Cek Kehadiran" onAction={() => void checkAttendance()} />;
  }

  // Simpan hasil renderAttendanceAction ke dalam variabel
  const attendanceActionContent = renderAttendanceAction();

  return (
    <AppScreen scroll contentContainerStyle={styles.screenContainer}>
      {/* HEADER: Sembunyikan default header Expo Router */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER Profil */}
      <View style={[styles.headerArea, styles.paddedContent, { paddingTop: Math.max(insets.top + 10, 20) }]}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <AppText variant="bodyStrong" color={Colors.surface}>
              {profile?.nama?.charAt(0).toUpperCase() ?? 'P'}
            </AppText>
          </View>
          <View style={styles.greetingText}>
            <AppText variant="small" color={Colors.muted}>{getGreeting()}</AppText>
            <AppText variant="subtitle">{profile?.nama ?? 'Petani'}</AppText>
          </View>
        </View>
        
        <Pressable onPress={() => setMenuVisible(true)} style={styles.moreBtn} hitSlop={10}>
          <Feather name="more-vertical" size={20} color={Colors.ink} />
        </Pressable>

        {/* Modal Menu Logout */}
        <Modal visible={menuVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <View style={[styles.dropdownMenu, { top: Math.max(insets.top + 50, 70) }]}>
              <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); handleSignOut(); }}>
                <Feather name="log-out" size={18} color={Colors.dangerText} />
                <AppText variant="bodyStrong" color={Colors.dangerText}>Keluar</AppText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      {loading ? (
        <FeedbackState title="Memuat ruang kerja…" loading />
      ) : loadError ? (
        <FeedbackState title="Gagal memuat data" message={loadError} actionLabel="Coba Lagi" onAction={() => void loadDashboard()} />
      ) : (
        <>
          {/* INSIGHTS (Horizontal Scroll) */}
          <View style={styles.sectionContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.insightScroll}
              snapToInterval={width * 0.75 + Spacing.three}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              <InsightCard 
                title="Lahan Aktif" 
                value={activePlotCount} 
                icon="map" 
                subtitle="Area kerja tersedia" 
                bgTone={Colors.forest} 
              />
              <InsightCard 
                title="Tugas Hari Ini" 
                value={tasks.length} 
                icon="clipboard" 
                subtitle="Sesuai prioritas" 
                bgTone={Colors.skyText} 
              />
              <InsightCard 
                title="Status Kehadiran" 
                value={attendance ? 'Sudah' : 'Belum'} 
                icon="user-check" 
                subtitle={attendance ? `Pukul ${formatAttendanceTime(attendance.checkedInAt)}` : 'Perlu absen di lokasi'} 
                bgTone={attendance ? Colors.forest : Colors.harvest} 
              />
            </ScrollView>
          </View>

          {/* ACTION ABSENSI */}
          {attendanceActionContent && (
            <View style={[styles.sectionContainer, styles.paddedContent]}>
              {attendanceActionContent}
            </View>
          )}

          {/* CUACA LAHAN */}
          <View style={[styles.sectionContainer, styles.paddedContent]}>
            <WeatherSummaryCard weather={weather} />
          </View>

          {/* TUGAS HARI INI */}
          <View style={[styles.sectionContainer, styles.paddedContent]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.mint }]}>
                <Feather name="list" size={24} color={Colors.forest} />
              </View>
              <View style={styles.cardCopy}>
                <AppText variant="title">Daftar Tugas</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Kerjakan dan unggah bukti harian.
                </AppText>
              </View>
            </View>

            <View style={styles.taskList}>
              {tasks.length === 0 ? (
                <FeedbackState title="Belum ada tugas" message="Tugas baru akan tampil di sini." />
              ) : (
                taskViewModels.map(({ task: currentTask, plot, state }) => (
                  <TaskCard
                    key={currentTask.id}
                    task={currentTask}
                    plotName={plot?.namaLahan ?? 'Lahan tidak ditemukan'}
                    state={state}
                    radiusM={plot?.radiusGeofenceM}
                    // Routing diarahkan ke /task/[id] untuk pengunggahan bukti petani
                    onPress={() => router.push(`/(app)/task/${currentTask.id}` as Href)}
                  />
                ))
              )}
            </View>
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
  screenContainer: {
    paddingBottom: Spacing.seven,
    paddingHorizontal: 0,
  },
  paddedContent: {
    paddingHorizontal: Spacing.five, 
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    justifyContent: 'center',
  },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)', 
  },
  dropdownMenu: {
    position: 'absolute',
    right: Spacing.five,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    width: 150,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    paddingVertical: Spacing.two,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  sectionContainer: {
    marginBottom: Spacing.six,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  sectionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    justifyContent: 'center',
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
  taskList: {
    gap: Spacing.three,
  },
});