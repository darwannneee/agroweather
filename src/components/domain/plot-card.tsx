import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
import type { FarmPlot } from '@/lib/farm-types';

type PlotCardProps = {
  plot: FarmPlot;
  statusLoading?: boolean;
  statusDisabled?: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
};

export function PlotCard({
  plot,
  statusLoading = false,
  statusDisabled = false,
  onEdit,
  onToggleStatus,
}: PlotCardProps) {
  const active = plot.status === 'aktif';
  const statusAction = active ? 'Nonaktifkan' : 'Aktifkan';
  const farmerLabel =
    plot.farmerNames && plot.farmerNames.length > 0
      ? plot.farmerNames.join(', ')
      : plot.farmerName ?? 'Belum diassign';

  return (
    <SurfaceCard accessibilityLabel={`Lahan ${plot.namaLahan}`}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText variant="subtitle">{plot.namaLahan}</AppText>
          <AppText variant="small" color={Colors.muted}>
            {plot.jenisTanaman} · {plot.faseLahan ?? 'Fase belum dicatat'}
          </AppText>
        </View>
        <StatusPill
          label={active ? 'Aktif' : 'Nonaktif'}
          tone={active ? 'success' : 'danger'}
        />
      </View>

      <AppText variant="small">Petani: {farmerLabel}</AppText>
      <AppText variant="small">Luas: {plot.luasHektar ?? '-'} ha</AppText>
      <AppText variant="small">Radius: {plot.radiusGeofenceM} meter</AppText>
      <AppText variant="small" color={Colors.muted}>
        {plot.latCenter.toFixed(5)}, {plot.lngCenter.toFixed(5)}
      </AppText>

      <View style={styles.actions}>
        <AppButton
          label="Edit"
          accessibilityLabel={`Edit ${plot.namaLahan}`}
          variant="secondary"
          onPress={onEdit}
        />
        <AppButton
          label={statusAction}
          accessibilityLabel={`${statusAction} ${plot.namaLahan}`}
          variant={active ? 'danger' : 'forest'}
          loading={statusLoading}
          disabled={statusDisabled}
          onPress={onToggleStatus}
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
});
