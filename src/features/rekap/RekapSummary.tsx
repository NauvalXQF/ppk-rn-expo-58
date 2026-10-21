import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { RekapSesi } from '@/store/selectors';
import { Spacing } from '@/constants/theme';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AttendanceRow } from '@/components/domain/AttendanceRow';
import { formatWaktuPresensi } from '@/utils/date';

export interface RekapSummaryProps {
  rekap: RekapSesi;
  title?: string;
}

export function RekapSummary({
  rekap,
  title = 'Rekap Kehadiran',
}: RekapSummaryProps) {
  const rightText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} rightText={rightText} />

      {rekap.baris.length === 0 ? (
        <EmptyState
          title="Rekap Kosong"
          description="Belum ada praktikan yang melakukan presensi."
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.list}>
          {rekap.baris.map((item) => (
            <AttendanceRow
              key={item.presensi.id}
              nama={item.praktikan.nama}
              nim={item.praktikan.nim}
              waktu={formatWaktuPresensi(item.presensi.waktuPresensi)}
              catatan={item.presensi.catatan}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  list: {
    marginTop: Spacing.xs,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingVertical: Spacing.lg,
  },
});

