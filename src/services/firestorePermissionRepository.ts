import {
  addDoc,
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

      const docRef = await addDoc(
        collection(db, KOLEKSI_LEAVE_REQUESTS),
        docPayload,
      );

      return {
        ...payload,
        id: docRef.id,
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

  subscribeAllForAsisten(onData, onError) {
    try {
      const db = getFirebaseDb();
      const colRef = collection(db, KOLEKSI_LEAVE_REQUESTS);

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

