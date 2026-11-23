import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

interface RadioOptionProps {
  selected: boolean;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export function RadioOption({
  selected,
  title,
  subtitle,
  onPress,
}: RadioOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        selected && styles.containerSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, selected && styles.titleSelected]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  containerSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  pressed: {
    opacity: 0.85,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  titleSelected: {
    color: Colors.primary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
