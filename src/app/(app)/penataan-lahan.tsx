import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PlotCard } from '@/components/domain/plot-card';
import { PlotStats } from '@/components/domain/plot-stats';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { Colors, Spacing } from '@/constants/theme';
import type { FarmPlot } from '@/lib/farm-types';
import { fetchPlots, setPlotStatus } from '@/services/plots';

export function PlotListScreen() {
  const router = useRouter();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const focusGeneration = useRef(0);
  const mutationActive = useRef(false);

  const stats = useMemo(
    () => ({
      total: plots.length,
      active: plots.filter((plot) => plot.status === 'aktif').length,
      assigned: new Set(
        plots.flatMap((plot) => plot.farmerIds ?? (plot.farmerId ? [plot.farmerId] : []))
      ).size,
    }),
    [plots]
  );

  const loadPlots = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const nextPlots = await fetchPlots();
      if (requestVersion.current === version) {
        setPlots(nextPlots);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Data lahan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusGeneration.current += 1;
      mutationActive.current = false;
      setMutatingId(null);
      void loadPlots();
      return () => {
        focusGeneration.current += 1;
        requestVersion.current += 1;
        mutationActive.current = false;
      };
    }, [loadPlots])
  );

  function handleToggleStatus(plot: FarmPlot) {
    const generation = focusGeneration.current;
    const nextStatus = plot.status === 'aktif' ? 'tidak aktif' : 'aktif';
    Alert.alert(
      nextStatus === 'aktif' ? 'Aktifkan Lahan' : 'Nonaktifkan Lahan',
      `Ubah status ${plot.namaLahan} menjadi ${nextStatus}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ubah',
          onPress: async () => {
            if (
              focusGeneration.current !== generation ||
              mutationActive.current
            ) {
              return;
            }
            mutationActive.current = true;
            setMutatingId(plot.id);
            try {
              await setPlotStatus(plot.id, nextStatus);
              if (focusGeneration.current === generation) {
                await loadPlots();
              }
            } catch {
              if (focusGeneration.current === generation) {
                Alert.alert('Status belum berubah', 'Periksa koneksi lalu coba lagi.');
              }
            } finally {
              if (focusGeneration.current === generation) {
                mutationActive.current = false;
                setMutatingId(null);
              }
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <AppScreen contentContainerStyle={styles.screenContainer}>
        {loading ? (
          <View style={styles.centeredState}>
            <FeedbackState title="Memuat data lahan…" loading />
          </View>
        ) : loadError ? (
          <View style={styles.centeredState}>
            <FeedbackState
              title="Data lahan belum tersedia"
              message={loadError}
              actionLabel="Coba Lagi"
              onAction={() => void loadPlots()}
            />
          </View>
        ) : plots.length === 0 ? (
          <View style={styles.centeredState}>
            <FeedbackState
              title="Belum ada lahan"
              message="Tambahkan lahan pertama untuk memulai pemetaan."
            />
          </View>
        ) : (
          <View style={styles.contentList}>
            {/* Kartu Statistik Terpadu (Penuh Warna) */}
            <PlotStats total={stats.total} active={stats.active} assigned={stats.assigned} />
            
            {/* List Kartu Lahan */}
            {plots.map((plot) => (
              <PlotCard
                key={plot.id}
                plot={plot}
                statusLoading={mutatingId === plot.id}
                statusDisabled={mutatingId !== null && mutatingId !== plot.id}
                onEdit={() =>
                  router.push({
                    pathname: '/(app)/penataan-lahan/form',
                    params: { plotId: plot.id },
                  })
                }
                onToggleStatus={() => handleToggleStatus(plot)}
              />
            ))}
          </View>
        )}
      </AppScreen>

      {/* Extended Floating Action Button (FAB) */}
      <Pressable 
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} 
        onPress={() => router.push('/(app)/penataan-lahan/form')}
      >
        <Feather name="plus" size={20} color={Colors.surface} />
        <AppText variant="bodyStrong" color={Colors.surface} style={styles.fabText}>
          Tambah Lahan
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
  },
  screenContainer: {
    paddingBottom: Spacing.seven * 2, 
    paddingTop: Spacing.three, 
  },
  contentList: {
    gap: Spacing.four,
  },
  centeredState: {
    marginTop: Spacing.six,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.six,
    right: Spacing.five,
    height: 56,
    paddingHorizontal: Spacing.five,
    borderRadius: 28, // Bentuk Pil
    backgroundColor: Colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    marginLeft: Spacing.two, // Jarak antara ikon + dan teks
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  }
});

export default function PlotListRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <PlotListScreen />
    </RoleGuard>
  );
}