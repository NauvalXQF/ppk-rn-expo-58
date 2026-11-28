import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProgressBar } from '@/components/domain/ProgressBar';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { classifyGpsAccuracy } from '@/services/location/geofenceService';
import type {
  LabGeofenceTarget,
  LocationPermissionState,
  VerificationResult,
} from '@/types/geoAttendance';

interface LocationStatusCardProps {
  labTarget: LabGeofenceTarget;
  verification: VerificationResult | null;
  permissionState: LocationPermissionState;
  gpsEnabled: boolean;
  isMockedDetected?: boolean;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function LocationStatusCard({
  labTarget,
  verification,
  permissionState,
  gpsEnabled,
  isMockedDetected = false,
  loading,
  refreshing,
  errorMessage,
  onRefresh,
  onOpenSettings,
}: LocationStatusCardProps) {
  if (isMockedDetected) {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Geofence" />
        <InfoBanner
          tone="danger"
          message="Lokasi palsu (Fake GPS) terdeteksi."
          description={
            errorMessage ??
            'Matikan aplikasi Fake GPS / Mock Location pada pengaturan pengembang perangkat Anda lalu segarkan lokasi.'
          }
        />
        <AppButton
          label="Segarkan Lokasi"
          onPress={onRefresh}
          loading={refreshing}
          variant="secondary"
        />
      </AppCard>
    );
  }
  if (permissionState === 'denied') {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Geofence" />
        <InfoBanner
          tone="danger"
          message="Izin lokasi ditolak. Aplikasi membutuhkan akses lokasi untuk memvalidasi presensi di lab."
          description={
            Platform.OS === 'web'
              ? 'Klik ikon pengaturan di address bar browser lalu izinkan akses Location dan tekan Coba Lagi.'
              : 'Berikan izin lokasi melalui pengaturan aplikasi lalu segarkan kembali.'
          }
        />
        <View style={styles.actionRow}>
          {Platform.OS !== 'web' ? (
            <AppButton
              label="Buka Pengaturan"
              onPress={onOpenSettings}
              style={styles.flexButton}
            />
          ) : null}
          <AppButton
            label="Coba Lagi"
            variant="secondary"
            onPress={onRefresh}
            loading={refreshing}
            style={styles.flexButton}
          />
        </View>
      </AppCard>
    );
  }

  if (!gpsEnabled) {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Geofence" />
        <InfoBanner
          tone="warning"
          message="Layanan lokasi (GPS) perangkat Anda nonaktif."
          description="Nyalakan GPS di pengaturan cepat perangkat Anda untuk melanjutkan presensi."
        />
        <View style={styles.actionRow}>
          {Platform.OS !== 'web' ? (
            <AppButton
              label="Buka Pengaturan"
              onPress={onOpenSettings}
              variant="secondary"
            />
          ) : null}
          <AppButton
            label="Segarkan Lokasi"
            onPress={onRefresh}
            loading={refreshing}
            style={styles.flexButton}
          />
        </View>
      </AppCard>
    );
  }

  if (loading && !verification) {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Geofence" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>
            Mengambil koordinat GPS terkini ke {labTarget.labNama}...
          </Text>
        </View>
      </AppCard>
    );
  }

  if (!verification) {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Geofence" />
        <InfoBanner
          tone="warning"
          message={errorMessage ?? 'Koordinat lokasi belum tersedia.'}
          description="Pastikan layanan lokasi aktif lalu tekan tombol Segarkan Lokasi."
        />
        <AppButton
          label="Segarkan Lokasi"
          onPress={onRefresh}
          loading={refreshing}
          variant="secondary"
        />
      </AppCard>
    );
  }

  const isInside = verification.status === 'DALAM_RADIUS';
  const accuracyInfo = classifyGpsAccuracy(verification.accuracyMeters);
  const accuracyValueText =
    verification.accuracyMeters !== null
      ? `±${Math.round(verification.accuracyMeters)} m (${accuracyInfo.label})`
      : 'Tidak diketahui';
  const distRounded = Math.round(verification.distanceMeters);
  const maxRounded = Math.round(verification.radiusMeters);
  const proximityRatio =
    maxRounded > 0 ? Math.max(0.1, 1 - Math.min(1, distRounded / maxRounded)) : 0;

  return (
    <AppCard style={styles.card}>
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <AppIcon name="map-pin" size={16} color={Colors.text} />
          <Text style={styles.titleText}>Verifikasi Geofence</Text>
        </View>
        <View
          style={[
            styles.radiusBadge,
            {
              backgroundColor: isInside
                ? Colors.successSoft
                : Colors.dangerSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.radiusBadgeText,
              { color: isInside ? Colors.success : Colors.danger },
            ]}
          >
            {isInside ? 'Dalam Radius' : 'Di Luar Radius'}
          </Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Text
          style={[
            styles.statNumber,
            !isInside && { color: Colors.danger },
          ]}
        >
          {distRounded} m
        </Text>
        <Text style={styles.statSub}>
          {isInside
            ? `dari pusat ${labTarget.labNama} (maks. ${maxRounded} m)`
            : `dari ${labTarget.labNama} (butuh ≤ ${maxRounded} m)`}
        </Text>
      </View>

      <ProgressBar
        progress={isInside ? Math.max(0.25, proximityRatio) : 1}
        fillColor={isInside ? Colors.accentBlue : Colors.danger}
      />

      <Text
        style={[
          styles.accuracyText,
          !isInside && { color: Colors.danger },
        ]}
      >
        {isInside
          ? `Akurasi GPS ${accuracyValueText} · Lokasi terverifikasi aman`
          : `${Math.max(1, distRounded - maxRounded)} m di luar area lab · Akurasi ${accuracyValueText}`}
      </Text>

      {verification.isWeakAccuracy && verification.accuracyMeters !== null ? (
        <InfoBanner
          tone="warning"
          message={`Sinyal GPS lemah (akurasi >50m, terukur ${Math.round(verification.accuracyMeters)}m)`}
          description="Jika sinyal lemah di dalam gedung, bergeraklah mendekati jendela/pintu lab lalu segarkan."
        />
      ) : null}

      <AppButton
        label="Segarkan Lokasi"
        variant="secondary"
        size="sm"
        onPress={onRefresh}
        loading={refreshing}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  radiusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  radiusBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  statNumber: {
    fontSize: FontSize.stat,
    lineHeight: 32,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  statSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  accuracyText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
