import React, { useState } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'md' | 'sm';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingLabel = 'Memuat...',
  style,
}: AppButtonProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: toScale,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isDisabled = disabled || loading;

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    size === 'sm' ? styles.sm : styles.md,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'danger' && styles.danger,
    variant === 'ghost' && styles.ghost,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle: StyleProp<TextStyle> = [
    styles.textBase,
    size === 'sm' && styles.textSm,
    variant === 'primary' && styles.textPrimary,
    variant === 'secondary' && styles.textSecondary,
    variant === 'danger' && styles.textDanger,
    variant === 'ghost' && styles.textGhost,
  ];

  const indicatorColor =
    variant === 'primary'
      ? Colors.textOnDark
      : variant === 'danger'
        ? Colors.danger
        : Colors.primary;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        onPressIn={() => {
          if (isDisabled) return;
          animateTo(0.97, 0.9);
        }}
        onPressOut={() => animateTo(1, 1)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={containerStyle}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={indicatorColor} />
            <Text style={textStyle}>{loadingLabel}</Text>
          </View>
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  md: {
    minHeight: 50,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  textBase: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
  },
  textSm: {
    fontSize: FontSize.xs,
  },
  textPrimary: {
    color: Colors.textOnDark,
  },
  textSecondary: {
    color: Colors.text,
  },
  textDanger: {
    color: Colors.danger,
  },
  textGhost: {
    color: Colors.primary,
  },
});
