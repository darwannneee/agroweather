import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge';
import { Colors, Radius, Spacing } from '@/constants/theme';

type CardState = 'idle' | 'checking' | 'success' | 'warning' | 'danger' | 'neutral';

const stateConfig = {
  idle: {
    eyebrow: 'GPS BELUM AKTIF',
    icon: 'map-pin',
    tone: 'forest',
    background: Colors.forest,
    border: Colors.forest,
    text: Colors.surface,
  },
  checking: {
    eyebrow: 'MENGAMBIL LOKASI',
    icon: 'navigation',
    tone: 'sky',
    background: Colors.forestMuted,
    border: Colors.forestMuted,
    text: Colors.surface,
  },
  success: {
    eyebrow: 'DI DALAM RADIUS',
    icon: 'check-circle',
    tone: 'forest',
    background: Colors.successBackground,
    border: Colors.successBorder,
    text: Colors.successText,
  },
  warning: {
    eyebrow: 'PERIKSA LOKASI',
    icon: 'alert-triangle',
    tone: 'amber',
    background: Colors.warningBackground,
    border: Colors.warningBorder,
    text: Colors.warningText,
  },
  danger: {
    eyebrow: 'LOKASI BERMASALAH',
    icon: 'x-circle',
    tone: 'danger',
    background: Colors.dangerBackground,
    border: Colors.dangerBorder,
    text: Colors.dangerText,
  },
  neutral: {
    eyebrow: 'STATUS LOKASI',
    icon: 'info',
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
          icon={<Feather name={config.icon as any} size={18} color={dark ? Colors.ink : config.text} />}
          label={title}
          tone={config.tone as IconBadgeTone}
        />
        <View style={styles.copy}>
          <AppText variant="label" color={config.text}>{config.eyebrow}</AppText>
          <AppText variant="subtitle" color={config.text}>{title}</AppText>
        </View>
      </View>
      
      <View style={styles.body}>
        <AppText variant="small" color={config.text}>{message}</AppText>
        {meta ? <AppText variant="label" color={config.text}>{meta}</AppText> : null}
      </View>

      {state !== 'checking' && actionLabel && onAction ? (
        <View style={styles.actionContainer}>
          <AppButton
            label={actionLabel}
            variant={dark ? 'primary' : 'secondary'}
            onPress={onAction}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  body: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  actionContainer: {
    marginTop: Spacing.one,
  },
});