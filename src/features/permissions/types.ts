export type PermissionUserRole = 'praktikan' | 'asisten';

/**
 * Status keputusan asisten terhadap pengajuan izin (SRS-07 & Kontrak Firestore).
 */
export type LeaveDecisionStatus = 'pending' | 'approved' | 'rejected';

/**
 * Status klasifikasi dari API model AI pengajar (SRS-06 & Penanganan Kegagalan AI).
 */
export type AiClassificationStatus = 'pending' | 'completed' | 'failed';

export interface PermissionActor {
  uid: string;
  role: PermissionUserRole;
  displayName: string;
  nim?: string;
  nip?: string;
  /** Daftar ID kelas yang diikuti praktikan (atau kelas tunggal saat masih 1-to-1). */
  classIds?: string[];
}

export interface LeaveSessionOption {
  id: string;
  classId: string;
  className: string;
  topic: string;
  /** Format YYYY-MM-DD */
  date: string;
  /** Format HH:mm */
  startTime: string;
  /** Format HH:mm */
  endTime: string;
  status: 'dijadwalkan' | 'dibuka' | 'ditutup' | 'open' | 'closed';
}

export interface AiClassificationResult {
  status: AiClassificationStatus;
  /** Kategori hasil klasifikasi dari API AI pengajar; null bila pending/gagal. */
  category: string | null;
  /** Skor keyakinan opsional bila dikembalikan oleh API pengajar (0..1 atau persen). */
  confidence?: number | null;
  /** Timestamp ISO 8601 saat klasifikasi selesai. */
  classifiedAt: string | null;
  /** Pesan error yang ramah pengguna bila API AI gagal/timeout/tidak valid. */
  errorMessage: string | null;
  /** Penanda keamanan bahwa hasil AI berasal dari klien (bukan verifikasi server). */
  reportedByClient?: boolean;
  /** Penanda dari model lokal asisten (`sentiment.js`) bahwa hasil masih bersifat eksperimental. */
  experimental?: boolean;
}

/**
 * Dokumen pengajuan izin pada koleksi `leaveRequests/{requestId}`.
 * Field `aiClassification` dan `status` (keputusan asisten) dipisahkan secara tegas.
 */
export interface LeaveRequest {
  id: string;
  uid: string;
  praktikanName: string;
  praktikanNim?: string;
  sessionId: string;
  sessionTopic: string;
  classId: string;
  className: string;
  sessionDate: string;
  reason: string;
  aiClassification: AiClassificationResult;
  status: LeaveDecisionStatus;
  decidedBy: string | null;
  decidedByName?: string | null;
  decidedAt: string | null;
  decisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitLeaveInput {
  actor: PermissionActor;
  session: LeaveSessionOption;
  reason: string;
}

export interface SubmitLeaveResult {
  request: LeaveRequest;
  /** Diisi jika klasifikasi AI gagal namun pengajuan izin tetap berhasil disimpan. */
  aiWarning: string | null;
}

export interface DecideLeaveInput {
  actor: PermissionActor;
  requestId: string;
  decision: Exclude<LeaveDecisionStatus, 'pending'>;
  decisionNote?: string;
}

export const LEAVE_DECISION_LABEL: Record<LeaveDecisionStatus, string> = {
  pending: 'Menunggu Keputusan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const AI_STATUS_LABEL: Record<AiClassificationStatus, string> = {
  pending: 'Menunggu Klasifikasi AI',
  completed: 'Terklasifikasi AI',
  failed: 'Klasifikasi AI Gagal',
};

