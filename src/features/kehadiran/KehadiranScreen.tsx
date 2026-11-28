import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppIcon } from '@/components/ui/AppIcon';
import { useApp } from '@/store/app-context';
import { getPraktikanClassIds, selectRiwayatPraktikan } from '@/store/selectors';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTanggal, formatWaktuPresensi } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DotHeatmap } from '@/components/domain/DotHeatmap';
import { ProgressBar } from '@/components/domain/ProgressBar';
import { StatTile } from '@/components/domain/StatTile';
import { NotificationBell } from '@/features/notifications/NotificationBell';

export function KehadiranScreen() {
  const router = useRouter();
  const { state } = useApp();
  const user = state.currentUser;

  if (!user || user.peran !== 'praktikan') {
    return null;
  }

  const riwayat = selectRiwayatPraktikan(state, user.id);
  const hadirCount = riwayat.filter((r) => r.status === 'hadir').length;
  const izinCount = riwayat.filter((r) => r.status === 'izin').length;
  const totalSesi = riwayat.length;
  const rate = totalSesi > 0 ? Math.round((hadirCount / totalSesi) * 100) : 0;
  const totalMinutes = riwayat
    .filter((r) => r.status === 'hadir')
    .reduce((sum, r) => {
      const [sh, sm] = r.sesi.jamMulai.split(':').map(Number);
      const [eh, em] = r.sesi.jamSelesai.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      return sum + (Number.isFinite(mins) && mins > 0 ? mins : 120);
    }, 0);
  const totalJam = Math.floor(totalMinutes / 60);
  const sisaMenit = totalMinutes % 60;
  const filledDots = Math.round((rate / 100) * 35);

  const kelasIds = getPraktikanClassIds(user);
  const kelasNames = kelasIds
    .map((id) => state.kelas.find((k) => k.id === id)?.nama ?? id)
    .join(', ');

  const activeSession = riwayat.find((r) => r.status === 'belum-presensi');
  const highlightSession = activeSession ?? riwayat[0];

  const leaveBySessionId = new Map(
    (state.leaveRequests ?? [])
      .filter((l) => l.uid === user.id)
      .map((l) => [l.sessionId, l]),
  );

  const getStatusInfo = (item: (typeof riwayat)[number]) => {
    const leave = leaveBySessionId.get(item.sesi.id);
    switch (item.status) {
      case 'hadir':
        if (item.presensi?.lateStatus === 'late') {
          return {
            label: `Hadir (Terlambat +${item.presensi.lateMinutes ?? 1} mnt)`,
            bg: Colors.warningSoft,
            color: Colors.warning,
          };
        }
        return {
          label: `${
            item.presensi?.lateStatus === 'on_time'
              ? 'Hadir (Tepat Waktu)'
              : 'Hadir'
          } · ${item.presensi ? formatWaktuPresensi(item.presensi.waktuPresensi) : ''}`,
          bg: Colors.successSoft,
          color: Colors.success,
        };
      case 'izin':
        return {
          label: 'Izin (Disetujui)',
          bg: Colors.unreadSurface,
          color: Colors.accentBlue,
        };
      case 'belum-presensi':
        if (leave?.status === 'pending') {
          return {
            label: 'Izin Menunggu',
            bg: Colors.warningSoft,
            color: Colors.warning,
          };
        }
        if (leave?.status === 'rejected') {
          return {
            label: 'Izin Ditolak · Belum presensi',
            bg: Colors.dangerSoft,
            color: Colors.danger,
          };
        }
        return {
          label: 'Belum presensi',
          bg: Colors.warningSoft,
          color: Colors.warning,
        };
      case 'belum-berlangsung':
        if (leave?.status === 'pending') {
          return {
            label: 'Izin Menunggu',
            bg: Colors.warningSoft,
            color: Colors.warning,
          };
        }
        if (leave?.status === 'rejected') {
          return {
            label: 'Izin Ditolak',
            bg: Colors.dangerSoft,
            color: Colors.danger,
          };
        }
        return {
          label: 'Belum berlangsung',
          bg: Colors.neutralSoft,
          color: Colors.textMuted,
        };
      case 'tidak-hadir':
        if (leave?.status === 'pending') {
          return {
            label: 'Izin Menunggu',
            bg: Colors.warningSoft,
            color: Colors.warning,
          };
        }
        if (leave?.status === 'rejected') {
          return {
            label: 'Izin Ditolak',
            bg: Colors.dangerSoft,
            color: Colors.danger,
          };
        }
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
        <View style={styles.headerRight}>
          <View style={styles.ratePill}>
            <AppText variant="caption" weight="medium" color={Colors.text}>
              {rate}% Hadir
            </AppText>
          </View>
          <NotificationBell />
        </View>
      </View>

      <AppText variant="title" style={styles.pageTitle}>
        Kehadiran saya
      </AppText>

      {/* Prioritaskan CTA Presensi Sesi Aktif di atas saat sesi sedang dibuka */}
      {activeSession ? (
        <AppCard
          onPress={() => router.push(`/presensi/${activeSession.sesi.id}` as Href)}
          style={[styles.continueCard, styles.activeBannerCard]}
        >
          <View style={styles.continueTop}>
            <View style={styles.continueLabelRow}>
              <AppIcon name="check-circle" size={16} color={Colors.success} />
              <AppText variant="label" color={Colors.text}>
                Presensi sesi aktif
              </AppText>
            </View>
            <Pressable
              onPress={() =>
                router.push(`/presensi/${activeSession.sesi.id}` as Href)
              }
              style={styles.activeCtaPill}
              accessibilityRole="button"
              accessibilityLabel="Presensi sekarang"
            >
              <Text style={styles.activeCtaText}>Presensi →</Text>
            </Pressable>
          </View>
          <ProgressBar progress={totalSesi > 0 ? hadirCount / totalSesi : 0} />
          <View style={styles.continueFooter}>
            <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
              {activeSession.sesi.topik} · {activeSession.sesi.ruang}
            </AppText>
            <AppText variant="caption" color={Colors.textMuted}>
              {hadirCount}/{totalSesi} pertemuan
            </AppText>
          </View>
        </AppCard>
      ) : null}

      <AppButton
        label="Buka Pengajuan Izin"
        variant="secondary"
        onPress={() => router.push('/(tabs)/izin' as Href)}
      />

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
            {totalJam}j {String(sisaMenit).padStart(2, '0')}m
          </AppText>
        </View>
        <DotHeatmap filledCount={filledDots} />
      </AppCard>

      {/* Stat Tile */}
      <StatTile
        icon="check-circle"
        label="Sesi selesai"
        value={String(riwayat.filter((r) => r.sesi.status === 'ditutup').length)}
        subInfo={`${hadirCount} dari ${totalSesi} hadir (${rate}%)${
          izinCount > 0 ? ` · ${izinCount} izin` : ''
        }`}
      />

      {/* Sesi terbaru (hanya jika tidak ada sesi aktif di atas) */}
      {!activeSession && highlightSession ? (
        <AppCard
          onPress={() => router.push(`/sesi/${highlightSession.sesi.id}`)}
          style={styles.continueCard}
        >
          <View style={styles.continueTop}>
            <View style={styles.continueLabelRow}>
              <AppIcon name="clock" size={16} color={Colors.textMuted} />
              <AppText variant="label" color={Colors.text}>
                Sesi terbaru
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
        <FlatList
          data={riwayat}
          keyExtractor={(item) => item.sesi.id}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const kelas = state.kelas.find((k) => k.id === item.sesi.kelasId);
            const statusInfo = getStatusInfo(item);
            const formattedDate = formatTanggal(item.sesi.tanggal);

            return (
              <AppCard
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
          }}
        />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratePill: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeBannerCard: {
    borderColor: Colors.success,
    borderWidth: 1.5,
  },
  activeCtaPill: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  activeCtaText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textOnDark,
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  topikText: {
    flex: 1,
    minWidth: 140,
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
    flexShrink: 0,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
});
