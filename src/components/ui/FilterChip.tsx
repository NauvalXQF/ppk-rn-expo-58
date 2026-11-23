import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { AppText } from './AppText';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function FilterChip({
  label,
  active = false,
  onPress,
  style,
}: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.active : styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      <AppText
        variant="caption"
        weight={active ? 'medium' : 'regular'}
        color={active ? Colors.textOnDark : Colors.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 30,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  active: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inactive: {
    backgroundColor: Colors.glassStrong,
    borderColor: Colors.glassBorder,
  },
  pressed: {
    opacity: 0.85,
  },
});
