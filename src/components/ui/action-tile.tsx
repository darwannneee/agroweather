import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';
import { IconBadge, type IconBadgeTone } from './icon-badge';
import { SurfaceCard } from './surface-card';

export function ActionTile({
  icon,
  title,
  description,
  actionLabel = 'Buka',
  tone = 'forest',
  onPress,
  style,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  tone?: IconBadgeTone;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressTarget,
        pressed && styles.pressed,
        style,
      ]}
    >
      <SurfaceCard style={styles.card}>
        <View style={styles.header}>
          <IconBadge icon={icon} label={title} tone={tone} />
          <View style={styles.copy}>
            <AppText variant="subtitle">{title}</AppText>
            <AppText variant="small" color={Colors.muted}>
              {description}
            </AppText>
          </View>
        </View>
        <View style={styles.actionRow}>
          <AppText variant="smallStrong" color={Colors.forest}>
            {actionLabel}
          </AppText>
          <AppText variant="smallStrong" color={Colors.forest}>
            →
          </AppText>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressTarget: {
    minHeight: 44,
    borderRadius: Radius.card,
  },
  pressed: {
    opacity: 0.84,
  },
  card: {
    minHeight: 118,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
