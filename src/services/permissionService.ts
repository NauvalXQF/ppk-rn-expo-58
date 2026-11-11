import type {
  AiClassificationResult,
  DecideLeaveInput,
  LeaveDecisionStatus,
  LeaveRequest,
  LeaveSessionOption,
  PermissionActor,
  SubmitLeaveInput,
  SubmitLeaveResult,
} from '@/features/permissions/types';
import { classifyLeaveReason, type AiServiceConfig } from '@/services/aiService';

/** Batas maksimal panjang alasan izin sesuai `firestore.rules` (1..1000 karakter). */
export const MAX_LEAVE_REASON_LENGTH = 1000;
export const MAX_DECISION_NOTE_LENGTH = 300;

export class PermissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionValidationError';
  }
}

export class PermissionAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionAuthorizationError';
  }
}

export class PermissionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionConflictError';
  }
}

export interface LeaveDecisionPatch {
  status: Exclude<LeaveDecisionStatus, 'pending'>;
  decidedBy: string;
  decidedByName?: string | null;
  decidedAt: string;
  decisionNote?: string | null;
  updatedAt: string;
}

/**
 * Kontrak penyimpanan data izin (`leaveRequests/{requestId}`).
 * Implementasi dapat berupa repository in-memory (pengembangan paralel/test)
 * maupun adapter Cloud Firestore (`firestorePermissionRepository`).
 */
