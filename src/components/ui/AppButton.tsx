import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  const getContainerStyle = (pressed: boolean): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    if (variant === 'primary') {
      list.push(styles.primary);
      if (pressed) list.push(styles.primaryPressed);
    } else if (variant === 'secondary') {
      list.push(styles.secondary);
      if (pressed) list.push(styles.secondaryPressed);
    } else if (variant === 'danger') {
      list.push(styles.danger);
      if (pressed) list.push(styles.dangerPressed);
    } else if (variant === 'ghost') {
      list.push(styles.ghost);
      if (pressed) list.push(styles.ghostPressed);
    }

    if (disabled) {
      list.push(styles.disabled);
    }

    if (style) {
      list.push(style);
    }

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.text];
    if (variant === 'primary' || variant === 'danger') {
      list.push(styles.textLight);
    } else if (variant === 'secondary') {
      list.push(styles.textSecondary);
    } else if (variant === 'ghost') {
      list.push(styles.textGhost);
    }

    if (disabled) {
      list.push(styles.textDisabled);
    }

    return list;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => getContainerStyle(pressed)}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : Colors.primary}
        />
      ) : (
        <Text style={getTextStyle()}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  primaryPressed: {
    backgroundColor: Colors.primaryPressed,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryPressed: {
    backgroundColor: Colors.neutralSoft,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  dangerPressed: {
    backgroundColor: '#B42318',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: Colors.neutralSoft,
  },
  disabled: {
    backgroundColor: Colors.border,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: Colors.text,
  },
  textGhost: {
    color: Colors.textMuted,
  },
  textDisabled: {
    color: Colors.textMuted,
  },
});
