import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectRekapSesi, selectSesiUntukPengguna } from '@/store/selectors';
import type { Sesi } from '@/types/models';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SessionCard } from '@/components/domain/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTanggal, formatJam } from '@/utils/date';

export function RekapScreen() {
  const { state } = useApp();
  const sessions = selectSesiUntukPengguna(state);

  const renderItem = ({ item }: { item: Sesi }) => {
    const praktikum = state.praktikum.find((p) => p.id === item.praktikumId);
    const kelas = state.kelas.find((k) => k.id === item.kelasId);
    const rekap = selectRekapSesi(state, item.id);

    const praktikumName = praktikum ? praktikum.nama : 'Praktikum';
    const kelasName = kelas ? kelas.nama : 'Kelas';
    const tanggalFormatted = formatTanggal(item.tanggal);
    const waktuFormatted = `${formatJam(item.jamMulai)}–${formatJam(item.jamSelesai)}`;
    const metaText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;
    const metaTone = item.status === 'dibuka' ? 'success' : 'default';

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
        onPress={() => {
          router.push(`/sesi/${item.id}`);
        }}
      />
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Rekap Kehadiran</Text>
        <Text style={styles.subtitle}>
          Daftar seluruh sesi praktikum dan kehadiran
        </Text>
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
            title="Belum Ada Sesi"
            description="Belum ada sesi untuk direkap."
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

