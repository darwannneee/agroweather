import { StyleSheet, View } from 'react-native';

import { MetricCard } from '@/components/ui/metric-card';
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
    ['🧭', 'Total', total, 'Semua lahan'],
    ['✅', 'Aktif', active, 'Siap operasional'],
    ['👨‍🌾', 'Petani', assigned, 'Terhubung'],
  ] as const;

  return (
    <View style={styles.row}>
      {stats.map(([icon, label, value, helper]) => (
        <MetricCard
          key={label}
          icon={icon}
          value={value}
          label={label}
          helper={helper}
          tone={label === 'Aktif' ? 'forest' : label === 'Total' ? 'sky' : 'amber'}
          style={styles.card}
        />
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
