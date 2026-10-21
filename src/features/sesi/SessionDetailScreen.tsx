import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectDetailSesi } from '@/store/selectors';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppButton } from '@/components/ui/AppButton';
import { AsistenSessionView } from '@/features/sesi/asisten/AsistenSessionView';
import { formatTanggal, formatJam } from '@/utils/date';

interface SessionDetailScreenProps {
  sesiId: string;
}

export function SessionDetailScreen({ sesiId }: SessionDetailScreenProps) {
  const { state } = useApp();
  const detail = selectDetailSesi(state, sesiId);

  if (!detail) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Sesi Tidak Ditemukan"
          description="Sesi yang kamu cari tidak tersedia atau telah dihapus."
          action={
            <AppButton
              label="Kembali"
              variant="secondary"
              onPress={() => router.back()}
            />
          }
        />
      </ScreenContainer>
    );
  }

  const { sesi, praktikum, kelas, asisten } = detail;
  const isAsisten = state.currentUser?.peran === 'asisten';

  return (
    <ScreenContainer scrollable>
      <View style={styles.cardHeader}>
        <Text style={styles.praktikumText}>{praktikum.nama}</Text>
        <Text style={styles.topikText}>{kelas.nama} · {sesi.topik}</Text>
        <Text style={styles.infoText}>{formatTanggal(sesi.tanggal)}</Text>
        <Text style={styles.infoText}>
          {formatJam(sesi.jamMulai)}–{formatJam(sesi.jamSelesai)} · {sesi.ruang}
        </Text>
        <View style={styles.asistenRow}>
          <Text style={styles.asistenText}>Asisten: {asisten.nama}</Text>
          <StatusBadge status={sesi.status} />
        </View>
      </View>

      <View style={styles.roleContent}>
        {isAsisten ? (
          <AsistenSessionView detail={detail} />
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>
              Tampilan praktikan untuk sesi ini.
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.md,
    gap: Spacing.xs,
  },
  praktikumText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  topikText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  asistenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  asistenText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  roleContent: {
    paddingBottom: Spacing.xl,
  },
  placeholderBox: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});

