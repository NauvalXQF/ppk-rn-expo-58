import React, { type ReactNode } from 'react';
import { View, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface AppCardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function AppCard({ children, style, onPress }: AppCardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
