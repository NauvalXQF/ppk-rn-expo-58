import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
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
  loading,
  refreshing,
  errorMessage,
  onRefresh,
  onOpenSettings,
}: LocationStatusCardProps) {
  if (permissionState === 'denied') {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Lokasi Lab" />
        <InfoBanner
          tone="danger"
          message="Izin lokasi ditolak. Aplikasi membutuhkan akses lokasi untuk memvalidasi presensi di lab."
          description={
            Platform.OS === 'web'
              ? 'Klik ikon pengaturan di sebelah kiri address bar browser lalu izinkan akses Location dan tekan Coba Lagi.'
              : 'Berikan izin lokasi melalui pengaturan aplikasi lalu segarkan kembali.'
          }
        />
        <View style={styles.actionRow}>
          {Platform.OS !== 'web' ? (
            <AppButton
              label="Buka Pengaturan Aplikasi"
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
        <SectionHeader title="Verifikasi Lokasi Lab" />
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
        <SectionHeader title="Verifikasi Lokasi Lab" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>
            Mengambil koordinat GPS terkini dan menghitung jarak ke {labTarget.labNama}...
          </Text>
        </View>
      </AppCard>
    );
  }

  if (!verification) {
    return (
      <AppCard style={styles.card}>
        <SectionHeader title="Verifikasi Lokasi Lab" />
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
      ? `${Math.round(verification.accuracyMeters)} meter — ${accuracyInfo.label}`
      : 'Tidak diketahui';

  return (
    <AppCard style={styles.card}>
      <SectionHeader
        title="Verifikasi Lokasi Lab"
        rightText={`Batas ${Math.round(verification.radiusMeters)}m`}
      />

      <View
        style={[
          styles.statusBox,
          isInside ? styles.statusBoxValid : styles.statusBoxInvalid,
        ]}
      >
        <View
          style={[
            styles.radarCircle,
            isInside ? styles.radarCircleValid : styles.radarCircleInvalid,
          ]}
        >
          <Text style={styles.radarIcon}>{isInside ? '✓' : '✕'}</Text>
        </View>

        <View style={styles.statusTextWrap}>
          <Text
            style={[
              styles.statusTitle,
              isInside ? styles.statusTitleValid : styles.statusTitleInvalid,
            ]}
          >
            {isInside
              ? 'Status Lokasi: Di Dalam Radius'
              : 'Status Lokasi: Di Luar Radius'}
          </Text>
          <Text style={styles.distanceText}>
            Jarak Anda ke {labTarget.labNama}:{' '}
            <Text style={styles.boldText}>
              {Math.round(verification.distanceMeters)} meter
            </Text>{' '}
            (Maksimal: {Math.round(verification.radiusMeters)} meter)
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Akurasi GPS</Text>
        <Text style={styles.metricValue}>{accuracyValueText}</Text>
      </View>

      {verification.isWeakAccuracy && verification.accuracyMeters !== null ? (
        <InfoBanner
          tone="warning"
          message={`Mencari sinyal GPS akurat (Akurasi saat ini: >50m, terukur ${Math.round(verification.accuracyMeters)}m)...`}
          description="Jika sinyal lemah di dalam gedung, bergeraklah mendekati jendela/pintu lab lalu segarkan lokasi."
        />
      ) : null}

      {!isInside ? (
        <InfoBanner
          tone="danger"
          message={verification.message}
          description="Dekati ruangan laboratorium hingga jarak berada di dalam batas toleransi."
        />
      ) : null}

      <AppButton
        label="Segarkan Lokasi"
        variant="secondary"
        onPress={onRefresh}
        loading={refreshing}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  flexButton: {
    flex: 1,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  loadingText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  statusBoxValid: {
    backgroundColor: Colors.successSoft,
    borderColor: '#B4EDCD',
  },
  statusBoxInvalid: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#FDA29B',
  },
  radarCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleValid: {
    backgroundColor: Colors.success,
  },
  radarCircleInvalid: {
    backgroundColor: Colors.danger,
  },
  radarIcon: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusTitleValid: {
    color: Colors.success,
  },
  statusTitleInvalid: {
    color: Colors.danger,
  },
  distanceText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  metricLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
});
