import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { AppText } from './app-text';
import { IconBadge, type IconBadgeTone } from './icon-badge';
import { SurfaceCard } from './surface-card';

export function MetricCard({
  icon,
  value,
  label,
  helper,
  tone = 'forest',
  style,
}: {
  icon: string;
  value: string | number;
  label: string;
  helper?: string;
  tone?: IconBadgeTone;
  style?: ViewStyle;
}) {
  return (
    <SurfaceCard style={style}>
      <View style={styles.header}>
        <IconBadge icon={icon} label={label} tone={tone} />
        <View style={styles.copy}>
          <AppText variant="title">{value}</AppText>
          <AppText variant="smallStrong">{label}</AppText>
        </View>
      </View>
      {helper ? (
        <AppText variant="small" color={Colors.muted}>
          {helper}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
  },
});
