import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { AppText } from './app-text';
import { IconBadge, type IconBadgeTone } from './icon-badge';

export function InfoRow({
  icon,
  label,
  value,
  tone = 'neutral',
  style,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: IconBadgeTone;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.row, style]}>
      <IconBadge icon={icon} label={label} tone={tone} size="sm" />
      <View style={styles.copy}>
        <AppText variant="label" color={Colors.muted}>
          {label}
        </AppText>
        <AppText variant="smallStrong">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
  },
});