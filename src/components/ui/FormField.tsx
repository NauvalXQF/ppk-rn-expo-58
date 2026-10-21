import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  helperText?: string;
  error?: string;
  counter?: string;
}

export function FormField({
  label,
  helperText,
  error,
  counter,
  style,
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {counter ? <Text style={styles.counter}>{counter}</Text> : null}
      </View>

      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : undefined,
          inputProps.multiline ? styles.inputMultiline : undefined,
          style,
        ]}
        placeholderTextColor={Colors.textMuted}
        {...inputProps}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  counter: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: Colors.danger,
  },
  helperText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
});
