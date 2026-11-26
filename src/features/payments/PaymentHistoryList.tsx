import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoBanner } from '@/components/ui/InfoBanner';
import type { PaymentFine, PaymentTransaction } from '@/types/payment';
import { paymentDate, rupiah } from './paymentPresentation';

export function PaymentHistoryList({ payments, fines, onCheckout }: {
  payments: PaymentTransaction[];
  fines: PaymentFine[];
  onCheckout: (fineId: string) => void;
}) {
  if (!payments.length) return <EmptyState title="Belum ada transaksi" description="Riwayat pembayaran akan muncul di sini." />;
  const byId = new Map(fines.map((fine) => [fine.id, fine]));
  return payments.map((item) => {
    const fine = byId.get(item.fineId);
    const needsReview = item.reconciliationRequired || fine?.reconciliationRequired;
    const canRetry = !needsReview && item.status === 'failed' && fine?.status === 'unpaid' && item.orderId === fine.latestOrderId;
    return (
      <AppCard key={item.orderId}>
        <AppText variant="title">{item.sessionTopik || 'Sesi praktikum'}</AppText>
        <AppText>{item.labNama}</AppText>
        <AppText variant="caption">Tanggal tagihan · {paymentDate(item.fineCreatedAt)}</AppText>
        <AppText variant="caption">Waktu transaksi · {paymentDate(item.transactionTime ?? item.createdAt, true)}</AppText>
        {item.paymentType ? <AppText variant="caption">Metode · {item.paymentType.replaceAll('_', ' ')}</AppText> : null}
        <AppText variant="title">{rupiah(item.grossAmount)}</AppText>
        <InfoBanner tone={needsReview ? 'warning' : item.status === 'success' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}
          message={needsReview ? 'Sedang diperiksa' : item.status === 'success' ? 'Berhasil'
            : item.status === 'failed' ? 'Belum berhasil' : 'Menunggu pembayaran'} />
        {canRetry ? <AppButton variant="secondary" label="Coba Bayar Lagi" onPress={() => onCheckout(item.fineId)} /> : null}
      </AppCard>
    );
  });
}
