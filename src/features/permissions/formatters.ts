import { formatTanggal, formatWaktuPresensi } from '@/utils/date';

export function safeFormatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return formatTanggal(dateStr);
  } catch {
    return dateStr;
  }
}

export function safeFormatTime(isoStr: string | null): string {
  if (!isoStr) return '-';
  try {
    return formatWaktuPresensi(isoStr);
  } catch {
    return isoStr;
  }
}

