import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { LABEL_STATUS, type StatusSesi } from '@/types/models';

interface StatusBadgeProps {
  status: StatusSesi;
}

const statusStyles: Record<
  StatusSesi,
  { backgroundColor: string; color: string }
> = {
  dijadwalkan: {
    backgroundColor: '#E8F0FE',
    color: '#1A56DB',
  },
  dibuka: {
    backgroundColor: '#E6F9EE',
    color: '#067647',
  },
  ditutup: {
    backgroundColor: '#F2F4F7',
    color: '#475467',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusStyles[status] || statusStyles.dijadwalkan;

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.label, { color: config.color }]}>
        {LABEL_STATUS[status] ?? status}
      </Text>
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
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
