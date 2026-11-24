import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/ui/AppIcon';
import { useApp } from '@/store/app-context';
import { getPraktikanClassIds, selectRiwayatPraktikan } from '@/store/selectors';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTanggal, formatWaktuPresensi } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DotHeatmap } from '@/components/domain/DotHeatmap';
import { ProgressBar } from '@/components/domain/ProgressBar';
import { StatTile } from '@/components/domain/StatTile';

export function KehadiranScreen() {
  const router = useRouter();
  const { state } = useApp();
  const user = state.currentUser;

  if (!user || user.peran !== 'praktikan') {
    return null;
  }

  const riwayat = selectRiwayatPraktikan(state, user.id);
  const hadirCount = riwayat.filter((r) => r.status === 'hadir').length;
  const totalSesi = riwayat.length;
  const rate = totalSesi > 0 ? Math.round((hadirCount / totalSesi) * 100) : 0;
  const totalJam = hadirCount * 2;
  const filledDots = Math.min(35, Math.max(hadirCount * 4, rate > 0 ? 12 : 0));

  const kelasIds = getPraktikanClassIds(user);
  const kelasNames = kelasIds
    .map((id) => state.kelas.find((k) => k.id === id)?.nama ?? id)
    .join(', ');

  const activeSession = riwayat.find((r) => r.sesi.status === 'dibuka');
  const highlightSession = activeSession ?? riwayat[0];

  const getStatusInfo = (item: (typeof riwayat)[number]) => {
    switch (item.status) {
      case 'hadir':
        return {
          label: `Hadir · ${item.presensi ? formatWaktuPresensi(item.presensi.waktuPresensi) : ''}`,
          bg: Colors.successSoft,
          color: Colors.success,
        };
      case 'belum-presensi':
        return {
          label: 'Belum presensi',
          bg: Colors.warningSoft,
          color: Colors.warning,
        };
      case 'belum-berlangsung':
        return {
          label: 'Belum berlangsung',
          bg: Colors.neutralSoft,
          color: Colors.textMuted,
        };
      case 'tidak-hadir':
        return {
          label: 'Tidak hadir',
          bg: Colors.dangerSoft,
          color: Colors.danger,
        };
    }
  };

  return (
    <ScreenContainer variant="gradient">
      {/* Header/Profile */}
      <View style={styles.profileHeader}>
        <View style={styles.profileLeft}>
          <View style={styles.avatar}>
            <AppText variant="label" color={Colors.text}>
              {user.nama.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.profileTextCol}>
            <AppText variant="label" color={Colors.text}>
              {user.nama}
            </AppText>
            <AppText variant="caption" color={Colors.textMuted}>
              Praktikan · {kelasNames || 'Belum ada kelas'}
            </AppText>
          </View>
        </View>
        <View style={styles.ratePill}>
          <AppText variant="caption" weight="medium" color={Colors.text}>
            {rate}% Hadir
          </AppText>
        </View>
      </View>

      <AppText variant="title" style={styles.pageTitle}>
        Kehadiran saya
      </AppText>

      {/* Main Glass Stat + DotHeatmap */}
      <AppCard style={styles.heatmapCard}>
        <View style={styles.heatmapHeader}>
          <View style={styles.heatmapLabelRow}>
            <AppIcon name="book-open" size={16} color={Colors.textMuted} />
            <AppText variant="label" color={Colors.textMuted}>
              Total praktikum
            </AppText>
          </View>
          <AppText variant="stat" color={Colors.text}>
            {totalJam}j 00m
          </AppText>
        </View>
        <DotHeatmap filledCount={filledDots} />
      </AppCard>

      {/* Stat Tile */}
      <StatTile
        icon="check-circle"
        label="Sesi selesai"
        value={String(riwayat.filter((r) => r.sesi.status === 'ditutup').length)}
        subInfo={`${hadirCount} dari ${totalSesi} hadir (${rate}%)`}
      />

      {/* Lanjutkan / Presensi sesi aktif */}
      {highlightSession ? (
        <AppCard
          onPress={() => router.push(`/sesi/${highlightSession.sesi.id}`)}
          style={styles.continueCard}
        >
          <View style={styles.continueTop}>
            <View style={styles.continueLabelRow}>
              <AppIcon name="clock" size={16} color={Colors.textMuted} />
              <AppText variant="label" color={Colors.text}>
                {activeSession ? 'Presensi sesi aktif' : 'Sesi terbaru'}
              </AppText>
            </View>
            <IconButton
              tone="dark"
              size={36}
              accessibilityLabel="Buka sesi"
              onPress={() => router.push(`/sesi/${highlightSession.sesi.id}`)}
            >
              <AppIcon name="arrow-up-right" size={17} color={Colors.textOnDark} />
            </IconButton>
          </View>
          <ProgressBar progress={totalSesi > 0 ? hadirCount / totalSesi : 0} />
          <View style={styles.continueFooter}>
            <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
              {highlightSession.sesi.topik} · {highlightSession.sesi.ruang}
            </AppText>
            <AppText variant="caption" color={Colors.textMuted}>
              {hadirCount}/{totalSesi} pertemuan
            </AppText>
          </View>
        </AppCard>
      ) : null}

      <SectionHeader
        title="Riwayat Kehadiran"
        rightText={`${riwayat.length} sesi`}
      />

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
                style={styles.historyCard}
              >
                <View style={styles.historyTop}>
                  <Text style={styles.topikText} numberOfLines={1}>
                    {item.sesi.topik}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusInfo.bg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {formattedDate} · {kelas?.nama ?? item.sesi.kelasId} ·{' '}
                  {item.sesi.ruang}
                </Text>
              </AppCard>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextCol: {
    flex: 1,
    gap: 1,
  },
  ratePill: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pageTitle: {
    marginTop: 2,
  },
  heatmapCard: {
    gap: 14,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heatmapLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  continueCard: {
    gap: 10,
  },
  continueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  list: {
    gap: 10,
  },
  historyCard: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    gap: 4,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  topikText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
});
