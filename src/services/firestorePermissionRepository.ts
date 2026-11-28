import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { getFirebaseDb, isFirebaseConfigured } from '@/config/firebase';
import type {
  AiClassificationResult,
  LeaveRequest,
} from '@/features/permissions/types';
import {
  buildLeaveRequestId,
  defaultPermissionRepository,
  fromFirestoreLeaveRequestDoc,
  PermissionAuthorizationError,
  PermissionConflictError,
  PermissionValidationError,
  sortLeaveRequestsNewestFirst,
  type LeaveDecisionPatch,
  type PermissionRepository,
} from '@/services/permissionService';

const KOLEKSI_LEAVE_REQUESTS = 'leaveRequests';

function mapFirestorePermissionError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return new PermissionAuthorizationError(
      'Akses ke data izin ditolak oleh Firestore Security Rules.',
    );
  }
  if (code === 'unavailable') {
    return new Error(
      'Layanan Firestore sedang tidak dapat dihubungi. Periksa koneksi internet Anda.',
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('Terjadi kesalahan pada operasi data izin di Firestore.');
}

function serializeAiForFirestore(ai: AiClassificationResult) {
  return {
    status: ai.status,
    category: ai.category,
    confidence: ai.confidence ?? null,
    classifiedAt: ai.classifiedAt,
    errorMessage: ai.errorMessage,
    reportedByClient: ai.reportedByClient ?? true,
    ...(typeof ai.experimental === 'boolean'
      ? { experimental: ai.experimental }
      : {}),
  };
}

/**
 * Implementasi `PermissionRepository` berbasis Cloud Firestore (`leaveRequests/{requestId}`).
 * Mematuhi whitelist field dan aturan peran pada `firestore.rules`.
 */
export const firestorePermissionRepository: PermissionRepository = {
  async createLeaveRequest(payload) {
    try {
      const db = getFirebaseDb();
      const requestId = buildLeaveRequestId(payload.sessionId, payload.uid);
      const docRef = doc(db, KOLEKSI_LEAVE_REQUESTS, requestId);
      const docPayload = {
        uid: payload.uid,
        sessionId: payload.sessionId,
        classId: payload.classId,
        className: payload.className,
        sessionTopic: payload.sessionTopic,
        sessionDate: payload.sessionDate,
        praktikanName: payload.praktikanName,
        ...(payload.praktikanNim ? { praktikanNim: payload.praktikanNim } : {}),
        alasan: payload.reason,
        status: 'pending' as const,
        ai: serializeAiForFirestore(payload.aiClassification),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await runTransaction(db, async (tx) => {
        const existing = await tx.get(docRef);
        if (existing.exists()) {
          throw new PermissionConflictError(
            'Anda sudah mengajukan izin untuk sesi praktikum ini.',
          );
        }
        tx.set(docRef, docPayload);
      });

      return {
        ...payload,
        id: requestId,
        aiClassification: { ...payload.aiClassification },
      };
    } catch (error) {
      throw mapFirestorePermissionError(error);
    }
  },

  async updateAiClassification(requestId, aiClassification, updatedAt) {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, KOLEKSI_LEAVE_REQUESTS, requestId);

      // Hanya menulis field `ai` dan `updatedAt` agar mematuhi `hanyaFieldBerubah(['ai', 'updatedAt'])`.
      await updateDoc(docRef, {
        ai: serializeAiForFirestore(aiClassification),
        updatedAt: serverTimestamp(),
      });

      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return fromFirestoreLeaveRequestDoc(
          snapshot.id,
          snapshot.data() as Record<string, unknown>,
        );
      }

      return fromFirestoreLeaveRequestDoc(requestId, {
        ai: serializeAiForFirestore(aiClassification),
        updatedAt,
      });
    } catch (error) {
      throw mapFirestorePermissionError(error);
    }
  },

  async updateLeaveDecision(requestId: string, patch: LeaveDecisionPatch) {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, KOLEKSI_LEAVE_REQUESTS, requestId);

      // Transaksi memastikan asisten lain tidak menimpa keputusan yang sudah final.
      return await runTransaction(db, async (tx) => {
        const snapshot = await tx.get(docRef);
        if (!snapshot.exists()) {
          throw new PermissionValidationError(
            'Pengajuan izin tidak ditemukan di database.',
          );
        }

        const currentData = snapshot.data() as Record<string, unknown>;
        if (currentData.status !== 'pending') {
          throw new PermissionConflictError(
            'Pengajuan telah diputuskan sebelumnya. Menampilkan keputusan terbaru.',
          );
        }

        // Hanya ubah 5 field yang diizinkan pada `firestore.rules`.
        tx.update(docRef, {
          status: patch.status,
          reviewedBy: patch.decidedBy,
          reviewedAt: serverTimestamp(),
          reviewNote: patch.decisionNote ?? null,
          updatedAt: serverTimestamp(),
        });

        return fromFirestoreLeaveRequestDoc(snapshot.id, {
          ...currentData,
          status: patch.status,
          reviewedBy: patch.decidedBy,
          reviewedAt: patch.decidedAt,
          reviewNote: patch.decisionNote ?? null,
          updatedAt: patch.updatedAt,
        });
      });
    } catch (error) {
      throw mapFirestorePermissionError(error);
    }
  },

  subscribeByPraktikan(uid, onData, onError) {
    try {
      const db = getFirebaseDb();
      const q = query(
        collection(db, KOLEKSI_LEAVE_REQUESTS),
        where('uid', '==', uid),
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const list: LeaveRequest[] = snapshot.docs.map((docSnap) =>
            fromFirestoreLeaveRequestDoc(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          );
          onData(sortLeaveRequestsNewestFirst(list));
        },
        (error) => {
          onError?.(mapFirestorePermissionError(error));
        },
      );
    } catch (error) {
      onError?.(mapFirestorePermissionError(error));
      return () => {};
    }
  },

  subscribeAllForAsisten(onData, onError, options) {
    try {
      const db = getFirebaseDb();
      const colRef = collection(db, KOLEKSI_LEAVE_REQUESTS);

      if (options?.classIds) {
        const allowedClassIds = Array.from(
          new Set(options.classIds.map((id) => id.trim()).filter(Boolean)),
        );
        if (allowedClassIds.length === 0) {
          onData([]);
          return () => {};
        }

        const byClass = new Map<string, LeaveRequest[]>();
        const emitMerged = () => {
          const deduped = new Map<string, LeaveRequest>();
          for (const items of byClass.values()) {
            for (const item of items) {
              deduped.set(item.id, item);
            }
          }
          onData(sortLeaveRequestsNewestFirst(Array.from(deduped.values())));
        };

        const unsubs = allowedClassIds.map((classId) =>
          onSnapshot(
            query(colRef, where('classId', '==', classId)),
            (snapshot) => {
              const list: LeaveRequest[] = snapshot.docs.map((docSnap) =>
                fromFirestoreLeaveRequestDoc(
                  docSnap.id,
                  docSnap.data() as Record<string, unknown>,
                ),
              );
              byClass.set(classId, list);
              emitMerged();
            },
            (error) => {
              onError?.(mapFirestorePermissionError(error));
            },
          ),
        );

        return () => {
          for (const unsub of unsubs) unsub();
        };
      }

      return onSnapshot(
        colRef,
        (snapshot) => {
          const list: LeaveRequest[] = snapshot.docs.map((docSnap) =>
            fromFirestoreLeaveRequestDoc(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          );
          onData(sortLeaveRequestsNewestFirst(list));
        },
        (error) => {
          onError?.(mapFirestorePermissionError(error));
        },
      );
    } catch (error) {
      onError?.(mapFirestorePermissionError(error));
      return () => {};
    }
  },
};

export function getActivePermissionRepository(): PermissionRepository {
  return isFirebaseConfigured
    ? firestorePermissionRepository
    : defaultPermissionRepository;
}

