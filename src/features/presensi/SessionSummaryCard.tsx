import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, FontSize } from '@/constants/theme';
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
  const { sesi, praktikum, kelas } = detail;
  const formattedTanggal = formatTanggal(sesi.tanggal);
  const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;
  const displayLab = labNama?.trim() || sesi.labNama?.trim() || sesi.ruang;

  return (
    <AppCard style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.praktikumText} numberOfLines={1}>
          {kelas.nama} · {praktikum.nama}
        </Text>
        <StatusBadge status={sesi.status} />
      </View>

      <Text style={styles.topikText}>{sesi.topik}</Text>

      <Text style={styles.metaText}>
        {formattedTanggal}, {formattedWaktu} WIB · {displayLab}
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  praktikumText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  topikText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
