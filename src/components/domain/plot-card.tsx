import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

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

function PlotDetailRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap, label: string, value: string }) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={14} color={Colors.muted} />
      <AppText variant="small" color={Colors.muted} style={styles.detailLabel}>
        {label}:
      </AppText>
      <AppText variant="smallStrong" color={Colors.ink} numberOfLines={1} style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
}

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
      : plot.farmerName ?? 'Belum ada petani';

  return (
    <SurfaceCard accessibilityLabel={`Lahan ${plot.namaLahan}`} style={styles.cardLayout}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: active ? Colors.successBackground : Colors.canvas }]}>
          <Feather name="map" size={20} color={active ? Colors.forest : Colors.muted} />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{plot.namaLahan}</AppText>
          <AppText variant="small" color={Colors.muted} numberOfLines={1}>
            {plot.jenisTanaman} · {plot.faseLahan ?? 'Fase belum dicatat'}
          </AppText>
        </View>
        {/* FIX: Dibungkus View dengan flexShrink: 0 agar tidak terpotong jadi "Akti" */}
        <View style={styles.statusWrapper}>
          <StatusPill
            label={active ? 'Aktif' : 'Nonaktif'}
            tone={active ? 'success' : 'neutral'}
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoGrid}>
        <PlotDetailRow icon="users" label="Petani" value={farmerLabel} />
        <PlotDetailRow icon="maximize" label="Luas" value={`${plot.luasHektar ?? '-'} ha`} />
        <PlotDetailRow icon="crosshair" label="Radius" value={`${plot.radiusGeofenceM} meter`} />
        <PlotDetailRow icon="navigation" label="GPS" value={`${plot.latCenter.toFixed(5)}, ${plot.lngCenter.toFixed(5)}`} />
      </View>

      <View style={styles.actions}>
        <Pressable 
          onPress={onEdit} 
          style={({ pressed }) => [styles.actionTextBtn, pressed && styles.pressed]}
        >
          <AppText variant="smallStrong" color={Colors.forest}>Edit Data</AppText>
        </Pressable>
        
        <Pressable 
          onPress={onToggleStatus}
          disabled={statusLoading || statusDisabled} 
          style={({ pressed }) => [
            styles.actionTextBtn, 
            pressed && styles.pressed,
            (statusLoading || statusDisabled) && styles.disabledBtn
          ]}
        >
          <AppText variant="smallStrong" color={active ? Colors.dangerText : Colors.forest}>
            {statusLoading ? 'Memproses...' : statusAction}
          </AppText>
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  cardLayout: {
    padding: Spacing.four,
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  statusWrapper: {
    flexShrink: 0, // Mencegah terpotong
    marginLeft: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.four,
  },
  infoGrid: {
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detailLabel: {
    width: 55,
  },
  detailValue: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionTextBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  disabledBtn: {
    opacity: 0.4,
  }
});