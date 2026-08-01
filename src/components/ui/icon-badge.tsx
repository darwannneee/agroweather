import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

const toneStyles = {
  forest: { backgroundColor: Colors.mint, color: Colors.forest },
  sky: { backgroundColor: Colors.sky, color: Colors.skyText },
  amber: { backgroundColor: Colors.amber, color: Colors.amberText },
  danger: { backgroundColor: Colors.dangerBackground, color: Colors.dangerText },
  neutral: { backgroundColor: Colors.canvas, color: Colors.ink },
} as const;

export type IconBadgeTone = keyof typeof toneStyles;

export function IconBadge({
  icon,
  label,
  decorative = true,
  tone = 'forest',
  size = 'md',
  style,
}: {
  icon: string;
  label: string;
  decorative?: boolean;
  tone?: IconBadgeTone;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}) {
  const colors = toneStyles[tone];
  const dimension = size === 'sm' ? 32 : size === 'lg' ? 56 : 44;

  return (
    <View
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : `Ikon ${label}`}
      importantForAccessibility={
        decorative ? 'no-hide-descendants' : 'auto'
      }
      style={[
        styles.badge,
        {
          width: dimension,
          height: dimension,
          backgroundColor: colors.backgroundColor,
        },
        style,
      ]}
    >
      <AppText
        variant={size === 'lg' ? 'title' : 'subtitle'}
        color={colors.color}
        style={styles.icon}
      >
        {icon}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    padding: Spacing.one,
  },
  icon: {
    textAlign: 'center',
  },
});
