import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardSection } from '@/components/dashboard-section';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import { evaluateGeofence, type GeofenceResult } from '@/lib/geofence';
import { checkInIfInsideRadius } from '@/services/attendance';
import { useAuth } from '@/services/auth-context';
import { requestCurrentLocation, type CurrentLocationResult } from '@/services/location';
import { fetchAssignedPlots } from '@/services/plots';
import { fetchFarmerTasks } from '@/services/tasks';

type PlotProximity = {
  plot: FarmPlot;
  result: GeofenceResult;
};

function formatDistance(distanceM: number | null): string {
  if (distanceM === null) return '-';
  if (distanceM < 1000) return `${distanceM} m`;
  return `${(distanceM / 1000).toFixed(2)} km`;
}

function taskIsUnlocked(task: FarmTask, proximity: PlotProximity[]): boolean {
  if (!task.requiresLocation) return true;
  return proximity.some((item) => item.plot.id === task.lahanId && item.result.unlocked);
}

export default function PetaniDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [location, setLocation] = useState<CurrentLocationResult | null>(null);
  const [proximity, setProximity] = useState<PlotProximity[]>([]);
  const [loading, setLoading] = useState(true);

  const nearest = useMemo(() => {
    const withDistance = proximity.filter((item) => item.result.distanceM !== null);
    return withDistance.sort((a, b) => (a.result.distanceM ?? 0) - (b.result.distanceM ?? 0))[0] ?? null;
  }, [proximity]);

  const unlockedTasks = useMemo(
    () => tasks.filter((task) => taskIsUnlocked(task, proximity)),
    [proximity, tasks]
  );
  const lockedTasks = useMemo(
    () => tasks.filter((task) => !taskIsUnlocked(task, proximity)),
    [proximity, tasks]
  );

  const loadDashboard = useCallback(async () => {
    if (!profile) return;

    try {
      const [nextPlots, nextTasks, nextLocation] = await Promise.all([
        fetchAssignedPlots(profile.id),
        fetchFarmerTasks(profile.id),
        requestCurrentLocation(),
      ]);

      const nextProximity = nextPlots.map((plot) => ({
        plot,
        result: evaluateGeofence({
          user: nextLocation.coords,
          plot: {
            latitude: plot.latCenter,
            longitude: plot.lngCenter,
            radiusMeters: plot.radiusGeofenceM,
          },
        }),
      }));

      await Promise.all(
        nextProximity
          .filter((item) => item.result.unlocked)
          .map((item) =>
            checkInIfInsideRadius({
              farmerId: profile.id,
              plot: item.plot,
              userLocation: nextLocation.coords,
            })
          )
      );

      setPlots(nextPlots);
      setTasks(nextTasks);
      setLocation(nextLocation);
      setProximity(nextProximity);
    } catch (e) {
      Alert.alert('Gagal memuat dashboard', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadDashboard]);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    await loadDashboard();
  }, [loadDashboard]);

  function handleLogout() {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function openTask(task: FarmTask, unlocked: boolean) {
    if (!unlocked) {
      Alert.alert('Task terkunci', 'Datang ke radius 1 km dari lahan untuk membuka task ini.');
      return;
    }
    router.push({ pathname: '/(app)/task/[id]', params: { id: task.id } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <ThemedText type="small" themeColor="textSecondary">
                Selamat datang,
              </ThemedText>
              <ThemedText type="subtitle">{profile?.nama ?? 'Petani'}</ThemedText>
            </View>
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <ThemedText type="smallBold" style={{ color: '#dc2626' }}>
                Keluar
              </ThemedText>
            </Pressable>
          </View>

          <DashboardSection title="Absensi GPS">
            {loading ? (
              <View style={styles.inlineStatus}>
                <ActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  Mengecek lokasi...
                </ThemedText>
              </View>
            ) : location?.status !== 'granted' ? (
              <View style={styles.sectionGap}>
                <ThemedText type="small" themeColor="textSecondary">
                  {location?.message ?? 'Lokasi belum tersedia.'}
                </ThemedText>
                <PrimaryButton label="Coba Lagi" onPress={refreshDashboard} />
              </View>
            ) : nearest ? (
              <View style={styles.sectionGap}>
                <ThemedText type="smallBold">{nearest.plot.namaLahan}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Jarak Anda {formatDistance(nearest.result.distanceM)} dari lahan.
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  style={{ color: nearest.result.unlocked ? '#166534' : '#991b1b' }}
                >
                  {nearest.result.unlocked ? 'Hadir otomatis aktif' : 'Di luar radius 1 km'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Belum ada lahan yang diassign ke akun ini.
              </ThemedText>
            )}
          </DashboardSection>

          <DashboardSection title="Tugas Hari Ini">
            {loading ? (
              <View style={styles.inlineStatus}>
                <ActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  Memuat task...
                </ThemedText>
              </View>
            ) : tasks.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Belum ada tugas. Tunggu internal assign.
              </ThemedText>
            ) : (
              <View style={styles.taskList}>
                {[...unlockedTasks, ...lockedTasks].map((task) => {
                  const unlocked = taskIsUnlocked(task, proximity);
                  const plot = plots.find((item) => item.id === task.lahanId);
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => openTask(task, unlocked)}
                      style={[styles.taskCard, !unlocked && styles.taskCardLocked]}
                    >
                      <View style={styles.taskHeader}>
                        <ThemedText type="smallBold">{task.judul}</ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: unlocked ? '#166534' : '#991b1b' }}
                        >
                          {unlocked ? 'Terbuka' : 'Terkunci'}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {plot?.namaLahan ?? 'Lahan tidak ditemukan'}
                      </ThemedText>
                      {!unlocked ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Datang ke radius 1 km dari lahan untuk membuka task ini.
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </DashboardSection>

          <DashboardSection title="Cuaca di Lahan Saya">
            <ThemedText type="small" themeColor="textSecondary">
              Data cuaca dan rekomendasi otomatis masuk fase berikutnya setelah MVP mapping stabil.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Scan Tanaman Terbaru">
            <ThemedText type="small" themeColor="textSecondary">
              Bukti foto task akan menjadi input analisis berikutnya.
            </ThemedText>
          </DashboardSection>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  headerTitle: { flex: 1 },
  logoutBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionGap: {
    gap: Spacing.two,
  },
  taskList: {
    gap: Spacing.two,
  },
  taskCard: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: '#f8fafc',
  },
  taskCardLocked: {
    backgroundColor: '#f3f4f6',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
