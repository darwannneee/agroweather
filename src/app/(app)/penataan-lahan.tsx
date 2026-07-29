import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
import type { FarmPlot } from '@/lib/farm-types';
import { fetchPlots, setPlotStatus } from '@/services/plots';

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export default function PenataanLahanScreen() {
  const router = useRouter();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const stats = useMemo(
    () => ({
      total: plots.length,
      active: plots.filter((plot) => plot.status === 'aktif').length,
      assigned: plots.filter((plot) => plot.farmerId).length,
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
      void loadPlots();
      return () => {
        requestVersion.current += 1;
      };
    }, [loadPlots])
  );

  function handleToggleStatus(plot: FarmPlot) {
    const nextStatus = plot.status === 'aktif' ? 'tidak aktif' : 'aktif';
    Alert.alert(
      nextStatus === 'aktif' ? 'Aktifkan Lahan' : 'Nonaktifkan Lahan',
      `Ubah status ${plot.namaLahan} menjadi ${nextStatus}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ubah',
          onPress: async () => {
            setMutatingId(plot.id);
            try {
              await setPlotStatus(plot.id, nextStatus);
              await loadPlots();
            } catch {
              Alert.alert('Status belum berubah', 'Periksa koneksi lalu coba lagi.');
            } finally {
              setMutatingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Operasional"
        title="Penataan Lahan"
        description="Pemetaan lahan, petani, tanaman, dan fase kerja."
        action={
          <AppButton
            label="Tambah Lahan"
            onPress={() => router.push('/(app)/penataan-lahan/form')}
          />
        }
      />

      <View style={styles.stats}>
        <SurfaceCard style={styles.stat}>
          <AppText variant="title">{stats.total}</AppText>
          <AppText variant="small" color={Colors.muted}>Total</AppText>
        </SurfaceCard>
        <SurfaceCard style={styles.stat}>
          <AppText variant="title">{stats.active}</AppText>
          <AppText variant="small" color={Colors.muted}>Aktif</AppText>
        </SurfaceCard>
        <SurfaceCard style={styles.stat}>
          <AppText variant="title">{stats.assigned}</AppText>
          <AppText variant="small" color={Colors.muted}>Petani</AppText>
        </SurfaceCard>
      </View>

      {loading ? (
        <FeedbackState title="Memuat data lahan…" loading />
      ) : loadError ? (
        <FeedbackState
          title="Data lahan belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadPlots()}
        />
      ) : plots.length === 0 ? (
        <FeedbackState
          title="Belum ada lahan"
          message="Tambahkan lahan pertama untuk memulai pemetaan."
        />
      ) : (
        plots.map((plot) => (
          <SurfaceCard key={plot.id}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitle}>
                <AppText variant="subtitle">{plot.namaLahan}</AppText>
                <AppText variant="small" color={Colors.muted}>
                  {plot.jenisTanaman} · {plot.faseLahan ?? 'Fase belum dicatat'}
                </AppText>
              </View>
              <StatusPill
                label={plot.status === 'aktif' ? 'AKTIF' : 'NONAKTIF'}
                tone={plot.status === 'aktif' ? 'success' : 'danger'}
              />
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <AppText variant="small" color={Colors.muted}>Luas</AppText>
                <AppText variant="smallStrong">{plot.luasHektar ?? '-'} ha</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText variant="small" color={Colors.muted}>Petani</AppText>
                <AppText variant="smallStrong">
                  {plot.farmerName ?? 'Belum diassign'}
                </AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText variant="small" color={Colors.muted}>Radius hadir</AppText>
                <AppText variant="smallStrong">{plot.radiusGeofenceM} m</AppText>
              </View>
              <AppText variant="small" color={Colors.muted}>
                {formatCoordinate(plot.latCenter)}, {formatCoordinate(plot.lngCenter)}
              </AppText>
            </View>

            <View style={styles.actions}>
              <View style={styles.action}>
                <AppButton
                  label="Edit"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/penataan-lahan/form',
                      params: { plotId: plot.id },
                    })
                  }
                />
              </View>
              <View style={styles.action}>
                <AppButton
                  label={plot.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                  variant="secondary"
                  loading={mutatingId === plot.id}
                  onPress={() => handleToggleStatus(plot)}
                />
              </View>
            </View>
          </SurfaceCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  cardTitle: { flex: 1, gap: Spacing.one },
  details: { gap: Spacing.two },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  action: { flex: 1 },
});
