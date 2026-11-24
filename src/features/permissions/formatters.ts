import { formatTanggal, formatWaktuPresensi } from '@/utils/date';
import {
  classifyLeaveReasonCategory,
  type LeaveReasonCategory,
} from '@/features/permissions/leaveReasonClassifier';

const reasonCategoryLabels: Record<LeaveReasonCategory, string> = {
  sick: 'Sakit',
  family: 'Keperluan Keluarga',
  academic: 'Kegiatan Akademik',
  personal: 'Keperluan Pribadi',
  other: 'Lainnya / Perlu Ditinjau',
};

export function formatLeaveReasonCategory(reason: string): string {
  return `Kategori alasan: ${reasonCategoryLabels[classifyLeaveReasonCategory(reason)]}`;
}

export function getLeaveAiResultLabel(category: string): string {
  return /^(negatif|netral|positif)$/i.test(category) ? 'Sentimen AI' : 'Klasifikasi AI';
}

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

