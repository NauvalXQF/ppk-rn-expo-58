import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Colors, Spacing } from '@/constants/theme';
import { subscribeFines, subscribePayments } from '@/services/payments/paymentService';
import { isPaymentId } from '@/services/payments/paymentData';
import { useApp } from '@/store/app-context';
import type { PaymentFine, PaymentTransaction } from '@/types/payment';
import { PaymentHistoryList } from './PaymentHistoryList';
import { paymentDate, rupiah } from './paymentPresentation';

export function PraktikanFinesScreen({ uid, initialTab }: { uid: string; initialTab: 'aktif' | 'riwayat' }) {
  const { state } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [fines, setFines] = useState<PaymentFine[] | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[] | null>(null);
  const [fineError, setFineError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const stopFines = subscribeFines(uid, setFines, () => setFineError(true));
    const stopPayments = subscribePayments(uid, setPayments, () => setHistoryError(true));
    return () => { stopFines(); stopPayments(); };
  }, [uid, attempt]);

  const active = fines?.filter((fine) => fine.status === 'unpaid' || fine.status === 'pending_payment') ?? [];
  const courseNames = new Map(state.praktikum.map((course) => [course.id, course.nama]));
  const total = active.reduce((sum, fine) => sum + fine.amount, 0);
  const hasError = tab === 'aktif' ? fineError : historyError;
  const loading = tab === 'aktif' ? fines === null : payments === null;
  function checkout(fineId: string) {
    if (isPaymentId(fineId)) router.push(('/pembayaran/' + encodeURIComponent(fineId)) as Href);
  }
  function retry() {
    setFineError(false);
    setHistoryError(false);
    setAttempt((value) => value + 1);
  }

  return (
    <ScreenContainer>
      <AppText variant="display">Denda</AppText>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
        <FilterChip label="Tagihan Aktif" active={tab === 'aktif'} style={{ minHeight: 44 }} onPress={() => setTab('aktif')} />
        <FilterChip label="Riwayat Pembayaran" active={tab === 'riwayat'} style={{ minHeight: 44 }} onPress={() => setTab('riwayat')} />
      </View>
      {hasError ? <>
        <InfoBanner tone="danger" message="Data pembayaran belum dapat dimuat." />
        <AppButton variant="secondary" label="Muat Ulang" onPress={retry} />
      </> : loading ? <ActivityIndicator color={Colors.primary} accessibilityLabel="Memuat data pembayaran" />
      : tab === 'riwayat' ? <PaymentHistoryList payments={payments ?? []} fines={fines ?? []} onCheckout={checkout} />
      : <>
        <AppCard>
          <AppText variant="caption">Total tagihan aktif</AppText>
          <AppText variant="display">{rupiah(total)}</AppText>
        </AppCard>
        {active.length ? active.map((fine) => (
          <AppCard key={fine.id}>
            <AppText variant="title">{fine.sessionTopik}</AppText>
            <AppText>{fine.labNama} · {courseNames.get(fine.courseId) ?? fine.courseId}</AppText>
            <AppText variant="caption">Tanggal tagihan · {paymentDate(fine.createdAt)}</AppText>
            <AppText variant="caption">Terlambat {fine.lateMinutes} menit · Presensi {paymentDate(fine.waktuPresensi, true)}</AppText>
            <AppText variant="title">{rupiah(fine.amount)}</AppText>
            <InfoBanner tone={fine.reconciliationRequired || fine.status === 'pending_payment' ? 'warning' : 'neutral'}
              message={fine.reconciliationRequired ? 'Sedang diperiksa' : fine.status === 'pending_payment' ? 'Menunggu pembayaran' : 'Belum dibayar'} />
            {!fine.reconciliationRequired ? <AppButton label={fine.status === 'pending_payment' ? 'Lanjutkan Pembayaran' : fine.latestOrderId ? 'Coba Bayar Lagi' : 'Bayar Denda'}
              onPress={() => checkout(fine.id)} /> : null}
          </AppCard>
        )) : <EmptyState title="Tidak ada tagihan aktif" description="Tagihan baru akan muncul di sini." />}
      </>}
    </ScreenContainer>
  );
}
