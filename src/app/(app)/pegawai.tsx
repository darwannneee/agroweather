import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
import { jakartaDate } from '@/lib/daily-operations';
import { useAuth } from '@/services/auth-context';
import {
  fetchDailyOperations,
  type DailyOperations,
} from '@/services/daily-operations';

const generationLabel = {
  running: 'Generate sedang diproses',
  succeeded: 'Generate terakhir berhasil',
  partial: 'Generate selesai sebagian',
  failed: 'Generate terakhir gagal',
} as const;

export function PegawaiDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [operations, setOperations] = useState<DailyOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const profileId = profile?.id ?? null;

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    if (!profileId) {
      setOperations(null);
      setLoading(false);
      return;
    }

    try {
      const nextOperations = await fetchDailyOperations(jakartaDate());
      if (requestVersion.current === version) {
        setOperations(nextOperations);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Data operasional belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [profileId]);

  useEffect(() => {
    void loadDashboard();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const attendance = operations?.attendance ?? [];
    const present = attendance.filter(
      ({ status, record }) => status === 'present' && record !== null
    ).length;
    const lastGeneration = operations?.lastGeneration ?? null;

    return {
      present,
      farmers: attendance.length,
      tasks: operations?.tasks.length ?? 0,
      drafts: operations?.pendingDraftCount ?? 0,
      warnings: lastGeneration
        ? lastGeneration.skippedCount + lastGeneration.failedCount
        : 0,
    };
  }, [operations]);

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
        description="Pantau kehadiran, task hari ini, dan draft AI sebelum turun ke lahan."
        action={
          <AppButton
            label="Keluar"
            variant="secondary"
            onPress={handleLogout}
          />
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
          <View style={styles.metrics}>
            <SurfaceCard style={styles.metricCard}>
              <AppText variant="title">
                {metrics.present}/{metrics.farmers} Sudah absen
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Kehadiran valid hari ini
              </AppText>
            </SurfaceCard>
            <SurfaceCard style={styles.metricCard}>
              <AppText variant="title">
                {metrics.tasks} Task hari ini
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Seluruh status operasional
              </AppText>
            </SurfaceCard>
            <SurfaceCard style={styles.metricCard}>
              <AppText variant="title">
                {metrics.drafts} Draft AI menunggu
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Perlu review internal
              </AppText>
            </SurfaceCard>
          </View>

          <SurfaceCard>
            <AppText variant="subtitle">Generate Task AI</AppText>
            {operations?.lastGeneration ? (
              <>
                <AppText variant="bodyStrong">
                  {generationLabel[operations.lastGeneration.status]}
                </AppText>
                <AppText variant="small" color={Colors.muted}>
                  {operations.lastGeneration.successCount} berhasil ·{' '}
                  {operations.lastGeneration.skippedCount} dilewati ·{' '}
                  {operations.lastGeneration.failedCount} gagal
                </AppText>
                <AppText variant="smallStrong">
                  {metrics.warnings} peringatan
                </AppText>
              </>
            ) : (
              <AppText variant="small" color={Colors.muted}>
                Belum ada generate task hari ini.
              </AppText>
            )}
            <AppButton
              label="Review Draft AI"
              onPress={() => router.push('/(app)/ai-tasks' as Href)}
            />
          </SurfaceCard>

          <SurfaceCard>
            <AppText variant="subtitle">Operasional Harian</AppText>
            <AppText variant="small" color={Colors.muted}>
              Lihat detail kehadiran dan status setiap task hari ini.
            </AppText>
            <AppButton
              label="Operasional Harian"
              variant="forest"
              onPress={() =>
                router.push('/(app)/daily-operations' as Href)
              }
            />
          </SurfaceCard>

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
  metrics: {
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
  },
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
