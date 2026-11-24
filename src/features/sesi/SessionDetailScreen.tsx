import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/store/app-context';
import { isPraktikanInClass, selectDetailSesi } from '@/store/selectors';
import {
  Colors,
  FontFamily,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { evaluateSessionScheduleWindow, formatJam, formatTanggal } from '@/utils/date';
import { LABEL_STATUS } from '@/types/models';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PraktikanSessionView } from './praktikan/PraktikanSessionView';
import { AsistenSessionView } from './asisten/AsistenSessionView';

interface SessionDetailScreenProps {
  sesiId: string;
}

function DetailInfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <View style={styles.detailLeft}>
        <AppIcon name={icon} size={17} color={Colors.text} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function SessionDetailScreen({ sesiId }: SessionDetailScreenProps) {
  const router = useRouter();
  const { state } = useApp();
  const user = state.currentUser;

  const detail = selectDetailSesi(state, sesiId);

  if (!detail) {
    return (
      <ScreenContainer hasTabBar={false}>
        <EmptyState
          title="Sesi tidak ditemukan"
          description="Sesi yang Anda cari mungkin telah dihapus atau tidak tersedia."
          actionLabel="Kembali ke Jadwal"
          onAction={() => router.replace('/jadwal')}
        />
      </ScreenContainer>
    );
  }

  const { sesi, kelas, asisten, presensiSaya } = detail;
  const formattedTanggal = formatTanggal(sesi.tanggal);
  const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;
  const isAsisten = user?.peran === 'asisten';
  const scheduleCheck = evaluateSessionScheduleWindow(sesi);
  const showFloatingCta =
    user?.peran === 'praktikan' &&
    isPraktikanInClass(user, sesi.kelasId) &&
    sesi.status === 'dibuka' &&
    scheduleCheck.isWithinSchedule &&
    !presensiSaya;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          showFloatingCta && { paddingBottom: 108 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={Gradients.detailTop}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Dekorasi lembut kanan atas */}
          <View pointerEvents="none" style={styles.decoWrap}>
            <View style={[styles.decoBar, { transform: [{ rotate: '0deg' }] }]} />
            <View style={[styles.decoBar, { transform: [{ rotate: '60deg' }] }]} />
            <View style={[styles.decoBar, { transform: [{ rotate: '120deg' }] }]} />
          </View>

          <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerInner}>
            <View style={styles.topActions}>
              <IconButton
                accessibilityLabel="Kembali"
                onPress={() => router.back()}
              >
                <AppIcon name="chevron-left" size={20} color={Colors.text} />
              </IconButton>

              {!isAsisten ? (
                <IconButton
                  accessibilityLabel="Lihat peta lab"
                  onPress={() => router.push('/(tabs)/peta' as Href)}
                >
                  <AppIcon name="map-pin" size={18} color={Colors.text} />
                </IconButton>
              ) : null}
            </View>

            <View style={styles.metaChips}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {LABEL_STATUS[sesi.status] ?? sesi.status}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {isAsisten
                    ? `${detail.rekap.jumlahHadir}/${detail.rekap.totalPraktikan} hadir`
                    : `${kelas.nama} · ${sesi.ruang}`}
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>{sesi.topik}</Text>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.sheet}>
          <View style={styles.infoBlock}>
            <DetailInfoRow
              icon="calendar"
              label="Tanggal"
              value={formattedTanggal}
            />
            <DetailInfoRow
              icon="clock"
              label="Waktu & Ruang"
              value={`${formattedWaktu} · ${sesi.ruang}`}
            />
            <DetailInfoRow
              icon="user"
              label="Asisten"
              value={asisten.nama}
              last
            />
          </View>

          {user?.peran === 'praktikan' ? (
            <PraktikanSessionView detail={detail} praktikan={user} />
          ) : isAsisten ? (
            <AsistenSessionView detail={detail} />
          ) : null}
        </View>
      </ScrollView>

      {showFloatingCta ? (
        <SafeAreaView edges={['bottom']} style={styles.floatingCtaWrap}>
          <AppButton
            label="Presensi Sekarang"
            onPress={() => router.push(`/presensi/${sesi.id}` as Href)}
            style={Shadow.floating}
          />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  headerGradient: {
    paddingBottom: 44,
    overflow: 'hidden',
  },
  decoWrap: {
    position: 'absolute',
    right: -24,
    top: 48,
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  decoBar: {
    position: 'absolute',
    width: 36,
    height: 120,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  headerInner: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  chip: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  heroTitle: {
    fontSize: FontSize.display,
    lineHeight: 38,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  infoBlock: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    gap: Spacing.md,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  floatingCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.md + 4,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.surface,
  },
});
