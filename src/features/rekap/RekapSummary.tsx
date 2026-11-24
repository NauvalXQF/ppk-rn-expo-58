import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import type { RekapSesi } from '@/types/models';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppIcon } from '@/components/ui/AppIcon';
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
  const [query, setQuery] = useState('');
  const rightText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;

  const filteredBaris = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rekap.baris;
    return rekap.baris.filter(
      (item) =>
        item.praktikan.nama.toLowerCase().includes(q) ||
        item.praktikan.nim.toLowerCase().includes(q),
    );
  }, [query, rekap.baris]);

  return (
    <View style={styles.container}>
      <SectionHeader title={title} rightText={rightText} />

      {rekap.baris.length > 0 ? (
        <View style={styles.searchBox}>
          <AppIcon name="search" size={15} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cari nama atau NIM peserta..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
        </View>
      ) : null}

      {rekap.baris.length === 0 ? (
        <EmptyState
          title="Rekap Kosong"
          description="Belum ada praktikan yang melakukan presensi."
          style={styles.emptyState}
        />
      ) : filteredBaris.length === 0 ? (
        <EmptyState
          title="Peserta tidak ditemukan"
          description="Coba kata kunci nama atau NIM lain."
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.list}>
          {filteredBaris.map((item) => (
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
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    paddingVertical: 8,
  },
  list: {
    marginTop: Spacing.xs,
  },
  emptyState: {
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
  },
});
