import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { PresensiSuccess } from '@/features/sesi/praktikan/PresensiSuccess';
import { useGeofence } from '@/hooks/useGeofence';
import { useApp } from '@/store/app-context';
import { isPraktikanInClass, selectDetailSesi } from '@/store/selectors';
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

  const isPraktikan = user?.peran === 'praktikan';
  const isEligibleKelas =
    isPraktikan && detail ? isPraktikanInClass(user, detail.sesi.kelasId) : false;
  const shouldTrackLocation = Boolean(
    detail &&
      isPraktikan &&
      isEligibleKelas &&
      detail.sesi.status === 'dibuka' &&
      !detail.presensiSaya,
  );

  const geofence = useGeofence(detail?.sesi ?? null, shouldTrackLocation);

  if (!detail) {
    return (
      <ScreenContainer>
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

  if (!isPraktikan) {
    return (
      <ScreenContainer>
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
    sesi.status === 'dibuka' &&
    !presensiSaya &&
    geofence.verification?.status === 'DALAM_RADIUS' &&
    geofence.reading !== null &&
    !loading;

  const handleOpenConfirm = () => {
    setLocalError(null);
    clearError();
    if (!canSubmit) return;
    setConfirmVisible(true);
  };

  const handleConfirmPresensi = async () => {
    setConfirmVisible(false);
    if (!geofence.reading || !geofence.verification) {
      setLocalError('Koordinat GPS belum siap. Segarkan lokasi terlebih dahulu.');
      return;
    }
    if (!geofence.verification.isWithinRadius) {
      setLocalError(geofence.verification.message);
      return;
    }

    try {
      await catatPresensi(sesi.id, catatan, {
        latitude: geofence.reading.latitude,
        longitude: geofence.reading.longitude,
        accuracy: geofence.reading.accuracy ?? 0,
        distanceMeters: geofence.verification.distanceMeters,
        geofenceStatus: 'in_radius',
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Gagal mengirim presensi.',
      );
    }
  };

  const activeError = localError ?? error;

  return (
    <ScreenContainer>
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
            tone="success"
            message="Anda Sudah Hadir pada sesi ini."
            description={
              typeof presensiSaya.distanceMeters === 'number'
                ? `Tercatat pada jarak ${Math.round(presensiSaya.distanceMeters)} meter dari ${geofence.labTarget.labNama}.`
                : undefined
            }
          />
          <PresensiSuccess
            waktuPresensi={presensiSaya.waktuPresensi}
            catatan={presensiSaya.catatan}
          />
        </View>
      ) : null}

      {isEligibleKelas && !presensiSaya && sesi.status === 'dijadwalkan' ? (
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

      {isEligibleKelas && !presensiSaya && sesi.status === 'ditutup' ? (
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

      {isEligibleKelas && !presensiSaya && sesi.status === 'dibuka' ? (
        <View style={styles.sectionGap}>
          <LocationStatusCard
            labTarget={geofence.labTarget}
            verification={geofence.verification}
            permissionState={geofence.permissionState}
            gpsEnabled={geofence.gpsEnabled}
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
            <SectionHeader title="Konfirmasi Kehadiran" />
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
              Tombol presensi hanya aktif saat sesi berstatus Dibuka dan jarak perangkat berada di dalam radius {Math.round(geofence.labTarget.radiusMeters)} meter.
            </Text>
            <AppButton
              label="Kirim Presensi Kehadiran"
              onPress={handleOpenConfirm}
              disabled={!canSubmit}
              loading={loading}
            />
          </AppCard>
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
  sectionGap: {
    gap: Spacing.md,
  },
  formCard: {
    gap: Spacing.md,
  },
  helperText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
