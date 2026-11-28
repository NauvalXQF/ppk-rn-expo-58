import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppIcon } from '@/components/ui/AppIcon';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { PresensiSuccess } from '@/features/sesi/praktikan/PresensiSuccess';
import { useGeofence } from '@/hooks/useGeofence';
import {
  evaluateAttendanceLateness,
  formatRupiah,
} from '@/services/fines/fineCalculationService';
import { useApp } from '@/store/app-context';
import { isPraktikanInClass, selectDetailSesi } from '@/store/selectors';
import { evaluateSessionScheduleWindow, formatWaktuPresensi } from '@/utils/date';
import { LocationStatusCard } from './LocationStatusCard';
import { SessionSummaryCard } from './SessionSummaryCard';

interface GeoAttendanceScreenProps {
  sesiId: string;
}

export function GeoAttendanceScreen({ sesiId }: GeoAttendanceScreenProps) {
  const router = useRouter();
  const { state, catatPresensi, loading, error, clearError } = useApp();
  const user = state.currentUser;
  const detail = selectDetailSesi(state, sesiId);

  const [catatan, setCatatan] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isPraktikan = user?.peran === 'praktikan';
  const isEligibleKelas =
    isPraktikan && detail ? isPraktikanInClass(user, detail.sesi.kelasId) : false;
  const hasApprovedLeave = Boolean(
    isPraktikan &&
      user &&
      detail &&
      !detail.presensiSaya &&
      state.approvedLeaves?.some(
        (leave) => leave.sessionId === detail.sesi.id && leave.uid === user.id,
      ),
  );
  const scheduleCheck = detail
    ? evaluateSessionScheduleWindow(detail.sesi)
    : { isWithinSchedule: true, status: 'INVALID' as const };
  const shouldTrackLocation = Boolean(
    detail &&
      isPraktikan &&
      isEligibleKelas &&
      !hasApprovedLeave &&
      detail.sesi.status === 'dibuka' &&
      scheduleCheck.isWithinSchedule &&
      !detail.presensiSaya,
  );

  useEffect(() => {
    if (!shouldTrackLocation) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => clearInterval(timer);
  }, [shouldTrackLocation]);

  const geofence = useGeofence(detail?.sesi ?? null, shouldTrackLocation);

  if (!detail) {
    return (
      <ScreenContainer hasTabBar={false}>
        <EmptyState
          title="Sesi tidak ditemukan"
          description="Sesi praktikum yang Anda cari tidak tersedia atau telah dihapus."
          actionLabel="Kembali ke Jadwal"
          onAction={() => router.replace('/jadwal')}
        />
      </ScreenContainer>
    );
  }

  const { sesi, kelas, presensiSaya } = detail;

  const headerNav = (
    <View style={styles.navRow}>
      <IconButton
        accessibilityLabel="Kembali"
        onPress={() => router.back()}
      >
        <AppIcon name="chevron-left" size={20} color={Colors.text} />
      </IconButton>
      <Text style={styles.navTitle}>Presensi GPS</Text>
      <IconButton
        accessibilityLabel="Lihat peta lab"
        onPress={() => router.push('/(tabs)/peta' as Href)}
      >
        <AppIcon name="map-pin" size={18} color={Colors.text} />
      </IconButton>
    </View>
  );

  if (!isPraktikan) {
    return (
      <ScreenContainer hasTabBar={false}>
        {headerNav}
        <SessionSummaryCard detail={detail} labNama={geofence.labTarget.labNama} />
        <InfoBanner
          tone="info"
          message="Halaman presensi geofence ini khusus untuk praktikan."
          description="Gunakan halaman Detail Sesi untuk mengelola buka/tutup sesi dan memantau rekap kehadiran."
        />
        <AppButton
          label="Kembali ke Detail Sesi"
          variant="secondary"
          onPress={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const canSubmit =
    isEligibleKelas &&
    !hasApprovedLeave &&
    sesi.status === 'dibuka' &&
    scheduleCheck.isWithinSchedule &&
    !presensiSaya &&
    !geofence.isMockedDetected &&
    !geofence.reading?.isMocked &&
    geofence.verification?.status === 'DALAM_RADIUS' &&
    geofence.reading !== null &&
    !loading;

  const liveLateness =
    sesi.status === 'dibuka'
      ? evaluateAttendanceLateness({ session: sesi, recordedAt: nowMs })
      : null;

  const handleOpenConfirm = () => {
    setLocalError(null);
    clearError();
    if (!canSubmit) return;
    setConfirmVisible(true);
  };

  const handleConfirmPresensi = async () => {
    setConfirmVisible(false);
    if (geofence.isMockedDetected || geofence.reading?.isMocked) {
      setLocalError(
        'Lokasi palsu (Fake GPS / Mock Location) terdeteksi. Matikan aplikasi lokasi palsu untuk melakukan presensi.',
      );
      return;
    }
    if (!geofence.reading || !geofence.verification) {
      setLocalError('Koordinat GPS belum siap. Segarkan lokasi terlebih dahulu.');
      return;
    }
    if (!geofence.verification.isWithinRadius) {
      setLocalError(geofence.verification.message);
      return;
    }

    try {
      await catatPresensi(
        sesi.id,
        catatan,
        {
          latitude: geofence.reading.latitude,
          longitude: geofence.reading.longitude,
          accuracy: geofence.reading.accuracy ?? 0,
          distanceMeters: geofence.verification.distanceMeters,
          geofenceStatus: 'in_radius',
          isMocked: Boolean(geofence.reading.isMocked),
        },
        geofence.labTarget,
      );
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Gagal mengirim presensi.',
      );
    }
  };

  const activeError = localError ?? error;

  return (
    <ScreenContainer hasTabBar={false}>
      {headerNav}

      <SessionSummaryCard detail={detail} labNama={geofence.labTarget.labNama} />

      {activeError ? <InfoBanner tone="danger" message={activeError} /> : null}

      {!isEligibleKelas ? (
        <InfoBanner
          tone="warning"
          message="Anda tidak terdaftar pada kelas sesi praktikum ini."
        />
      ) : null}

      {isEligibleKelas && presensiSaya ? (
        <View style={styles.sectionGap}>
          <InfoBanner
            tone={presensiSaya.lateStatus === 'late' ? 'warning' : 'success'}
            message={
              presensiSaya.lateStatus === 'late'
                ? `Anda Tercatat Hadir (Terlambat +${presensiSaya.lateMinutes ?? 1} menit).`
                : 'Anda Sudah Hadir pada sesi ini.'
            }
            description={
              typeof presensiSaya.distanceMeters === 'number'
                ? `Tercatat pada jarak ${Math.round(presensiSaya.distanceMeters)} meter dari ${geofence.labTarget.labNama}.`
                : undefined
            }
          />
          <PresensiSuccess
            waktuPresensi={presensiSaya.waktuPresensi}
            catatan={presensiSaya.catatan}
            lateStatus={presensiSaya.lateStatus}
            lateMinutes={presensiSaya.lateMinutes}
            fineAmount={sesi.lateFineAmount}
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && hasApprovedLeave ? (
        <View style={styles.sectionGap}>
          <InfoBanner
            tone="info"
            message="Tidak Hadir dengan Izin (Excused Absence)"
            description="Pengajuan izin Anda pada sesi ini telah disetujui sehingga Anda tidak perlu melakukan presensi dan bebas dari denda."
          />
          <AppButton
            label="Izin Disetujui (Bebas Denda)"
            onPress={() => {}}
            disabled
            variant="secondary"
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && !hasApprovedLeave && sesi.status === 'dijadwalkan' ? (
        <View style={styles.sectionGap}>
          <InfoBanner
            tone="neutral"
            message="Sesi praktikum belum dibuka oleh asisten."
            description="Tombol presensi akan otomatis aktif setelah asisten membuka sesi dan lokasi Anda berada di dalam radius lab."
          />
          <AppButton
            label="Kirim Presensi Kehadiran"
            onPress={() => {}}
            disabled
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && !hasApprovedLeave && sesi.status === 'ditutup' ? (
        <View style={styles.sectionGap}>
          <InfoBanner
            tone="warning"
            message="Sesi telah ditutup dan kamu tidak tercatat hadir."
          />
          <AppButton
            label="Kirim Presensi Kehadiran"
            onPress={() => {}}
            disabled
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && !hasApprovedLeave && sesi.status === 'dibuka' && !scheduleCheck.isWithinSchedule ? (
        <View style={styles.sectionGap}>
          <InfoBanner
            tone="warning"
            message={scheduleCheck.message ?? 'Di luar jadwal sesi praktikum.'}
            description="Presensi hanya dapat dilakukan pada rentang tanggal dan jam sesi yang telah dijadwalkan."
          />
          <AppButton
            label="Kirim Presensi Kehadiran"
            onPress={() => {}}
            disabled
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && !hasApprovedLeave && sesi.status === 'dibuka' && scheduleCheck.isWithinSchedule ? (
        <View style={styles.sectionGap}>
          {liveLateness ? (
            <InfoBanner
              tone={liveLateness.lateStatus === 'late' ? 'warning' : 'info'}
              message={
                liveLateness.lateStatus === 'late'
                  ? `Melewati Batas Toleransi (+${liveLateness.lateMinutes} menit)`
                  : 'Dalam Masa Toleransi (Tepat Waktu)'
              }
              description={
                liveLateness.lateStatus === 'late'
                  ? `Presensi tetap dicatat sebagai Hadir (Terlambat) dan menerbitkan 1 tagihan denda sebesar ${formatRupiah(liveLateness.fineAmount)}.`
                  : `Batas tepat waktu hingga pukul ${formatWaktuPresensi(liveLateness.graceDeadlineAt)} WIB (toleransi ${liveLateness.gracePeriodMinutes} menit).`
              }
            />
          ) : null}
          <LocationStatusCard
            labTarget={geofence.labTarget}
            verification={geofence.verification}
            permissionState={geofence.permissionState}
            gpsEnabled={geofence.gpsEnabled}
            isMockedDetected={geofence.isMockedDetected}
            loading={geofence.loading}
            refreshing={geofence.refreshing}
            errorMessage={geofence.errorMessage}
            onRefresh={() => {
              geofence.refreshLocation().catch(() => {});
            }}
            onOpenSettings={() => {
              geofence.openSettings().catch(() => {});
            }}
          />

          <AppCard style={styles.formCard}>
            <FormField
              label="Catatan Presensi (opsional)"
              placeholder={`Mis. Hadir di ${geofence.labTarget.labNama}`}
              value={catatan}
              onChangeText={setCatatan}
              maxLength={120}
              counter={`${catatan.length}/120`}
              multiline
              editable={!loading}
            />
            <Text style={styles.helperText}>
              Tombol kirim aktif saat sesi berstatus Dibuka dan perangkat berada
              di dalam radius {Math.round(geofence.labTarget.radiusMeters)} meter.
            </Text>
          </AppCard>

          <AppButton
            label={
              geofence.verification &&
              geofence.verification.status !== 'DALAM_RADIUS'
                ? `Di Luar Radius Lab (${Math.round(geofence.verification.distanceMeters)} m)`
                : 'Kirim Presensi Kehadiran'
            }
            onPress={handleOpenConfirm}
            disabled={!canSubmit}
            loading={loading}
            style={Shadow.floating}
          />
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirmVisible}
        title="Kirim Presensi Kehadiran?"
        description={`${sesi.topik} · ${kelas.nama}\nJarak terverifikasi: ${geofence.verification ? Math.round(geofence.verification.distanceMeters) : 0} meter dari ${geofence.labTarget.labNama}.`}
        confirmLabel="Ya, Kirim Presensi"
        cancelLabel="Batal"
        tone="primary"
        onConfirm={() => {
          handleConfirmPresensi().catch(() => {});
        }}
        onClose={() => setConfirmVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  sectionGap: {
    gap: 12,
  },
  formCard: {
    gap: Spacing.sm,
  },
  helperText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 17,
  },
});
