import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { PlotStats } from '@/components/domain/plot-stats';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors } from '@/constants/theme';
import type { FarmPlot } from '@/lib/farm-types';
import { fetchFarmers } from '@/services/auth';
import { useAuth } from '@/services/auth-context';
import { fetchPlots } from '@/services/plots';

export function PegawaiDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const metrics = useMemo(
    () => ({
      plots: plots.length,
      activePlots: plots.filter((plot) => plot.status === 'aktif').length,
      assignedFarmers: new Set(
        plots.map((plot) => plot.farmerId).filter((farmerId) => farmerId !== null)
      ).size,
    }),
    [plots]
  );

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    try {
      const [nextPlots] = await Promise.all([fetchPlots(), fetchFarmers()]);
      if (requestVersion.current === version) {
        setPlots(nextPlots);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Data operasional belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  function handleLogout() {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
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

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Dashboard Internal"
        title={`Pagi, ${profile?.nama ?? 'Internal'}`}
        description="Pantau lahan dan penanggung jawab lapangan."
        action={<AppButton label="Keluar" variant="secondary" onPress={handleLogout} />}
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
          <PlotStats
            total={metrics.plots}
            active={metrics.activePlots}
            assigned={metrics.assignedFarmers}
          />

          <SurfaceCard style={styles.operationsCard}>
            <AppText variant="subtitle" color={Colors.surface}>
              Penataan Lahan
            </AppText>
            <AppText variant="small" color={Colors.surface}>
              Kelola titik, radius, komoditas, dan petani penanggung jawab.
            </AppText>
            <AppButton
              label="Kelola Lahan"
              onPress={() => router.push('/(app)/penataan-lahan')}
            />
          </SurfaceCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  operationsCard: {
    backgroundColor: Colors.forest,
  },
});

export default function PegawaiScreen() {
  return (
    <RoleGuard requiredRole="internal">
      <PegawaiDashboard />
    </RoleGuard>
  );
}
