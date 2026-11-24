import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/store/app-context';
import { selectRekapSesi, selectSesiUntukPengguna } from '@/store/selectors';
import { LABEL_STATUS } from '@/types/models';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTanggal, formatJam } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProgressBar } from '@/components/domain/ProgressBar';
import { StatTile } from '@/components/domain/StatTile';
import { NotificationBell } from '@/features/notifications/NotificationBell';

export function RekapScreen() {
  const { state } = useApp();
  const user = state.currentUser;
  const sessions = selectSesiUntukPengguna(state);

  const openCount = sessions.filter((s) => s.status === 'dibuka').length;
  const totalRateSum = sessions.reduce((acc, s) => {
    const r = selectRekapSesi(state, s.id);
    if (r.totalPraktikan === 0) return acc;
    return acc + (r.jumlahHadir / r.totalPraktikan) * 100;
  }, 0);
  const avgRate =
    sessions.length > 0 ? Math.round(totalRateSum / sessions.length) : 0;

  return (
    <ScreenContainer variant="gradient">
      {/* Header/Profile Asisten */}
      {user ? (
        <View style={styles.profileHeader}>
          <View style={styles.profileLeft}>
            <View style={styles.avatar}>
              <AppText variant="label" color={Colors.textOnDark}>
                {user.nama.charAt(0).toUpperCase()}
              </AppText>
            </View>
            <View style={styles.profileTextCol}>
              <AppText variant="label" color={Colors.text}>
                {user.nama}
              </AppText>
              <AppText variant="caption" color={Colors.textMuted}>
                Asisten Praktikum{user.peran === 'asisten' ? ` · NIP ${user.nip}` : ''}
              </AppText>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.rolePill}>
              <AppText variant="caption" weight="medium" color={Colors.text}>
                Asisten
              </AppText>
            </View>
            <NotificationBell />
          </View>
        </View>
      ) : null}

      <AppText variant="title">Rekap kehadiran</AppText>

      <View style={styles.tilesRow}>
        <StatTile
          icon="users"
          label="Rata-rata hadir"
          value={`${avgRate}%`}
          subInfo={`${sessions.length} sesi terdaftar`}
        />
        <StatTile
          icon="bar-chart-2"
          label="Sesi dibuka"
          value={String(openCount)}
          subInfo={openCount > 0 ? 'Sedang aktif' : 'Tidak ada'}
        />
      </View>

      <SectionHeader
        title="Daftar Sesi & Kehadiran"
        rightText={`${sessions.length} sesi`}
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="Belum Ada Sesi"
          description="Belum ada sesi untuk direkap."
        />
      ) : (
        <View style={styles.list}>
          {sessions.map((item) => {
            const kelas = state.kelas.find((k) => k.id === item.kelasId);
            const rekap = selectRekapSesi(state, item.id);
            const ratio =
              rekap.totalPraktikan > 0
                ? rekap.jumlahHadir / rekap.totalPraktikan
                : 0;

            const badgeBg =
              item.status === 'dibuka'
                ? Colors.successSoft
                : item.status === 'dijadwalkan'
                  ? Colors.warningSoft
                  : Colors.neutralSoft;
            const badgeColor =
              item.status === 'dibuka'
                ? Colors.success
                : item.status === 'dijadwalkan'
                  ? Colors.warning
                  : Colors.textMuted;

            return (
              <AppCard
                key={item.id}
                onPress={() => router.push(`/sesi/${item.id}`)}
                style={styles.sessionCard}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardMeta}>
                    {kelas?.nama ?? item.kelasId} · {item.ruang}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                      {LABEL_STATUS[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>{item.topik}</Text>

                <ProgressBar
                  progress={ratio}
                  fillColor={
                    item.status === 'dibuka'
                      ? Colors.accentPink
                      : Colors.accentBlue
                  }
                />

                <View style={styles.cardBottom}>
                  <Text style={styles.cardTime}>
                    {formatTanggal(item.tanggal)} · {formatJam(item.jamMulai)}–
                    {formatJam(item.jamSelesai)} WIB
                  </Text>
                  <Text style={styles.cardCount}>
                    {rekap.jumlahHadir}/{rekap.totalPraktikan} hadir
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextCol: {
    flex: 1,
    gap: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rolePill: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  list: {
    gap: 12,
  },
  sessionCard: {
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  cardCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
});
