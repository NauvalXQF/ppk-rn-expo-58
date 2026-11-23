import React, { useState, type ReactNode } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Pressable,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

interface AppCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'glass' | 'solid';
}

export function AppCard({
  children,
  style,
  onPress,
  variant = 'glass',
}: AppCardProps) {
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

  const isGlass = variant === 'glass';
  const baseStyle = isGlass ? styles.glassCard : styles.solidCard;

  const content = (
    <>
      {isGlass && Platform.OS !== 'web' ? (
        <BlurView
          intensity={28}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => animateTo(0.97, 0.9)}
          onPressOut={() => animateTo(1, 1)}
          style={[baseStyle, style]}
        >
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={[baseStyle, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.card,
  },
  solidCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
});
