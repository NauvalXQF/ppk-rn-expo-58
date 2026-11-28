import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { isSandboxCheckout, isSandboxCheckoutNavigation } from '@/services/payments/paymentData';
import { Colors } from '@/constants/theme';

export function CheckoutWebView({ url, onFailure }: { url: string; onFailure: () => void }) {
  if (!isSandboxCheckout(url)) return null;
  return <WebView source={{ uri: url }} originWhitelist={['*']}
    onShouldStartLoadWithRequest={(request) => isSandboxCheckoutNavigation(request.url)}
    setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
    allowFileAccess={false} mixedContentMode="never" sharedCookiesEnabled={false}
    onError={onFailure} onHttpError={onFailure} style={styles.checkout} />;
}

const styles = StyleSheet.create({ checkout: { flex: 1, backgroundColor: Colors.surface } });
