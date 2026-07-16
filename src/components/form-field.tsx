import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

type FormFieldProps = {
  label: string;
  error?: string | null;
  children: (props: { hasError: boolean }) => ReactNode;
};

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <View style={styles.wrapper}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      {children({ hasError: Boolean(error) })}
      {error ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ThemedInputProps = TextInputProps & {
  hasError?: boolean;
};

export function ThemedInput({ hasError, style, ...rest }: ThemedInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          borderColor: hasError ? '#dc2626' : focused ? '#3c87f7' : 'transparent',
          borderWidth: hasError || focused ? 1.5 : 0,
        },
        styles.input,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.half },
  label: { marginLeft: Spacing.one },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    fontSize: 16,
  },
  error: { marginLeft: Spacing.one },
});
