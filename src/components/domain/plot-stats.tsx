import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { AppText } from '../ui/app-text';
import { SurfaceCard } from '../ui/surface-card';

export function PlotStats({
  total,
  active,
  assigned,
}: {
  total: number;
  active: number;
  assigned: number;
}) {
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.statColumn}>
        <View style={[styles.iconWrapper, { backgroundColor: Colors.sky }]}>
          <Feather name="map" size={18} color={Colors.skyText} />
        </View>
        <AppText variant="display" style={styles.value}>{total}</AppText>
        <AppText variant="smallStrong" color={Colors.muted}>Total Lahan</AppText>
      </View>

      <View style={styles.divider} />

      <View style={styles.statColumn}>
        <View style={[styles.iconWrapper, { backgroundColor: Colors.successBackground }]}>
          <Feather name="check-circle" size={18} color={Colors.forest} />
        </View>
        <AppText variant="display" style={styles.value}>{active}</AppText>
        <AppText variant="smallStrong" color={Colors.muted}>Lahan Aktif</AppText>
      </View>

      <View style={styles.divider} />

      <View style={styles.statColumn}>
        <View style={[styles.iconWrapper, { backgroundColor: Colors.warningBackground }]}>
          <Feather name="users" size={18} color={Colors.amberText} />
        </View>
        <AppText variant="display" style={styles.value}>{assigned}</AppText>
        <AppText variant="smallStrong" color={Colors.muted}>Petani</AppText>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    color: Colors.ink,
    fontSize: 28, // Sedikit diperkecil agar pas
    lineHeight: 32,
  },
  divider: {
    width: 1,
    height: '70%',
    backgroundColor: Colors.border,
  },
});