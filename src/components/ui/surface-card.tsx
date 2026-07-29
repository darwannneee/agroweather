import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function SurfaceCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
