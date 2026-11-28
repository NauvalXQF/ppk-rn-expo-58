import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import type { RekapSesi, RekapSesiDetail } from '@/types/models';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppIcon } from '@/components/ui/AppIcon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AttendanceRow } from '@/components/domain/AttendanceRow';
import { formatWaktuPresensi } from '@/utils/date';

export interface RekapSummaryProps {
  rekap: RekapSesi;
  rekapDetail?: RekapSesiDetail;
  title?: string;
}

export function RekapSummary({
  rekap,
  rekapDetail,
  title = 'Rekap Kehadiran',
}: RekapSummaryProps) {
  const [query, setQuery] = useState('');
  const izinCount = rekapDetail?.jumlahIzin ?? 0;
  const rightText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir${
    izinCount > 0 ? ` · ${izinCount} izin` : ''
  }`;

  const filteredBaris = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rekap.baris;
    return rekap.baris.filter(
      (item) =>
        item.praktikan.nama.toLowerCase().includes(q) ||
        item.praktikan.nim.toLowerCase().includes(q),
    );
  }, [query, rekap.baris]);

  const filteredIzin = useMemo(() => {
    const list = rekapDetail?.barisIzin ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        item.nim.toLowerCase().includes(q),
    );
  }, [query, rekapDetail?.barisIzin]);

  const hasAnyRows = rekap.baris.length > 0 || (rekapDetail?.barisIzin.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} rightText={rightText} />

      {hasAnyRows ? (
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

      {!hasAnyRows ? (
        <EmptyState
          title="Rekap Kosong"
          description="Belum ada praktikan yang melakukan presensi."
          style={styles.emptyState}
        />
      ) : filteredBaris.length === 0 && filteredIzin.length === 0 ? (
        <EmptyState
          title="Peserta tidak ditemukan"
          description="Coba kata kunci nama atau NIM lain."
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.list}>
          <FlatList
            data={filteredBaris}
            keyExtractor={(item) => item.presensi.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const isLate = item.presensi.lateStatus === 'late';
              const badgeLabel = isLate
                ? `Terlambat +${item.presensi.lateMinutes ?? 1}m`
                : item.presensi.lateStatus === 'on_time'
                  ? 'Tepat Waktu'
                  : 'Hadir';
              return (
                <AttendanceRow
                  nama={item.praktikan.nama}
                  nim={item.praktikan.nim}
                  waktu={formatWaktuPresensi(item.presensi.waktuPresensi)}
                  catatan={item.presensi.catatan}
                  badgeLabel={badgeLabel}
                  badgeTone={isLate ? 'warning' : 'success'}
                />
              );
            }}
          />

          {filteredIzin.length > 0 ? (
            <View style={styles.izinSection}>
              <SectionHeader
                title="Izin Disetujui (Excused)"
                rightText={`${filteredIzin.length} izin`}
              />
              {filteredIzin.map((item) => (
                <AttendanceRow
                  key={`izin-${item.uid}`}
                  nama={item.nama}
                  nim={item.nim}
                  waktu="Tidak hadir dengan izin"
                  catatan={item.reason}
                  badgeLabel="Izin"
                  badgeTone="info"
                />
              ))}
            </View>
          ) : null}
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
  izinSection: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  emptyState: {
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
  },
});
