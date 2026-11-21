import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/store/app-context';
import { isPraktikanInClass } from '@/store/selectors';
import type { DetailSesi, Praktikan } from '@/types/models';
import { PresensiSuccess } from './PresensiSuccess';

interface PraktikanSessionViewProps {
  detail: DetailSesi;
  praktikan: Praktikan;
}

export function PraktikanSessionView({
  detail,
  praktikan,
}: PraktikanSessionViewProps) {
  const router = useRouter();
  const { error } = useApp();

  const { sesi, presensiSaya } = detail;
  const isEligibleKelas = isPraktikanInClass(praktikan, sesi.kelasId);

  const openGeoAttendance = () => {
    router.push(`/presensi/${sesi.id}` as Href);
  };

  return (
    <View style={styles.container}>
      {error ? <InfoBanner tone="danger" message={error} /> : null}

      {!isEligibleKelas ? (
        <InfoBanner
          tone="warning"
          message="Anda tidak terdaftar pada kelas sesi praktikum ini."
        />
      ) : null}

      {/* 6A. Sesi Dijadwalkan */}
      {isEligibleKelas && sesi.status === 'dijadwalkan' && (
        <View style={styles.section}>
          <InfoBanner
            tone="info"
            message="Sesi belum dibuka. Kamu bisa melakukan presensi setelah asisten membuka sesi."
          />
          <AppButton
            label="Lihat Halaman Presensi"
            variant="secondary"
            onPress={openGeoAttendance}
          />
        </View>
      )}

      {/* 6B. Sesi Dibuka, belum presensi -> Arahkan ke halaman presensi khusus geofence */}
      {isEligibleKelas && sesi.status === 'dibuka' && !presensiSaya && (
        <AppCard style={styles.card}>
          <SectionHeader title="Presensi Berbasis Lokasi" />
          <InfoBanner
            tone="info"
            message="Presensi memerlukan verifikasi lokasi GPS di dalam radius laboratorium."
          />
          <AppButton
            label="Buka Halaman Presensi"
            onPress={openGeoAttendance}
          />
        </AppCard>
      )}

      {/* 6C. Sesi Dibuka, sudah presensi */}
      {sesi.status === 'dibuka' && presensiSaya && (
        <PresensiSuccess
          waktuPresensi={presensiSaya.waktuPresensi}
          catatan={presensiSaya.catatan}
        />
      )}

      {/* 6D. Sesi Ditutup */}
      {sesi.status === 'ditutup' && (
        <View style={styles.closedContainer}>
          {presensiSaya ? (
            <>
              <PresensiSuccess
                waktuPresensi={presensiSaya.waktuPresensi}
                catatan={presensiSaya.catatan}
                showButton={false}
              />
              <InfoBanner tone="info" message="Sesi telah ditutup." />
            </>
          ) : (
            <InfoBanner
              tone="warning"
              message="Sesi telah ditutup dan kamu tidak tercatat hadir."
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.md,
  },
  closedContainer: {
    gap: Spacing.md,
  },
});
