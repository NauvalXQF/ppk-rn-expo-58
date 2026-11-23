import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
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

      {isEligibleKelas && sesi.status === 'dibuka' && !presensiSaya && (
        <View style={styles.section}>
          <SectionHeader title="Agenda & informasi sesi" />
          <InfoBanner
            tone="info"
            message="Presensi Berbasis Lokasi (GPS)"
            description="Pastikan GPS perangkat aktif dan kamu berada di dalam radius laboratorium sebelum mengirim kehadiran."
          />
        </View>
      )}

      {sesi.status === 'dibuka' && presensiSaya && (
        <PresensiSuccess
          waktuPresensi={presensiSaya.waktuPresensi}
          catatan={presensiSaya.catatan}
        />
      )}

      {sesi.status === 'ditutup' && (
        <View style={styles.section}>
          {presensiSaya ? (
            <>
              <PresensiSuccess
                waktuPresensi={presensiSaya.waktuPresensi}
                catatan={presensiSaya.catatan}
                showButton={false}
              />
              <InfoBanner tone="neutral" message="Sesi telah ditutup." />
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
});
