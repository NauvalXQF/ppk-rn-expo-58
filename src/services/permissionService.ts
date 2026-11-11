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

export const MAX_LEAVE_REASON_LENGTH = 500;
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
 * maupun adapter Cloud Firestore setelah setup Firebase P1 tersedia.
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

/**
 * Memetakan dokumen `leaveRequests/{requestId}` menjadi payload aman untuk Firestore
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
 * Normalisasi data dokumen dari Firestore (atau store lain) dengan default aman.
 */
export function fromFirestoreLeaveRequestDoc(
  id: string,
  data: Record<string, unknown>,
): LeaveRequest {
  const aiRaw =
    data.aiClassification && typeof data.aiClassification === 'object'
      ? (data.aiClassification as Record<string, unknown>)
      : {};

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

  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    praktikanName:
      typeof data.praktikanName === 'string' ? data.praktikanName : 'Praktikan',
    praktikanNim:
      typeof data.praktikanNim === 'string' ? data.praktikanNim : undefined,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
    sessionTopic:
      typeof data.sessionTopic === 'string' ? data.sessionTopic : 'Sesi Praktikum',
    classId: typeof data.classId === 'string' ? data.classId : '',
    className: typeof data.className === 'string' ? data.className : '',
    sessionDate: typeof data.sessionDate === 'string' ? data.sessionDate : '',
    reason: typeof data.reason === 'string' ? data.reason : '',
    aiClassification: {
      status: aiStatus,
      category: typeof aiRaw.category === 'string' ? aiRaw.category : null,
      confidence:
        typeof aiRaw.confidence === 'number' ? aiRaw.confidence : null,
      classifiedAt:
        typeof aiRaw.classifiedAt === 'string' ? aiRaw.classifiedAt : null,
      errorMessage:
        typeof aiRaw.errorMessage === 'string' ? aiRaw.errorMessage : null,
    },
    status,
    decidedBy: typeof data.decidedBy === 'string' ? data.decidedBy : null,
    decidedByName:
      typeof data.decidedByName === 'string' ? data.decidedByName : null,
    decidedAt: typeof data.decidedAt === 'string' ? data.decidedAt : null,
    decisionNote:
      typeof data.decisionNote === 'string' ? data.decisionNote : null,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function sortNewestFirst(items: LeaveRequest[]): LeaveRequest[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt) || 0;
    const timeB = Date.parse(b.createdAt) || 0;
    return timeB - timeA;
  });
}

/**
 * Repository reaktif in-memory untuk pengembangan paralel dan unit test.
 * Menjaga kontrak real-time listener (panggilan awal + cleanup unsubscribe).
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
    const sorted = sortNewestFirst(records);
    for (const listener of asistenListeners) {
      listener(sorted.map((item) => ({ ...item, aiClassification: { ...item.aiClassification } })));
    }
    for (const [uid, listeners] of praktikanListeners.entries()) {
      const filtered = sorted
        .filter((item) => item.uid === uid)
        .map((item) => ({ ...item, aiClassification: { ...item.aiClassification } }));
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
        sortNewestFirst(records.filter((item) => item.uid === uid)).map(
          (item) => ({ ...item, aiClassification: { ...item.aiClassification } }),
        ),
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
        sortNewestFirst(records).map((item) => ({
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

  const aiResult = await classifyLeaveReason(
    created.reason,
    options.aiConfig,
  );
  const updatedAt = nowFn().toISOString();

  const updated = await repository.updateAiClassification(
    created.id,
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

