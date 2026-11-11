import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useApp } from '@/store/app-context';
import type { DetailSesi, Praktikan } from '@/types/models';
import { Spacing } from '@/constants/theme';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { PresensiForm } from './PresensiForm';
import { PresensiSuccess } from './PresensiSuccess';

interface PraktikanSessionViewProps {
  detail: DetailSesi;
  praktikan: Praktikan;
}

export function PraktikanSessionView({
  detail,
  praktikan,
}: PraktikanSessionViewProps) {
  const { catatPresensi, loading, error } = useApp();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingCatatan, setPendingCatatan] = useState('');

  const { sesi, kelas, presensiSaya } = detail;
  const isEligibleKelas = praktikan.kelasId === sesi.kelasId;

  const handleFormSubmit = (catatan: string) => {
    setPendingCatatan(catatan);
    setConfirmVisible(true);
  };

  const handleConfirmPresensi = () => {
    setConfirmVisible(false);
    catatPresensi(sesi.id, pendingCatatan).catch(() => {});
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
        <InfoBanner
          tone="info"
          message="Sesi belum dibuka. Kamu bisa melakukan presensi setelah asisten membuka sesi."
        />
      )}

      {/* 6B. Sesi Dibuka, belum presensi */}
      {isEligibleKelas && sesi.status === 'dibuka' && !presensiSaya && (
        <PresensiForm onSubmit={handleFormSubmit} disabled={loading} />
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

      <ConfirmSheet
        visible={confirmVisible}
        title="Konfirmasi Presensi"
        description={`${sesi.topik} · ${kelas.nama}\nWaktu kehadiran dicatat otomatis.`}
        confirmLabel="Ya, Presensi"
        cancelLabel="Batal"
        tone="primary"
        onConfirm={handleConfirmPresensi}
        onClose={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  closedContainer: {
    gap: Spacing.md,
  },
});