export interface PermissionRepository {
  createLeaveRequest(
    payload: Omit<LeaveRequest, 'id'>,
  ): Promise<LeaveRequest>;
  updateAiClassification(
    requestId: string,
    aiClassification: AiClassificationResult,
    updatedAt: string,
  ): Promise<LeaveRequest>;
  updateLeaveDecision(
    requestId: string,
    patch: LeaveDecisionPatch,
  ): Promise<LeaveRequest>;
  subscribeByPraktikan(
    uid: string,
    onData: (requests: LeaveRequest[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  subscribeAllForAsisten(
    onData: (requests: LeaveRequest[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
}

export interface PermissionServiceOptions {
  repository?: PermissionRepository;
  aiConfig?: AiServiceConfig;
  now?: () => Date;
}

export function validateLeaveReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new PermissionValidationError('Alasan izin tidak boleh kosong.');
  }
  if (trimmed.length > MAX_LEAVE_REASON_LENGTH) {
    throw new PermissionValidationError(
      `Alasan izin maksimal ${MAX_LEAVE_REASON_LENGTH} karakter.`,
    );
  }
  return trimmed;
}

export function validateSessionForPraktikan(
  actor: PermissionActor,
  session: LeaveSessionOption,
): void {
  if (actor.role !== 'praktikan') {
    throw new PermissionAuthorizationError(
      'Hanya praktikan yang dapat mengajukan izin.',
    );
  }
  if (!actor.uid.trim()) {
    throw new PermissionValidationError('Identitas praktikan tidak valid.');
  }
  if (!session.id.trim()) {
    throw new PermissionValidationError('Sesi praktikum wajib dipilih.');
  }
  if (
    actor.classIds &&
    actor.classIds.length > 0 &&
    !actor.classIds.includes(session.classId)
  ) {
    throw new PermissionAuthorizationError(
      'Praktikan hanya dapat mengajukan izin untuk sesi kelasnya sendiri.',
    );
  }
}

export function canActorDecideLeave(actor: PermissionActor | null): boolean {
  return actor?.role === 'asisten' && actor.uid.trim().length > 0;
}

function normalizeTimestampValue(raw: unknown): string | null {
  if (typeof raw === 'string') {
    return raw;
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      const date = (raw as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Memetakan dokumen `leaveRequests/{requestId}` menjadi payload awal
 * dengan pemisahan eksplisit antara field klasifikasi AI dan keputusan asisten.
 */
export function toFirestoreLeaveRequestPayload(
  input: SubmitLeaveInput,
  createdAt: string,
): Omit<LeaveRequest, 'id'> {
  const cleanReason = validateLeaveReason(input.reason);
  validateSessionForPraktikan(input.actor, input.session);

  return {
    uid: input.actor.uid,
    praktikanName: input.actor.displayName,
    praktikanNim: input.actor.nim,
    sessionId: input.session.id,
    sessionTopic: input.session.topic,
    classId: input.session.classId,
    className: input.session.className,
    sessionDate: input.session.date,
    reason: cleanReason,
    aiClassification: {
      status: 'pending',
      category: null,
      confidence: null,
      classifiedAt: null,
      errorMessage: null,
      reportedByClient: true,
    },
    status: 'pending',
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Normalisasi dokumen dari Firestore (`alasan`, `ai`, `reviewedBy`, `reviewedAt`,
 * `reviewNote`, Firestore Timestamp) maupun payload in-memory.
 */
export function fromFirestoreLeaveRequestDoc(
  id: string,
  data: Record<string, unknown>,
): LeaveRequest {
  const aiSource =
    data.ai && typeof data.ai === 'object'
      ? data.ai
      : data.aiClassification && typeof data.aiClassification === 'object'
        ? data.aiClassification
        : {};
  const aiRaw = aiSource as Record<string, unknown>;

  const aiStatus =
    aiRaw.status === 'completed' ||
    aiRaw.status === 'failed' ||
    aiRaw.status === 'pending'
      ? aiRaw.status
      : 'pending';

  const status =
    data.status === 'approved' ||
    data.status === 'rejected' ||
    data.status === 'pending'
      ? data.status
      : 'pending';

  const reason =
    typeof data.alasan === 'string'
      ? data.alasan
      : typeof data.reason === 'string'
        ? data.reason
        : '';

  const decidedBy =
    typeof data.reviewedBy === 'string'
      ? data.reviewedBy
      : typeof data.decidedBy === 'string'
        ? data.decidedBy
        : null;

  const decidedAt =
    normalizeTimestampValue(data.reviewedAt) ??
    normalizeTimestampValue(data.decidedAt);

  const decisionNote =
    typeof data.reviewNote === 'string'
      ? data.reviewNote
      : typeof data.decisionNote === 'string'
        ? data.decisionNote
        : null;

  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    praktikanName:
      typeof data.praktikanName === 'string' ? data.praktikanName : 'Praktikan',
    praktikanNim:
      typeof data.praktikanNim === 'string' ? data.praktikanNim : undefined,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
    sessionTopic:
      typeof data.sessionTopic === 'string'
        ? data.sessionTopic
        : 'Sesi Praktikum',
    classId: typeof data.classId === 'string' ? data.classId : '',
    className: typeof data.className === 'string' ? data.className : '',
    sessionDate: typeof data.sessionDate === 'string' ? data.sessionDate : '',
    reason,
    aiClassification: {
      status: aiStatus,
      category: typeof aiRaw.category === 'string' ? aiRaw.category : null,
      confidence:
        typeof aiRaw.confidence === 'number' ? aiRaw.confidence : null,
      classifiedAt: normalizeTimestampValue(aiRaw.classifiedAt),
      errorMessage:
        typeof aiRaw.errorMessage === 'string' ? aiRaw.errorMessage : null,
      reportedByClient:
        typeof aiRaw.reportedByClient === 'boolean'
          ? aiRaw.reportedByClient
          : true,
      ...(typeof aiRaw.experimental === 'boolean'
        ? { experimental: aiRaw.experimental }
        : {}),
    },
    status,
    decidedBy,
    decidedByName:
      typeof data.decidedByName === 'string' ? data.decidedByName : null,
    decidedAt,
    decisionNote,
    createdAt: normalizeTimestampValue(data.createdAt) ?? '',
    updatedAt: normalizeTimestampValue(data.updatedAt) ?? '',
  };
}

export function sortLeaveRequestsNewestFirst(
  items: LeaveRequest[],
): LeaveRequest[] {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt ? Date.parse(a.createdAt) || 0 : Number.MAX_SAFE_INTEGER;
    const timeB = b.createdAt ? Date.parse(b.createdAt) || 0 : Number.MAX_SAFE_INTEGER;
    return timeB - timeA;
  });
}

/**
 * Repository reaktif in-memory untuk pengembangan paralel (saat Firebase belum dikonfigurasi)
 * dan unit test. Menjaga kontrak real-time listener dan penegakan status final.
 */
export function createInMemoryPermissionRepository(
  seed: LeaveRequest[] = [],
): PermissionRepository {
  let records: LeaveRequest[] = seed.map((item) => ({
    ...item,
    aiClassification: { ...item.aiClassification },
  }));
  let nextSeq = seed.length + 1;

  const praktikanListeners = new Map<
    string,
    Set<(requests: LeaveRequest[]) => void>
  >();
  const asistenListeners = new Set<(requests: LeaveRequest[]) => void>();

  const notifyAll = () => {
    const sorted = sortLeaveRequestsNewestFirst(records);
    for (const listener of asistenListeners) {
      listener(
        sorted.map((item) => ({
          ...item,
          aiClassification: { ...item.aiClassification },
        })),
      );
    }
    for (const [uid, listeners] of praktikanListeners.entries()) {
      const filtered = sorted
        .filter((item) => item.uid === uid)
        .map((item) => ({
          ...item,
          aiClassification: { ...item.aiClassification },
        }));
      for (const listener of listeners) {
        listener(filtered);
      }
    }
  };

  return {
    async createLeaveRequest(payload) {
      const created: LeaveRequest = {
        ...payload,
        id: `leave-${nextSeq++}`,
        aiClassification: { ...payload.aiClassification },
      };
      records = [created, ...records];
      notifyAll();
      return {
        ...created,
        aiClassification: { ...created.aiClassification },
      };
    },

    async updateAiClassification(requestId, aiClassification, updatedAt) {
      const index = records.findIndex((item) => item.id === requestId);
      if (index === -1) {
        throw new PermissionValidationError('Pengajuan izin tidak ditemukan.');
      }
      if (records[index].status !== 'pending') {
        throw new PermissionConflictError(
          'Pengajuan sudah diputuskan sehingga klasifikasi AI tidak diperbarui.',
        );
      }
      const updated: LeaveRequest = {
        ...records[index],
        aiClassification: { ...aiClassification },
        updatedAt,
      };
      records = records.map((item, idx) => (idx === index ? updated : item));
      notifyAll();
      return {
        ...updated,
        aiClassification: { ...updated.aiClassification },
      };
    },

    async updateLeaveDecision(requestId, patch) {
      const index = records.findIndex((item) => item.id === requestId);
      if (index === -1) {
        throw new PermissionValidationError('Pengajuan izin tidak ditemukan.');
      }
      if (records[index].status !== 'pending') {
        throw new PermissionConflictError(
          'Pengajuan telah diputuskan sebelumnya. Menampilkan keputusan terbaru.',
        );
      }
      const updated: LeaveRequest = {
        ...records[index],
        status: patch.status,
        decidedBy: patch.decidedBy,
        decidedByName: patch.decidedByName ?? null,
        decidedAt: patch.decidedAt,
        decisionNote: patch.decisionNote ?? null,
        updatedAt: patch.updatedAt,
      };
      records = records.map((item, idx) => (idx === index ? updated : item));
      notifyAll();
      return {
        ...updated,
        aiClassification: { ...updated.aiClassification },
      };
    },

    subscribeByPraktikan(uid, onData) {
      let bucket = praktikanListeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        praktikanListeners.set(uid, bucket);
      }
      bucket.add(onData);
      onData(
        sortLeaveRequestsNewestFirst(
          records.filter((item) => item.uid === uid),
        ).map((item) => ({
          ...item,
          aiClassification: { ...item.aiClassification },
        })),
      );

      return () => {
        const current = praktikanListeners.get(uid);
        if (!current) return;
        current.delete(onData);
        if (current.size === 0) {
          praktikanListeners.delete(uid);
        }
      };
    },

    subscribeAllForAsisten(onData) {
      asistenListeners.add(onData);
      onData(
        sortLeaveRequestsNewestFirst(records).map((item) => ({
          ...item,
          aiClassification: { ...item.aiClassification },
        })),
      );

      return () => {
        asistenListeners.delete(onData);
      };
    },
  };
}

export const defaultPermissionRepository = createInMemoryPermissionRepository();

/**
 * Mengirim pengajuan izin praktikan, lalu memanggil API klasifikasi AI sebagai informasi pendukung.
 * Keputusan izin SELALU dimulai sebagai `pending` dan tidak pernah diubah otomatis oleh AI.
 */
export async function submitLeaveRequest(
  input: SubmitLeaveInput,
  options: PermissionServiceOptions = {},
): Promise<SubmitLeaveResult> {
  const repository = options.repository ?? defaultPermissionRepository;
  const nowFn = options.now ?? (() => new Date());

  const createdAt = nowFn().toISOString();
  const payload = toFirestoreLeaveRequestPayload(input, createdAt);

  // Simpan pengajuan terlebih dahulu dengan status `pending` agar tidak hilang bila AI gagal.
  const created = await repository.createLeaveRequest(payload);

  const aiResult = {
    ...(await classifyLeaveReason(created.reason, options.aiConfig)),
    reportedByClient: true,
  };
  const updatedAt = nowFn().toISOString();

  try {
    const updated = await repository.updateAiClassification(
      created.id,
      aiResult,
      updatedAt,
    );

    return {
      request: updated,
      aiWarning: aiResult.status === 'failed' ? aiResult.errorMessage : null,
    };
  } catch (error) {
    // Jika asisten sudah memutuskan izin sebelum respons AI tiba,
    // biarkan keputusan asisten tetap final tanpa error palsu.
    if (
      error instanceof PermissionConflictError ||
      error instanceof PermissionAuthorizationError
    ) {
      return {
        request: created,
        aiWarning:
          'Keputusan asisten sudah tercatat sebelum hasil klasifikasi AI selesai.',
      };
    }
    throw error;
  }
}

/**
 * Retry klasifikasi AI secara terkontrol pada pengajuan yang masih `pending`
 * tanpa membuat pengajuan kedua dan tanpa mengubah status keputusan asisten.
 */
export async function retryLeaveAiClassification(
  actor: PermissionActor,
  request: LeaveRequest,
  options: PermissionServiceOptions = {},
): Promise<SubmitLeaveResult> {
  if (actor.role !== 'praktikan' || actor.uid !== request.uid) {
    throw new PermissionAuthorizationError(
      'Hanya pemilik pengajuan yang dapat mengulang klasifikasi AI.',
    );
  }
  if (request.status !== 'pending') {
    throw new PermissionConflictError(
      'Pengajuan sudah diputuskan sehingga klasifikasi AI tidak dapat diulang.',
    );
  }

  const repository = options.repository ?? defaultPermissionRepository;
  const nowFn = options.now ?? (() => new Date());

  const aiResult = {
    ...(await classifyLeaveReason(request.reason, options.aiConfig)),
    reportedByClient: true,
  };
  const updatedAt = nowFn().toISOString();

  const updated = await repository.updateAiClassification(
    request.id,
    aiResult,
    updatedAt,
  );

  return {
    request: updated,
    aiWarning: aiResult.status === 'failed' ? aiResult.errorMessage : null,
  };
}

/**
 * Menyimpan keputusan asisten (`approved` / `rejected`).
 * Praktikan dilarang memanggil operasi keputusan ini (SRS-07 & SRS-08).
 */
export async function decideLeaveRequest(
  input: DecideLeaveInput,
  options: PermissionServiceOptions = {},
): Promise<LeaveRequest> {
  if (!canActorDecideLeave(input.actor)) {
    throw new PermissionAuthorizationError(
      'Hanya asisten yang berwenang mengambil keputusan pengajuan izin.',
    );
  }

  if (input.decision !== 'approved' && input.decision !== 'rejected') {
    throw new PermissionValidationError(
      'Keputusan izin hanya boleh disetujui atau ditolak.',
    );
  }

  const cleanNote = input.decisionNote?.trim() || null;
  if (cleanNote && cleanNote.length > MAX_DECISION_NOTE_LENGTH) {
    throw new PermissionValidationError(
      `Catatan keputusan maksimal ${MAX_DECISION_NOTE_LENGTH} karakter.`,
    );
  }

  const repository = options.repository ?? defaultPermissionRepository;
  const nowFn = options.now ?? (() => new Date());
  const timestamp = nowFn().toISOString();

  return repository.updateLeaveDecision(input.requestId, {
    status: input.decision,
    decidedBy: input.actor.uid,
    decidedByName: input.actor.displayName,
    decidedAt: timestamp,
    decisionNote: cleanNote,
    updatedAt: timestamp,
  });
}

export function subscribePraktikanLeaves(
  actor: PermissionActor,
  onData: (requests: LeaveRequest[]) => void,
  onError?: (error: Error) => void,
  repository: PermissionRepository = defaultPermissionRepository,
): () => void {
  if (actor.role !== 'praktikan' || !actor.uid.trim()) {
    onError?.(
      new PermissionAuthorizationError(
        'Akses riwayat izin hanya tersedia untuk praktikan yang terautentikasi.',
      ),
    );
    return () => {};
  }

  return repository.subscribeByPraktikan(actor.uid, onData, onError);
}

export function subscribeAsistenLeaves(
  actor: PermissionActor,
  onData: (requests: LeaveRequest[]) => void,
  onError?: (error: Error) => void,
  repository: PermissionRepository = defaultPermissionRepository,
): () => void {
  if (!canActorDecideLeave(actor)) {
    onError?.(
      new PermissionAuthorizationError(
        'Daftar pemeriksaan izin hanya dapat diakses oleh asisten.',
      ),
    );
    return () => {};
  }

  return repository.subscribeAllForAsisten(onData, onError);
}
