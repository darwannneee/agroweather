import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'forest' | 'secondary' | 'danger';

const palette = {
  primary: { background: Colors.harvest, pressed: Colors.harvestPressed, text: Colors.ink },
  forest: { background: Colors.forest, pressed: Colors.forestPressed, text: Colors.surface },
  secondary: { background: Colors.surface, pressed: Colors.canvas, text: Colors.forest },
  danger: { background: Colors.dangerBackground, pressed: Colors.dangerBorder, text: Colors.dangerText },
} satisfies Record<ButtonVariant, { background: string; pressed: string; text: string }>;

export function AppButton({
  label,
  icon,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  const colors = palette[variant];
  const blocked = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: blocked }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.pressed : colors.background },
        variant === 'secondary' && styles.outline,
        blocked && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            typeof icon === 'string' ? (
              <AppText variant="bodyStrong" color={colors.text}>
                {icon}
              </AppText>
            ) : (
              icon
            )
          ) : null}
          <AppText variant="bodyStrong" color={colors.text}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  outline: { borderWidth: 1, borderColor: Colors.border },
  disabled: { opacity: 0.55 },
});