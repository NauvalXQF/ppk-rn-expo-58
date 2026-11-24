import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  helperText?: string;
  error?: string;
  counter?: string;
  rightAccessory?: React.ReactNode;
}

export function FormField({
  label,
  helperText,
  error,
  counter,
  rightAccessory,
  style,
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {counter ? <Text style={styles.counter}>{counter}</Text> : null}
      </View>

      {rightAccessory ? (
        <View
          style={[
            styles.inputWrapper,
            error ? styles.inputError : undefined,
          ]}
        >
          <TextInput
            style={[
              styles.inputInner,
              inputProps.multiline ? styles.inputMultiline : undefined,
              style,
            ]}
            placeholderTextColor={Colors.textMuted}
            {...inputProps}
          />
          <View style={styles.accessoryWrap}>{rightAccessory}</View>
        </View>
      ) : (
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
      )}

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
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  counter: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputWrapper: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inputInner: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 10,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
  accessoryWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: Colors.danger,
  },
  helperText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.danger,
  },
});
