import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { AppButton } from './app-button';
import { AppText } from './app-text';
import { IconBadge } from './icon-badge';

export function FeedbackState({
  title,
  message,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrapper}>
      {loading ? (
        <ActivityIndicator color={Colors.forest} />
      ) : (
        <IconBadge icon="🌾" label={title} tone="forest" size="lg" />
      )}
      <AppText variant="subtitle">{title}</AppText>
      {message ? <AppText variant="small" color={Colors.muted}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
});
