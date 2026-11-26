export function isPaymentId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,512}$/.test(id) && id !== '.' && id !== '..'
    && !/^__.*__$/.test(id);
}

export function isSandboxCheckout(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://app.sandbox.midtrans.com' && !parsed.username && !parsed.password
      && parsed.pathname.startsWith('/snap/');
  } catch {
    return false;
  }
}

export function resolvePaymentApiOrigin(value: string, allowLocalHttp: boolean): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol === 'https:') return url.origin;
    const loopbacks = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'];
    return allowLocalHttp && url.protocol === 'http:' && loopbacks.includes(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export function toIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return '';
}

export function resolvePaymentNotificationRoute(data: Record<string, unknown> | null | undefined): string | null {
  if (data?.type === 'fine_created') return '/denda?tab=aktif';
  if (data?.type === 'payment_success' || data?.type === 'payment_failed') return '/denda?tab=riwayat';
  return null;
}
