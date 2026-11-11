import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import {
  selectJadwalUntukPengguna,
  selectRekapSesi,
  selectSesiUntukPengguna,
} from '@/store/selectors';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { formatJam, formatTanggal, formatWaktuPresensi } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SessionCard } from '@/components/domain/SessionCard';
import { PracticumCrudSection } from '@/features/practicum/PracticumCrudSection';

export function JadwalScreen() {
  const router = useRouter();
  const { state, loading, error } = useApp();
  const user = state.currentUser;

  const jadwalList = selectJadwalUntukPengguna(state);
  const sesiList = selectSesiUntukPengguna(state);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Jadwal & Sesi</Text>
        <Text style={styles.subtitle}>Praktikum Pemrograman Komputer</Text>
      </View>

      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Memproses sinkronisasi data...</Text>
        </View>
      ) : null}

      {user?.peran === 'asisten' ? <PracticumCrudSection /> : null}

      {jadwalList.length > 0 ? (
        <View style={styles.scheduleSection}>
          <SectionHeader
            title="Jadwal Reguler Kelas"
            rightText={`${jadwalList.length} jadwal`}
          />
          <View style={styles.scheduleList}>
            {jadwalList.map((j) => {
              const kelas = state.kelas.find((k) => k.id === j.kelasId);
              return (
                <AppCard key={j.id} style={styles.scheduleCard}>
                  <Text style={styles.scheduleTitle}>
                    {kelas?.nama ?? j.kelasId} · {j.topik}
                  </Text>
                  <Text style={styles.scheduleMeta}>
                    {j.hari}, {formatJam(j.jamMulai)}–{formatJam(j.jamSelesai)}{' '}
                    · {j.ruang}
                  </Text>
                </AppCard>
              );
            })}
          </View>
        </View>
      ) : null}

      <SectionHeader
        title="Daftar Sesi Praktikum"
        rightText={`${sesiList.length} sesi`}
      />

      {sesiList.length === 0 ? (
        <EmptyState
          title="Belum ada jadwal"
          description={
            user?.peran === 'praktikan'
              ? 'Tidak ada jadwal praktikum yang tersedia untuk kelas Anda saat ini.'
              : 'Belum ada sesi praktikum yang terdaftar.'
          }
        />
      ) : (
        <View style={styles.list}>
          {sesiList.map((sesi) => {
            const praktikum = state.praktikum.find(
              (p) => p.id === sesi.praktikumId,
            );
            const kelas = state.kelas.find((k) => k.id === sesi.kelasId);

            let metaText = '';
            let metaTone: 'default' | 'success' | 'warning' | 'danger' =
              'default';

            if (user?.peran === 'asisten') {
              const rekap = selectRekapSesi(state, sesi.id);
              metaText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;
              metaTone = 'default';
            } else if (user?.peran === 'praktikan') {
              const presensi = state.presensi.find(
                (p) => p.sesiId === sesi.id && p.praktikanId === user.id,
              );

              if (presensi) {
                metaText = `Hadir · ${formatWaktuPresensi(presensi.waktuPresensi)}`;
                metaTone = 'success';
              } else if (sesi.status === 'dibuka') {
                metaText = 'Belum presensi';
                metaTone = 'warning';
              } else if (sesi.status === 'dijadwalkan') {
                metaText = 'Belum berlangsung';
                metaTone = 'default';
              } else {
                metaText = 'Tidak hadir';
                metaTone = 'danger';
              }
            }

            const formattedTanggal = formatTanggal(sesi.tanggal);
            const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;

            return (
              <SessionCard
                key={sesi.id}
                praktikum={praktikum?.nama ?? 'Praktikum'}
                kelas={kelas?.nama ?? sesi.kelasId}
                topik={sesi.topik}
                tanggal={formattedTanggal}
                waktu={formattedWaktu}
                ruang={sesi.ruang}
                status={sesi.status}
                meta={metaText}
                metaTone={metaTone}
                onPress={() => router.push(`/sesi/${sesi.id}`)}
              />
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  scheduleSection: {
    gap: Spacing.xs,
  },
  scheduleList: {
    gap: Spacing.sm,
  },
  scheduleCard: {
    gap: 2,
    paddingVertical: Spacing.sm + 2,
  },
  scheduleTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  scheduleMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  list: {
    gap: Spacing.md,
  },
});
