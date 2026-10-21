import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  rightText?: string;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, rightText, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {rightText ? <Text style={styles.rightText}>{rightText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  rightText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});

