import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { DetailSesi } from '@/types/models';
import { formatJam, formatTanggal } from '@/utils/date';

interface SessionSummaryCardProps {
  detail: DetailSesi;
  labNama?: string;
}

export function SessionSummaryCard({
  detail,
  labNama,
}: SessionSummaryCardProps) {
  const { sesi, praktikum, kelas, asisten } = detail;
  const formattedTanggal = formatTanggal(sesi.tanggal);
  const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;
  const displayLab = labNama?.trim() || sesi.labNama?.trim() || sesi.ruang;

  return (
    <AppCard style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.praktikumText}>{praktikum.nama}</Text>
        <StatusBadge status={sesi.status} />
      </View>

      <Text style={styles.topikText}>
        {kelas.nama} · {sesi.topik}
      </Text>

      <View style={styles.divider} />

      <View style={styles.detailList}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tanggal</Text>
          <Text style={styles.detailValue}>{formattedTanggal}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Waktu</Text>
          <Text style={styles.detailValue}>{formattedWaktu}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Laboratorium</Text>
          <Text style={styles.detailValue}>{displayLab}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Asisten</Text>
          <Text style={styles.detailValue}>{asisten.nama}</Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  praktikumText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    marginRight: Spacing.sm,
  },
  topikText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  detailList: {
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    flexShrink: 1,
  },
});
