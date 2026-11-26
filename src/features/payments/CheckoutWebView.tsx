import { Linking } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { isSandboxCheckout } from '@/services/payments/paymentData';

export function CheckoutWebView({ url, onFailure }: { url: string; onFailure: () => void }) {
  if (!isSandboxCheckout(url)) return null;
  return <AppButton label="Buka Checkout Sandbox" onPress={() => void Linking.openURL(url).catch(onFailure)} />;
}
