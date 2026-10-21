import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { StatusSesi } from '@/types/models';
import { LABEL_STATUS } from '@/types/models';
import { FontSize, Radius, Spacing } from '@/constants/theme';

interface StatusBadgeProps {
  status: StatusSesi;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const label = LABEL_STATUS[status] || status;

  return (
    <View style={[styles.badge, styles[status], style]}>
      <Text style={[styles.text, styles[`${status}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  dijadwalkan: {
    backgroundColor: '#E8F0FE',
  },
  dijadwalkanText: {
    color: '#1A56DB',
  },
  dibuka: {
    backgroundColor: '#E6F9EE',
  },
  dibukaText: {
    color: '#067647',
  },
  ditutup: {
    backgroundColor: '#F2F4F7',
  },
  ditutupText: {
    color: '#475467',
  },
});

