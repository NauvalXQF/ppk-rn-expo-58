import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/theme';
import { LABEL_STATUS, type StatusSesi } from '@/types/models';

interface StatusBadgeProps {
  status: StatusSesi;
}

const statusStyles: Record<
  StatusSesi,
  { backgroundColor: string; color: string }
> = {
  dijadwalkan: {
    backgroundColor: Colors.warningSoft,
    color: Colors.warning,
  },
  dibuka: {
    backgroundColor: Colors.successSoft,
    color: Colors.success,
  },
  ditutup: {
    backgroundColor: Colors.neutralSoft,
    color: Colors.textMuted,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
});
