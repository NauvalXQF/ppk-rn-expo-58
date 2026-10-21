import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectRekapSesi, selectSesiUntukPengguna } from '@/store/selectors';
import type { Sesi } from '@/types/models';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SessionCard } from '@/components/domain/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTanggal, formatJam } from '@/utils/date';

export default function JadwalRoute() {
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  const sessions = selectSesiUntukPengguna(state);
  const isAsisten = state.currentUser.peran === 'asisten';

  const renderItem = ({ item }: { item: Sesi }) => {
    const praktikum = state.praktikum.find((p) => p.id === item.praktikumId);
    const kelas = state.kelas.find((k) => k.id === item.kelasId);
    const rekap = selectRekapSesi(state, item.id);

    const praktikumName = praktikum ? praktikum.nama : 'Praktikum';
    const kelasName = kelas ? kelas.nama : 'Kelas';
    const tanggalFormatted = formatTanggal(item.tanggal);
    const waktuFormatted = `${formatJam(item.jamMulai)}–${formatJam(item.jamSelesai)}`;

    let metaText = '';
    let metaTone: 'default' | 'success' | 'warning' | 'danger' = 'default';

    if (isAsisten) {
      metaText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;
      metaTone = item.status === 'dibuka' ? 'success' : 'default';
    } else {
      const presensi = state.presensi.find(
        (p) => p.sesiId === item.id && p.praktikanId === state.currentUser?.id,
      );
      if (presensi) {
        metaText = 'Hadir';
        metaTone = 'success';
      } else if (item.status === 'dibuka') {
        metaText = 'Belum presensi';
        metaTone = 'warning';
      } else if (item.status === 'dijadwalkan') {
        metaText = 'Belum berlangsung';
        metaTone = 'default';
      } else {
        metaText = 'Tidak hadir';
        metaTone = 'danger';
      }
    }

    return (
      <SessionCard
        praktikum={praktikumName}
        kelas={kelasName}
        topik={item.topik}
        tanggal={tanggalFormatted}
        waktu={waktuFormatted}
        ruang={item.ruang}
        status={item.status}
        meta={metaText}
        metaTone={metaTone}
        onPress={() => router.push(`/sesi/${item.id}`)}
      />
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Jadwal</Text>
        <Text style={styles.subtitle}>Praktikum Pemrograman Komputer</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="Belum Ada Jadwal"
            description="Tidak ada jadwal sesi yang ditemukan untuk akun kamu."
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  separator: {
    height: Spacing.md,
  },
});

