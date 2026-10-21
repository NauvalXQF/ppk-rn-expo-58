import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}: AppButtonProps) {
  const getContainerVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondary;
      case 'danger':
        return styles.danger;
      case 'ghost':
        return styles.ghost;
      case 'primary':
      default:
        return styles.primary;
    }
  };

  const getPressedVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryPressed;
      case 'danger':
        return styles.dangerPressed;
      case 'ghost':
        return styles.ghostPressed;
      case 'primary':
      default:
        return styles.primaryPressed;
    }
  };

  const getTextVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
      case 'ghost':
        return styles.ghostText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        getContainerVariantStyle(),
        pressed && !disabled && getPressedVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.textBase,
          getTextVariantStyle(),
          disabled && styles.disabledText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: 44,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  textBase: {
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  primaryPressed: {
    backgroundColor: Colors.primaryPressed,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  secondaryPressed: {
    backgroundColor: Colors.neutralSoft,
  },
  secondaryText: {
    color: Colors.text,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  dangerPressed: {
    backgroundColor: '#B42318',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: Colors.neutralSoft,
  },
  ghostText: {
    color: Colors.primary,
  },
  disabled: {
    backgroundColor: Colors.neutralSoft,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});

