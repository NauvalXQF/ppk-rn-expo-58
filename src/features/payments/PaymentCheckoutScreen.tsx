import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { openBrowserAsync } from 'expo-web-browser';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { checkPaymentStatus, createPayment, subscribeFine, subscribePayment } from '@/services/payments/paymentService';
import { isSandboxCheckout } from '@/services/payments/paymentData';
import type { PaymentFine, PaymentTransaction } from '@/types/payment';
import { CheckoutWebView } from './CheckoutWebView';
import { paymentDate, rupiah } from './paymentPresentation';

export function PaymentCheckoutScreen({ uid, fineId }: { uid: string; fineId: string }) {
  const [fine, setFine] = useState<PaymentFine | null>();
  const [payment, setPayment] = useState<PaymentTransaction | null>(null);
  const [checkout, setCheckout] = useState<{ orderId: string; redirectUrl: string } | null>(null);
  const [error, setError] = useState('');
  const [webViewFailed, setWebViewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const orderId = fine?.latestOrderId;
  const currentPayment = payment?.orderId === orderId ? payment : null;
  const url = checkout?.orderId === orderId ? checkout?.redirectUrl : undefined;
  const needsReview = fine?.reconciliationRequired || currentPayment?.reconciliationRequired;
  const canShowCheckout = Boolean(url && !needsReview && fine?.status === 'pending_payment' && currentPayment?.status !== 'success');

  useEffect(() => subscribeFine(uid, fineId, setFine, () => setError('Tagihan belum dapat dimuat.')), [uid, fineId]);
  useEffect(() => {
    if (!orderId) return;
    return subscribePayment(uid, orderId, setPayment, () => setError('Status transaksi belum dapat dimuat.'));
  }, [uid, orderId]);

  async function run(action: 'checkout' | 'verify') {
    if (inFlight.current) return;
    inFlight.current = true;
    setError('');
    setBusy(true);
    try {
      if (action === 'checkout') {
        const result = await createPayment(uid, fineId);
        setWebViewFailed(false);
        setCheckout({ orderId: result.orderId, redirectUrl: result.redirectUrl });
      } else {
        setFine(await checkPaymentStatus(uid, fineId));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memeriksa status pembayaran.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const closeCheckout = () => { setCheckout(null); void run('verify'); };
  async function openCheckoutInBrowser() {
    if (!isSandboxCheckout(url)) return;
    try { await openBrowserAsync(url); }
    catch { setError('Browser tidak dapat membuka checkout Sandbox.'); }
  }
  return (
    <ScreenContainer hasTabBar={false} scrollable={!canShowCheckout} contentStyle={canShowCheckout ? styles.full : undefined}>
      <LinearGradient colors={Gradients.detailTop} style={styles.header}>
        <IconButton accessibilityLabel={canShowCheckout ? 'Tutup checkout' : 'Kembali'}
          onPress={canShowCheckout ? closeCheckout : () => router.back()}>
          <AppIcon name="chevron-left" />
        </IconButton>
        <AppText variant="title">Pembayaran Denda</AppText>
      </LinearGradient>
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {canShowCheckout && url ? <>
        <AppButton variant="secondary" label="Buka di Browser" onPress={() => void openCheckoutInBrowser()} />
        {!webViewFailed ? <CheckoutWebView url={url} onFailure={() => {
          setWebViewFailed(true);
          setError('WebView gagal memuat checkout. Buka di browser untuk melanjutkan.');
        }} /> : null}
      </> : fine === undefined && !error ?
        <ActivityIndicator color={Colors.primary} accessibilityLabel="Memuat tagihan" />
      : fine ? <AppCard variant="solid">
        <AppText variant="title">{fine.sessionTopik}</AppText>
        <AppText>{fine.labNama} · {paymentDate(fine.createdAt)}</AppText>
        <AppText variant="display">{rupiah(fine.amount)}</AppText>
        {needsReview ? <InfoBanner tone="warning" message="Pembayaran memerlukan pemeriksaan. Hubungi Aslab sebelum mencoba lagi." />
          : fine.status === 'paid' ? <InfoBanner tone="success" message="Pembayaran berhasil diverifikasi." />
          : fine.status === 'waived' ? <InfoBanner tone="neutral" message="Tagihan ini dibebaskan." />
          : <InfoBanner tone={currentPayment?.status === 'failed' ? 'danger' : 'warning'}
              message={currentPayment?.status === 'failed' ? 'Pembayaran belum berhasil. Cek status atau lanjutkan transaksi.'
                : fine.status === 'pending_payment' ? 'Menunggu konfirmasi pembayaran dari server.' : 'Tagihan belum dibayar.'} />}
        {!needsReview && (fine.status === 'unpaid' || fine.status === 'pending_payment') ? (
          <AppButton loading={busy} label={fine.status === 'pending_payment' ? 'Lanjutkan Pembayaran' : orderId ? 'Coba Bayar Lagi' : 'Bayar Denda'}
            onPress={() => void run('checkout')} />
        ) : null}
      </AppCard> : <InfoBanner tone="neutral" message="Tagihan tidak tersedia." />}
      {!canShowCheckout ? <AppButton variant="secondary" disabled={busy} label="Cek Status" onPress={() => void run('verify')} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
});
