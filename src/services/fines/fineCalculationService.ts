import { getApp, getApps } from 'firebase/app';
import {
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

import {
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LATE_FINE_AMOUNT,
  type FineCreatedNotificationInput,
  type FinePolicy,
  type FineRecord,
  type LateEvaluationResult,
} from '@/types/fine';

const MAX_GRACE_PERIOD_MINUTES = 120;
const MS_PER_MINUTE = 60_000;

type FineCreatedNotifier = (
  input: FineCreatedNotificationInput,
) => Promise<void> | void;

let fineCreatedNotifier: FineCreatedNotifier | null = null;

/**
 * Mengizinkan modul notifikasi (P3) mendaftarkan handler push `fine_created`
 * tanpa menciptakan ketergantungan sirkular pada layanan presensi/denda.
 */
export function registerFineCreatedNotifier(
  handler: FineCreatedNotifier | null,
): void {
  fineCreatedNotifier = handler;
}

export async function dispatchFineCreatedNotification(
  input: FineCreatedNotificationInput,
): Promise<void> {
  if (!fineCreatedNotifier) return;
  try {
    await fineCreatedNotifier(input);
  } catch {
    // Kegagalan push notification tidak boleh membatalkan transaksi presensi.
  }
}

export function buildFineId(sessionId: string, uid: string): string {
  return `${sessionId.trim()}_${uid.trim()}`;
}

export function buildAttendanceDocPath(sessionId: string, uid: string): string {
  return `sessions/${sessionId.trim()}/attendances/${uid.trim()}`;
}

export function normalizeGracePolicy(input?: {
  gracePeriodMinutes?: unknown;
  lateFineAmount?: unknown;
}): FinePolicy {
  const rawGrace = input?.gracePeriodMinutes;
  const rawAmount = input?.lateFineAmount;

  const gracePeriodMinutes =
    typeof rawGrace === 'number' &&
    Number.isFinite(rawGrace) &&
    rawGrace >= 0 &&
    rawGrace <= MAX_GRACE_PERIOD_MINUTES
      ? Math.floor(rawGrace)
      : DEFAULT_GRACE_PERIOD_MINUTES;

  const lateFineAmount =
    typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount >= 0
      ? Math.round(rawAmount)
      : DEFAULT_LATE_FINE_AMOUNT;

  return {
    gracePeriodMinutes,
    lateFineAmount,
  };
}

export function parseTimestampToMs(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : ms;
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const date = (raw as { toDate: () => Date }).toDate();
      const ms = date instanceof Date ? date.getTime() : NaN;
      return Number.isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseScheduledStartMs(
  tanggal?: string,
  jamMulai?: string,
): number | null {
  const cleanTanggal = tanggal?.trim();
  const cleanJam = jamMulai?.trim();
  if (!cleanTanggal || !cleanJam) return null;

  const date = new Date(`${cleanTanggal}T${cleanJam}:00`);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function resolveEffectiveSessionStartMs(session: {
  tanggal?: string;
  jamMulai?: string;
  waktuBuka?: unknown;
  openedAt?: unknown;
}): number | null {
  const scheduledMs = parseScheduledStartMs(session.tanggal, session.jamMulai);
  const openedMs =
    parseTimestampToMs(session.openedAt) ?? parseTimestampToMs(session.waktuBuka);

  if (scheduledMs !== null && openedMs !== null) {
    return Math.max(scheduledMs, openedMs);
  }
  return scheduledMs ?? openedMs;
}

export function evaluateAttendanceLateness(input: {
  session: {
    tanggal?: string;
    jamMulai?: string;
    waktuBuka?: unknown;
    openedAt?: unknown;
    gracePeriodMinutes?: unknown;
    lateFineAmount?: unknown;
  };
  recordedAt: Date | string | number;
}): LateEvaluationResult {
  const policy = normalizeGracePolicy({
    gracePeriodMinutes: input.session.gracePeriodMinutes,
    lateFineAmount: input.session.lateFineAmount,
  });

  const recordedAtMs = parseTimestampToMs(input.recordedAt) ?? Date.now();
  const effectiveStartMs =
    resolveEffectiveSessionStartMs(input.session) ?? recordedAtMs;
  const graceDeadlineMs =
    effectiveStartMs + policy.gracePeriodMinutes * MS_PER_MINUTE;

  const isLate = recordedAtMs > graceDeadlineMs;
  const lateMinutes = isLate
    ? Math.max(1, Math.ceil((recordedAtMs - graceDeadlineMs) / MS_PER_MINUTE))
    : 0;
  const shouldCreateFine = isLate && policy.lateFineAmount > 0;

  return {
    effectiveStartAt: new Date(effectiveStartMs).toISOString(),
    graceDeadlineAt: new Date(graceDeadlineMs).toISOString(),
    gracePeriodMinutes: policy.gracePeriodMinutes,
    lateFineAmount: policy.lateFineAmount,
    lateStatus: isLate ? 'late' : 'on_time',
    lateMinutes,
    shouldCreateFine,
    fineAmount: shouldCreateFine ? policy.lateFineAmount : 0,
  };
}

export function buildFineDocumentPayload(input: {
  sessionId: string;
  uid: string;
  praktikanNama: string;
  praktikanNim?: string;
  courseId?: string;
  labId: string;
  labNama: string;
  sessionTopik: string;
  sessionTanggal: string;
  waktuPresensi: string;
  lateMinutes: number;
  amount: number;
}): Omit<FineRecord, 'createdAt' | 'updatedAt'> {
  const sessionId = input.sessionId.trim();
  const uid = input.uid.trim();
  const fineId = buildFineId(sessionId, uid);

  return {
    id: fineId,
    uid,
    praktikanNama: input.praktikanNama.trim() || 'Praktikan',
    praktikanNim: input.praktikanNim?.trim() || '-',
    courseId: input.courseId?.trim() || 'praktikum-ppk',
    labId: input.labId.trim(),
    labNama: input.labNama.trim() || input.labId.trim(),
    sessionId,
    sessionTopik: input.sessionTopik.trim() || 'Sesi Praktikum',
    sessionTanggal: input.sessionTanggal.trim(),
    attendanceId: buildAttendanceDocPath(sessionId, uid),
    waktuPresensi: input.waktuPresensi,
    lateMinutes: Math.max(1, Math.floor(input.lateMinutes)),
    amount: Math.max(0, Math.round(input.amount)),
    status: 'unpaid',
    latestOrderId: null,
    paidAt: null,
  };
}

export function formatRupiah(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const formatted = String(safeAmount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp${formatted}`;
}

function getActiveFirestore(): Firestore | null {
  try {
    if (getApps().length === 0) return null;
    return getFirestore(getApp());
  } catch {
    return null;
  }
}

/**
 * Membebaskan tagihan denda keterlambatan yang masih `unpaid` menjadi `waived`
 * saat pengajuan izin praktikan pada sesi terkait disetujui (`approved`).
 * Tagihan yang sudah lunas (`paid`) atau sedang diproses tidak diubah.
 */
export async function waiveUnpaidFineInFirestore(
  sessionId: string,
  uid: string,
  dbOverride?: Firestore | null,
): Promise<boolean> {
  const cleanSessionId = sessionId.trim();
  const cleanUid = uid.trim();
  if (!cleanSessionId || !cleanUid) return false;

  const db = dbOverride === undefined ? getActiveFirestore() : dbOverride;
  if (!db) return false;

  const fineRef = doc(db, 'fines', buildFineId(cleanSessionId, cleanUid));
  return runTransaction(db, async (tx) => {
    const fineSnap = await tx.get(fineRef);
    if (!fineSnap.exists()) return false;
    const data = fineSnap.data() as Record<string, unknown>;
    if (data.status !== 'unpaid') return false;

    tx.update(fineRef, {
      status: 'waived',
      updatedAt: serverTimestamp(),
    });
    return true;
  });
}
