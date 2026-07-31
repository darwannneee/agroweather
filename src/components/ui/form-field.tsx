import { useId } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

import { AppText } from './app-text';

export function FormField({
  label,
  error,
  help,
  inputProps,
}: {
  label: string;
  error?: string | null;
  help?: string;
  inputProps: TextInputProps;
}) {
  const nativeID = useId();
  return (
    <View style={styles.wrapper}>
      <AppText nativeID={nativeID} variant="smallStrong">{label}</AppText>
      <TextInput
        accessibilityLabelledBy={nativeID}
        accessibilityState={{ disabled: Boolean(inputProps.editable === false) }}
        placeholderTextColor={Colors.muted}
        style={[styles.input, error && styles.inputError, inputProps.multiline && styles.multiline]}
        {...inputProps}
        accessibilityHint={error ?? inputProps.accessibilityHint}
      />
      {error ? (
        <AppText
          variant="small"
          color={Colors.dangerText}
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          {error}
        </AppText>
      ) : help ? (
        <AppText variant="small" color={Colors.muted}>{help}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  input: {
    ...Typography.body,
    minHeight: 48,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  inputError: { borderColor: Colors.dangerText },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
