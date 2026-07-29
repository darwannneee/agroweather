import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { AppText } from './app-text';

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <AppText variant="label">{eyebrow.toUpperCase()}</AppText> : null}
        <AppText variant="title">{title}</AppText>
        {description ? <AppText variant="small">{description}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  copy: { flex: 1, gap: Spacing.one },
});
