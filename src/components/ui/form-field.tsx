import { useId } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { AppText } from './app-text';

export function FormField({
  label,
  error,
  help,
  leftIcon, 
  rightElement, 
  inputProps,
}: {
  label: string;
  error?: string | null;
  help?: string;
  leftIcon?: React.ReactNode; // <-- Ubah ke ReactNode agar bisa menerima Icon dari expo
  rightElement?: React.ReactNode;
  inputProps: TextInputProps;
}) {
  const nativeID = useId();
  return (
    <View style={styles.wrapper}>
      <AppText nativeID={nativeID} variant="smallStrong" color={Colors.muted}>
        {label}
      </AppText>
      
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          accessibilityLabelledBy={nativeID}
          accessibilityState={{ disabled: Boolean(inputProps.editable === false) }}
          placeholderTextColor={Colors.border}
          style={[styles.input, inputProps.multiline && styles.multiline]}
          {...inputProps}
          accessibilityHint={error ?? inputProps.accessibilityHint}
        />

        {rightElement && (
          <View style={styles.rightElementContainer}>
            {rightElement}
          </View>
        )}
      </View>

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
  wrapper: { gap: Spacing.one },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: Radius.input,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  inputError: { borderColor: Colors.dangerText },
  leftIconContainer: {
    marginRight: Spacing.two,
  },
  rightElementContainer: {
    marginLeft: Spacing.two,
  },
  input: {
    ...Typography.body,
    flex: 1,
    color: Colors.ink,
    minHeight: 52,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: Spacing.three },
});