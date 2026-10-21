import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { StatusSesi } from '@/types/models';
import { AppCard } from '@/components/ui/AppCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface SessionCardProps {
  praktikum: string;
  kelas: string;
  topik: string;
  tanggal: string;
  waktu: string;
  ruang: string;
  status: StatusSesi;
  meta?: string;
  metaTone?: 'default' | 'success' | 'warning' | 'danger';
  onPress: () => void;
}

export function SessionCard({
  kelas,
  topik,
  tanggal,
  waktu,
  ruang,
  status,
  meta,
  metaTone = 'default',
  onPress,
}: SessionCardProps) {
  const getMetaColor = (): string => {
    switch (metaTone) {
      case 'success':
        return Colors.success;
      case 'warning':
        return Colors.warning;
      case 'danger':
        return Colors.danger;
      default:
        return Colors.textMuted;
    }
  };

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kelasText}>{kelas}</Text>
        <StatusBadge status={status} />
      </View>

      <Text style={styles.topikText}>{topik}</Text>

      <View style={styles.metaInfoRow}>
        <Text style={styles.detailText}>
          {tanggal} · {waktu}
        </Text>
        <Text style={styles.detailText}>{ruang}</Text>
      </View>

      {meta ? (
        <View style={styles.footerRow}>
          <Text style={[styles.metaText, { color: getMetaColor() }]}>
            {meta}
          </Text>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs + 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kelasText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  topikText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  metaInfoRow: {
    gap: 2,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  footerRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralSoft,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
