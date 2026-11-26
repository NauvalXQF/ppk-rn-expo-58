import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckoutScreen } from '@/features/payments/PaymentCheckoutScreen';
import { isPaymentId } from '@/services/payments/paymentData';

export default function PembayaranRoute() {
  const { status, pengguna } = useAuth();
  const { fineId } = useLocalSearchParams<{ fineId: string }>();
  if (status === 'memuat') return null;
  if (status !== 'masuk' || pengguna?.role !== 'praktikan' || !isPaymentId(fineId)) return <Redirect href="/" />;
  return <PaymentCheckoutScreen key={pengguna.uid + ':' + fineId} uid={pengguna.uid} fineId={fineId} />;
}
