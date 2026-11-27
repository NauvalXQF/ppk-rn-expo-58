import { createHash, timingSafeEqual } from 'node:crypto';
import { object } from './provisioning.ts';
import { HttpError } from './middleware/errorHandler.ts';

const snapBase = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const statusBase = 'https://api.sandbox.midtrans.com/v2/';
export const snapPageMs = 5 * 60_000;

export function isSandboxCheckout(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === 'https://app.sandbox.midtrans.com' && !url.username && !url.password && url.pathname.startsWith('/snap/');
  } catch { return false; }
}

export type Checkout = { snapToken: string; redirectUrl: string };
export type ProviderStatus = {
  orderId: string; amount: number; transactionId: string; status: string; fraud: unknown;
  paymentType: string | null; transactionTime: string | null;
};
export interface Gateway {
  create(orderId: string, amount: number): Promise<Checkout>;
  status(orderId: string, transactionId?: string): Promise<ProviderStatus | null>;
}
export function amountIdr(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+(?:\.0{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function resolveWebhookKey(signatureSecret?: string, serverKey?: string) {
  return signatureSecret?.trim() || serverKey?.trim() || undefined;
}

export function verifyWebhook(input: unknown, secret: string) {
  const { order_id, status_code, gross_amount, signature_key, transaction_id } = object(input);
  if (typeof order_id !== 'string' || !/^FINE-[a-f0-9-]{36}$/.test(order_id)
    || typeof status_code !== 'string' || !/^\d{3}$/.test(status_code)
    || typeof gross_amount !== 'string' || amountIdr(gross_amount) === null
    || typeof transaction_id !== 'string' || !transaction_id || transaction_id.length > 128) {
    throw new HttpError('INVALID_INPUT');
  }
  const hash = createHash('sha512').update(order_id + status_code + gross_amount + secret).digest();
  if (typeof signature_key !== 'string' || !/^[a-f0-9]{128}$/i.test(signature_key)
    || !timingSafeEqual(hash, Buffer.from(signature_key, 'hex'))) throw new HttpError('FORBIDDEN');
  return { orderId: order_id, transactionId: transaction_id, amount: amountIdr(gross_amount)! };
}

export function sandboxGateway(serverKey: string, fetchFn = fetch): Gateway {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json',
    Authorization: 'Basic ' + Buffer.from(serverKey + ':').toString('base64') };
  async function request(url: string, body?: unknown) {
    try {
      const response = await fetchFn(url, { headers, redirect: 'error', signal: AbortSignal.timeout(4500),
        ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
      const data = object(await response.json());
      if (!body && (response.status === 404 || (response.ok && data.status_code === '404'))) return null;
      if (!response.ok) throw new Error('Provider rejected request.');
      return data;
    } catch { throw new HttpError('PAYMENT_UNAVAILABLE'); }
  }
  return {
    async create(orderId, amount) {
      const data = await request(snapBase, {
        transaction_details: { order_id: orderId, gross_amount: amount },
        page_expiry: { duration: 5, unit: 'minutes' },
      });
      if (typeof data?.token !== 'string' || !data.token || !isSandboxCheckout(data.redirect_url)) {
        throw new HttpError('PAYMENT_UNAVAILABLE');
      }
      return { snapToken: data.token, redirectUrl: data.redirect_url };
    },
    async status(orderId, transactionId) {
      const data = await request(statusBase + encodeURIComponent(transactionId ?? orderId) + '/status');
      if (!data) return null;
      const amount = amountIdr(data.gross_amount);
      if (data.order_id !== orderId || !amount || (data.currency !== undefined && data.currency !== 'IDR')
        || typeof data.transaction_id !== 'string' || !data.transaction_id || typeof data.transaction_status !== 'string'
        || (transactionId !== undefined && data.transaction_id !== transactionId)) {
        throw new HttpError('PAYMENT_UNAVAILABLE');
      }
      return {
        orderId, amount, transactionId: data.transaction_id, status: data.transaction_status, fraud: data.fraud_status,
        paymentType: typeof data.payment_type === 'string' ? data.payment_type : null,
        transactionTime: typeof data.transaction_time === 'string' ? data.transaction_time : null,
      };
    },
  };
}
