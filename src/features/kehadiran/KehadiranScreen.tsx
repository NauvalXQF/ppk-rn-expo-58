import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectRiwayatPraktikan } from '@/store/selectors';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { formatTanggal, formatWaktuPresensi } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';

export function KehadiranScreen() {
  const router = useRouter();
  const { state } = useApp();
  const user = state.currentUser;

  if (!user || user.peran !== 'praktikan') {
    return null;
  }

  const riwayat = selectRiwayatPraktikan(state, user.id);

  const getStatusInfo = (item: (typeof riwayat)[number]) => {
    switch (item.status) {
      case 'hadir':
        return {
          label: `Hadir · ${item.presensi ? formatWaktuPresensi(item.presensi.waktuPresensi) : ''}`,
          color: Colors.success,
        };
      case 'belum-presensi':
        return {
          label: 'Belum presensi',
          color: Colors.warning,
        };
      case 'belum-berlangsung':
        return {
          label: 'Belum berlangsung',
          color: Colors.textMuted,
        };
      case 'tidak-hadir':
        return {
          label: 'Tidak hadir',
          color: Colors.danger,
        };
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Kehadiran Saya</Text>
        <Text style={styles.subtitle}>
          Riwayat kehadiran sesi praktikum Anda
        </Text>
      </View>

      {riwayat.length === 0 ? (
        <EmptyState
          title="Belum Ada Catatan Kehadiran"
          description="Kamu belum memiliki catatan kehadiran."
        />
      ) : (
        <View style={styles.list}>
          {riwayat.map((item) => {
            const kelas = state.kelas.find((k) => k.id === item.sesi.kelasId);
            const statusInfo = getStatusInfo(item);
            const formattedDate = formatTanggal(item.sesi.tanggal);

            return (
              <AppCard
                key={item.sesi.id}
                onPress={() => router.push(`/sesi/${item.sesi.id}`)}
                style={styles.card}
              >
                <Text style={styles.topikText}>{item.sesi.topik}</Text>
                <Text style={styles.metaText}>
                  {formattedDate} · {kelas?.nama ?? item.sesi.kelasId}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </AppCard>
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
  list: {
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.xs,
  },
  topikText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  metaText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  statusRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralSoft,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
