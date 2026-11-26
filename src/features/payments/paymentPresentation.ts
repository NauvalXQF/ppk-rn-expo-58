const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

export function rupiah(amount: number) { return currency.format(amount); }

export function paymentDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + '+07:00' : value);
  return Number.isFinite(date.getTime()) ? (withTime ? dateTime : day).format(date) : '—';
}
