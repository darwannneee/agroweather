import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

const tones = {
  success: [Colors.successBackground, Colors.successText],
  warning: [Colors.warningBackground, Colors.warningText],
  danger: [Colors.dangerBackground, Colors.dangerText],
  neutral: [Colors.canvas, Colors.muted],
} as const;

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof tones;
}) {
  const [backgroundColor, color] = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <AppText variant="label" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
