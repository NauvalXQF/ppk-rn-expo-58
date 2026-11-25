import type { Laboratory, LaboratoryInput } from '@/types/laboratory';

export const DEFAULT_LAB_RADIUS = 30;
export const DEFAULT_GRACE_PERIOD_MINUTES = 15;
export const DEFAULT_LATE_FINE_AMOUNT = 10000;

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function validCoordinates(latitude: number, longitude: number): boolean {
  return inRange(latitude, -90, 90) && inRange(longitude, -180, 180);
}

export function validRadius(radiusMeters: number): boolean {
  return inRange(radiusMeters, 10, 500);
}

export function validGracePeriod(gracePeriodMinutes: number): boolean {
  return inRange(gracePeriodMinutes, 0, 120);
}

export function validLateFineAmount(lateFineAmount: number): boolean {
  return typeof lateFineAmount === 'number' && Number.isFinite(lateFineAmount) && lateFineAmount >= 0;
}

export function validateLaboratory(input: LaboratoryInput): string | null {
  if (!input.nama.trim() || !input.kode.trim() || !input.gedung.trim()) {
    return 'Isi nama, kode, dan gedung laboratorium.';
  }
  if (!validCoordinates(input.latitude, input.longitude)) {
    return 'Latitude harus antara -90 dan 90, longitude antara -180 dan 180.';
  }
  if (!validRadius(input.radiusMeters)) {
    return 'Radius harus antara 10 dan 500 meter.';
  }
  if (!Number.isSafeInteger(input.kapasitas) || input.kapasitas < 1) {
    return 'Kapasitas harus berupa bilangan bulat positif.';
  }
  if (input.gracePeriodMinutes !== undefined && !validGracePeriod(input.gracePeriodMinutes)) {
    return 'Batas toleransi keterlambatan harus antara 0 dan 120 menit.';
  }
  if (input.lateFineAmount !== undefined && !validLateFineAmount(input.lateFineAmount)) {
    return 'Nominal denda tidak boleh bernilai negatif.';
  }
  return null;
}

export function readLaboratory(id: string, data: unknown): Laboratory | null {
  if (!data || typeof data !== 'object') return null;
  const {
    id: documentId, nama, kode, gedung, latitude, longitude, radiusMeters, kapasitas, aktif,
    gracePeriodMinutes, lateFineAmount, courseId, courseNama, asprakUids,
  } = data as Record<string, unknown>;
  if (!id || documentId !== id || typeof aktif !== 'boolean' ||
    typeof nama !== 'string' || typeof kode !== 'string' || typeof gedung !== 'string' ||
    typeof latitude !== 'number' || typeof longitude !== 'number' ||
    typeof radiusMeters !== 'number' || typeof kapasitas !== 'number') {
    return null;
  }
  const laboratory: Laboratory = {
    id, nama, kode, gedung, latitude, longitude, radiusMeters, kapasitas, aktif,
    ...(typeof gracePeriodMinutes === 'number' ? { gracePeriodMinutes } : {}),
    ...(typeof lateFineAmount === 'number' ? { lateFineAmount } : {}),
    ...(typeof courseId === 'string' ? { courseId } : {}),
    ...(typeof courseNama === 'string' ? { courseNama } : {}),
    ...(Array.isArray(asprakUids) ? { asprakUids } : {}),
  };
  return validateLaboratory(laboratory) ? null : laboratory;
}

export function activeLaboratories(laboratories: readonly Laboratory[]): Laboratory[] {
  return laboratories.filter((laboratory) => laboratory.aktif);
}

export function selectLaboratories(
  documentCount: number,
  laboratories: readonly Laboratory[],
  developmentFallback: readonly Laboratory[],
): readonly Laboratory[] {
  return documentCount > 0 ? laboratories : developmentFallback;
}
