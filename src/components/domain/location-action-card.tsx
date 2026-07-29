import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';

type CardState = 'idle' | 'checking' | 'success' | 'warning' | 'danger' | 'neutral';

const stateConfig = {
  idle: {
    eyebrow: 'GPS BELUM AKTIF',
    background: Colors.forest,
    border: Colors.border,
    text: Colors.surface,
  },
  checking: {
    eyebrow: 'MENGAMBIL LOKASI',
    background: Colors.forestMuted,
    border: Colors.border,
    text: Colors.surface,
  },
  success: {
    eyebrow: 'DI DALAM RADIUS',
    background: Colors.successBackground,
    border: Colors.successBorder,
    text: Colors.successText,
  },
  warning: {
    eyebrow: 'PERIKSA LOKASI',
    background: Colors.warningBackground,
    border: Colors.warningBorder,
    text: Colors.warningText,
  },
  danger: {
    eyebrow: 'LOKASI BERMASALAH',
    background: Colors.dangerBackground,
    border: Colors.dangerBorder,
    text: Colors.dangerText,
  },
  neutral: {
    eyebrow: 'STATUS LOKASI',
    background: Colors.surface,
    border: Colors.border,
    text: Colors.ink,
  },
} as const;

export function LocationActionCard({
  state,
  title,
  message,
  meta,
  actionLabel,
  onAction,
}: {
  state: CardState;
  title: string;
  message: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const config = stateConfig[state];
  const dark = state === 'idle' || state === 'checking';

  return (
    <View
      accessibilityLiveRegion="polite"
      aria-live="polite"
      style={[
        styles.card,
        { backgroundColor: config.background, borderColor: config.border },
      ]}
    >
      <AppText variant="label" color={config.text}>{config.eyebrow}</AppText>
      <AppText variant="subtitle" color={config.text}>{title}</AppText>
      <AppText variant="small" color={config.text}>{message}</AppText>
      {meta ? <AppText variant="label" color={config.text}>{meta}</AppText> : null}
      {state !== 'checking' && actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          variant={dark ? 'primary' : 'secondary'}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.hero,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
