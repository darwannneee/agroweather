import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Spacing } from '@/constants/theme';

export function PlotStats({
  total,
  active,
  assigned,
}: {
  total: number;
  active: number;
  assigned: number;
}) {
  const stats = [
    ['Total', total],
    ['Aktif', active],
    ['Petani', assigned],
  ] as const;

  return (
    <View style={styles.row}>
      {stats.map(([label, value]) => (
        <SurfaceCard key={label} style={styles.card}>
          <AppText variant="title">{String(value)}</AppText>
          <AppText variant="small">{label}</AppText>
        </SurfaceCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    minWidth: 88,
    alignItems: 'center',
    padding: Spacing.three,
  },
});
