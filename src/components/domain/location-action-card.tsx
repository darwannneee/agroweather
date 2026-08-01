import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge';

type CardState = 'idle' | 'checking' | 'success' | 'warning' | 'danger' | 'neutral';

const stateConfig = {
  idle: {
    eyebrow: 'GPS BELUM AKTIF',
    icon: '📍',
    tone: 'forest',
    background: Colors.forest,
    border: Colors.border,
    text: Colors.surface,
  },
  checking: {
    eyebrow: 'MENGAMBIL LOKASI',
    icon: '🛰️',
    tone: 'sky',
    background: Colors.forestMuted,
    border: Colors.border,
    text: Colors.surface,
  },
  success: {
    eyebrow: 'DI DALAM RADIUS',
    icon: '✅',
    tone: 'forest',
    background: Colors.successBackground,
    border: Colors.successBorder,
    text: Colors.successText,
  },
  warning: {
    eyebrow: 'PERIKSA LOKASI',
    icon: '⚠️',
    tone: 'amber',
    background: Colors.warningBackground,
    border: Colors.warningBorder,
    text: Colors.warningText,
  },
  danger: {
    eyebrow: 'LOKASI BERMASALAH',
    icon: '🚫',
    tone: 'danger',
    background: Colors.dangerBackground,
    border: Colors.dangerBorder,
    text: Colors.dangerText,
  },
  neutral: {
    eyebrow: 'STATUS LOKASI',
    icon: '📍',
    tone: 'neutral',
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
      <View style={styles.header}>
        <IconBadge
          icon={config.icon}
          label={title}
          tone={config.tone as IconBadgeTone}
        />
        <View style={styles.copy}>
          <AppText variant="label" color={config.text}>{config.eyebrow}</AppText>
          <AppText variant="subtitle" color={config.text}>{title}</AppText>
        </View>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
});
