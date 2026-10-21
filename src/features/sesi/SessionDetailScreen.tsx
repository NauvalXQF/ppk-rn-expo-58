import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectDetailSesi } from '@/store/selectors';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { formatJam, formatTanggal } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PraktikanSessionView } from './praktikan/PraktikanSessionView';
import { AsistenSessionView } from './asisten/AsistenSessionView';

interface SessionDetailScreenProps {
  sesiId: string;
}

export function SessionDetailScreen({ sesiId }: SessionDetailScreenProps) {
  const router = useRouter();
  const { state } = useApp();
  const user = state.currentUser;

  const detail = selectDetailSesi(state, sesiId);

  if (!detail) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Sesi tidak ditemukan"
          description="Sesi yang Anda cari mungkin telah dihapus atau tidak tersedia."
          actionLabel="Kembali ke Jadwal"
          onAction={() => router.replace('/jadwal')}
        />
      </ScreenContainer>
    );
  }

  const { sesi, praktikum, kelas, asisten } = detail;
  const formattedTanggal = formatTanggal(sesi.tanggal);
  const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;

  return (
    <ScreenContainer>
      {/* Kartu Informasi Utama Sesi */}
      <AppCard style={styles.cardHeader}>
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
            <Text style={styles.detailLabel}>Waktu & Ruang</Text>
            <Text style={styles.detailValue}>
              {formattedWaktu} · {sesi.ruang}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Asisten</Text>
            <Text style={styles.detailValue}>{asisten.nama}</Text>
          </View>
        </View>
      </AppCard>

      {/* Konten Sesuai Peran */}
      {user?.peran === 'praktikan' ? (
        <PraktikanSessionView detail={detail} praktikan={user} />
      ) : user?.peran === 'asisten' ? (
        <AsistenSessionView detail={detail} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
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
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
});
