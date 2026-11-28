export type LateStatus = 'on_time' | 'late';

export type FineStatus = 'unpaid' | 'pending_payment' | 'paid' | 'waived';

export const DEFAULT_GRACE_PERIOD_MINUTES = 15;
export const DEFAULT_LATE_FINE_AMOUNT = 10000;

export interface FinePolicy {
  gracePeriodMinutes: number;
  lateFineAmount: number;
}

export interface LateEvaluationResult {
  effectiveStartAt: string;
  graceDeadlineAt: string;
  gracePeriodMinutes: number;
  lateFineAmount: number;
  lateStatus: LateStatus;
  lateMinutes: number;
  shouldCreateFine: boolean;
  fineAmount: number;
}

export interface FineRecord {
  id: string;
  uid: string;
  praktikanNama: string;
  praktikanNim: string;
  courseId: string;
  classId?: string;
  labId: string;
  labNama: string;
  sessionId: string;
  sessionTopik: string;
  sessionTanggal: string;
  attendanceId: string;
  waktuPresensi: string;
  lateMinutes: number;
  amount: number;
  status: FineStatus;
  latestOrderId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FineCreatedNotificationInput {
  fineId: string;
  uid: string;
  sessionId: string;
  sessionTopik: string;
  labNama: string;
  lateMinutes: number;
  amount: number;
}
