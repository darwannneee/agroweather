import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';

type CardState = 'idle' | 'checking' | 'success' | 'warning' | 'danger' | 'neutral';

const stateConfig = {
  idle: { eyebrow: 'GPS BELUM AKTIF', background: Colors.forest, text: Colors.surface },
  checking: { eyebrow: 'MENGAMBIL LOKASI', background: Colors.forestMuted, text: Colors.surface },
  success: { eyebrow: 'DI DALAM RADIUS', background: Colors.successBackground, text: Colors.successText },
  warning: { eyebrow: 'PERIKSA LOKASI', background: Colors.warningBackground, text: Colors.warningText },
  danger: { eyebrow: 'LOKASI BERMASALAH', background: Colors.dangerBackground, text: Colors.dangerText },
  neutral: { eyebrow: 'STATUS LOKASI', background: Colors.surface, text: Colors.ink },
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
    <View style={[styles.card, { backgroundColor: config.background }]}>
      <AppText variant="label" color={config.text}>{config.eyebrow}</AppText>
      <AppText variant="subtitle" color={config.text}>{title}</AppText>
      <AppText variant="small" color={config.text}>{message}</AppText>
      {meta ? <AppText variant="label" color={config.text}>{meta}</AppText> : null}
      {actionLabel && onAction ? (
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
    borderRadius: Radius.hero,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
