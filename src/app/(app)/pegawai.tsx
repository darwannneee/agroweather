import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { WeatherSummaryCard } from '@/components/domain/weather-summary-card';
import { ActionTile } from '@/components/ui/action-tile';
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
            <MetricCard
              icon="✅"
              value={`${metrics.present}/${metrics.farmers} Sudah absen`}
              label="Kehadiran"
              helper="Kehadiran valid hari ini"
              tone="forest"
            />
            <MetricCard
              icon="📋"
              value={`${metrics.tasks} Task hari ini`}
              label="Operasional"
              helper="Seluruh status operasional"
              tone="sky"
            />
            <MetricCard
              icon="🤖"
              value={`${metrics.drafts} Draft AI menunggu`}
              label="AI Draft"
              helper="Perlu review internal"
              tone="amber"
            />
          </View>

          <SurfaceCard>
            <View style={styles.cardHeader}>
              <IconBadge icon="🌱" label="Generate Task AI" tone="forest" />
              <View style={styles.copy}>
                <AppText variant="subtitle">Generate Task AI</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Draft operasional dari cuaca dan kondisi lahan.
                </AppText>
              </View>
            </View>
            {operations?.lastGeneration ? (
              <View style={styles.infoStack}>
                <InfoRow
                  icon="⚙️"
                  label="Status"
                  value={generationLabel[operations.lastGeneration.status]}
                  tone="sky"
                />
                <InfoRow
                  icon="📦"
                  label="Hasil"
                  value={`${operations.lastGeneration.successCount} berhasil · ${operations.lastGeneration.skippedCount} dilewati · ${operations.lastGeneration.failedCount} gagal`}
                  tone="neutral"
                />
                <InfoRow
                  icon="⚠️"
                  label="Peringatan"
                  value={`${metrics.warnings} peringatan`}
                  tone={metrics.warnings > 0 ? 'amber' : 'forest'}
                />
              </View>
            ) : (
              <AppText variant="small" color={Colors.muted}>
                Belum ada generate task hari ini.
              </AppText>
            )}
          </SurfaceCard>

          <WeatherSummaryCard weather={operations?.weather ?? []} />

          <View style={styles.actionGrid}>
            <ActionTile
              icon="🧭"
              title="Review Draft AI"
              description="Cek rekomendasi task sebelum jadi operasional."
              actionLabel="Review"
              tone="amber"
              onPress={() => router.push('/(app)/ai-tasks' as Href)}
            />
            <ActionTile
              icon="🗓️"
              title="Operasional Harian"
              description="Detail kehadiran dan status setiap task hari ini."
              actionLabel="Buka"
              tone="sky"
              onPress={() =>
                router.push('/(app)/daily-operations' as Href)
              }
            />
            <ActionTile
              icon="🗺️"
              title="Kelola Lahan"
              description="Titik GPS, radius, komoditas, dan petani."
              actionLabel="Kelola"
              tone="forest"
              onPress={() => router.push('/(app)/penataan-lahan')}
            />
            <ActionTile
              icon="👨‍🌾"
              title="Kelola Petani"
              description="Tambah auto-confirm dan tempatkan ke lahan."
              actionLabel="Kelola"
              tone="forest"
              onPress={() => router.push('/(app)/petani-management' as Href)}
            />
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  infoStack: {
    gap: Spacing.two,
  },
  actionGrid: {
    gap: Spacing.three,
  },
});

export default function PegawaiScreen() {
  return (
    <RoleGuard requiredRole="internal">
      <PegawaiDashboard />
    </RoleGuard>
  );
}
