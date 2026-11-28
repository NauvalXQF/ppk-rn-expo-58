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
  const { state, error } = useApp();

  const { sesi, presensiSaya } = detail;
  const isEligibleKelas = isPraktikanInClass(praktikan, sesi.kelasId);
  const myLeave = !presensiSaya
    ? state.leaveRequests?.find(
        (leave) => leave.sessionId === sesi.id && leave.uid === praktikan.id,
      )
    : undefined;
  const hasApprovedLeave = Boolean(
    !presensiSaya &&
      (myLeave?.status === 'approved' ||
        state.approvedLeaves?.some(
          (leave) => leave.sessionId === sesi.id && leave.uid === praktikan.id,
        )),
  );
  const canRequestLeave = isEligibleKelas && !presensiSaya && !myLeave && !hasApprovedLeave && sesi.status !== 'ditutup';

  return (
    <View style={styles.container}>
      {error ? <InfoBanner tone="danger" message={error} /> : null}

      {!isEligibleKelas ? (
        <InfoBanner
          tone="warning"
          message="Anda tidak terdaftar pada kelas sesi praktikum ini."
        />
      ) : null}

      {isEligibleKelas && hasApprovedLeave ? (
        <InfoBanner
          tone="info"
          message="Tidak Hadir dengan Izin (Excused Absence)"
          description="Pengajuan izin Anda pada sesi ini telah disetujui dan bebas dari denda keterlambatan."
        />
      ) : null}

      {isEligibleKelas && myLeave?.status === 'pending' ? (
        <InfoBanner
          tone="warning"
          message="Pengajuan Izin Menunggu Keputusan"
          description="Permohonan izin Anda untuk sesi ini sedang ditinjau oleh asisten."
        />
      ) : null}

      {isEligibleKelas && myLeave?.status === 'rejected' ? (
        <InfoBanner
          tone="danger"
          message="Pengajuan Izin Ditolak"
          description={
            myLeave.decisionNote
              ? `Catatan asisten: ${myLeave.decisionNote}`
              : 'Pengajuan izin Anda ditolak oleh asisten. Silakan lakukan presensi jika sesi masih dibuka.'
          }
        />
      ) : null}

      {isEligibleKelas && !hasApprovedLeave && sesi.status === 'dijadwalkan' && (
        <View style={styles.section}>
          <InfoBanner
            tone="info"
            message="Sesi belum dibuka. Anda dapat melakukan presensi setelah asisten membuka sesi."
          />
        </View>
      )}

      {canRequestLeave ? (
        <AppButton
          label="Ajukan Izin"
          variant="secondary"
          onPress={() =>
            router.push(`/(tabs)/izin?sesiId=${encodeURIComponent(sesi.id)}` as Href)
          }
        />
      ) : null}

      {isEligibleKelas && !hasApprovedLeave && sesi.status === 'dibuka' && !presensiSaya && (
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
          lateStatus={presensiSaya.lateStatus}
          lateMinutes={presensiSaya.lateMinutes}
          fineAmount={sesi.lateFineAmount}
        />
      )}

      {sesi.status === 'ditutup' && (
        <View style={styles.section}>
          {presensiSaya ? (
            <>
              <PresensiSuccess
                waktuPresensi={presensiSaya.waktuPresensi}
                catatan={presensiSaya.catatan}
                lateStatus={presensiSaya.lateStatus}
                lateMinutes={presensiSaya.lateMinutes}
                fineAmount={sesi.lateFineAmount}
                showButton={false}
              />
              <InfoBanner tone="neutral" message="Sesi telah ditutup." />
            </>
          ) : hasApprovedLeave ? null : (
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
