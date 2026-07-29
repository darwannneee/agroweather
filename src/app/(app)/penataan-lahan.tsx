import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { PlotCard } from '@/components/domain/plot-card';
import { PlotStats } from '@/components/domain/plot-stats';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
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

  const stats = useMemo(
    () => ({
      total: plots.length,
      active: plots.filter((plot) => plot.status === 'aktif').length,
      assigned: new Set(
        plots.map((plot) => plot.farmerId).filter((farmerId) => farmerId !== null)
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
      setMutatingId(null);
      void loadPlots();
      return () => {
        focusGeneration.current += 1;
        requestVersion.current += 1;
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
            if (focusGeneration.current !== generation) return;
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
                setMutatingId(null);
              }
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
        <>
          <PlotStats total={stats.total} active={stats.active} assigned={stats.assigned} />
          {plots.map((plot) => (
            <PlotCard
              key={plot.id}
              plot={plot}
              statusLoading={mutatingId === plot.id}
              onEdit={() =>
                router.push({
                  pathname: '/(app)/penataan-lahan/form',
                  params: { plotId: plot.id },
                })
              }
              onToggleStatus={() => handleToggleStatus(plot)}
            />
          ))}
        </>
      )}
    </AppScreen>
  );
}

export default function PlotListRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <PlotListScreen />
    </RoleGuard>
  );
}
