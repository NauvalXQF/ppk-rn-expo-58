import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { DetailSesi } from '@/types/models';
import { useApp } from '@/store/app-context';
import { Spacing } from '@/constants/theme';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { SessionControlCard } from './SessionControlCard';
import { RekapSummary } from '@/features/rekap/RekapSummary';

export interface AsistenSessionViewProps {
  detail: DetailSesi;
}

export function AsistenSessionView({ detail }: AsistenSessionViewProps) {
  const { dispatch } = useApp();
  const [bukaSheetVisible, setBukaSheetVisible] = useState(false);
  const [tutupSheetVisible, setTutupSheetVisible] = useState(false);

  const handleBukaSesiConfirm = () => {
    dispatch({ type: 'BUKA_SESI', sesiId: detail.sesi.id });
    setBukaSheetVisible(false);
  };

  const handleTutupSesiConfirm = () => {
    dispatch({ type: 'TUTUP_SESI', sesiId: detail.sesi.id });
    setTutupSheetVisible(false);
  };

  return (
    <View style={styles.container}>
      <SessionControlCard
        status={detail.sesi.status}
        onBukaSesi={() => setBukaSheetVisible(true)}
        onTutupSesi={() => setTutupSheetVisible(true)}
      />

      <View style={styles.rekapSection}>
        <RekapSummary rekap={detail.rekap} />
      </View>

      <ConfirmSheet
        visible={bukaSheetVisible}
        title="Buka sesi sekarang?"
        description="Praktikan dapat melakukan presensi setelah sesi dibuka."
        confirmLabel="Ya, Buka Sesi"
        cancelLabel="Batal"
        tone="primary"
        onConfirm={handleBukaSesiConfirm}
        onClose={() => setBukaSheetVisible(false)}
      />

      <ConfirmSheet
        visible={tutupSheetVisible}
        title="Tutup sesi?"
        description="Praktikan tidak dapat melakukan presensi lagi setelah sesi ditutup."
        confirmLabel="Ya, Tutup Sesi"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={handleTutupSesiConfirm}
        onClose={() => setTutupSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  rekapSection: {
    marginTop: Spacing.xs,
  },
});

