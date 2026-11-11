import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDb, toStatusSesi } from '@/services/practicumService';
import type { Pengguna, Presensi, Sesi } from '@/types/models';

export interface SubmitAttendanceInput {
  sesiId: string;
  praktikanId: string;
  catatan?: string;
  waktuPresensi?: string;
  localSesi?: Sesi | null;
  alreadyAttendedLocally?: boolean;
}

export async function submitAttendanceToFirestore(
  actor: Pengguna | null,
  input: SubmitAttendanceInput,
): Promise<Presensi> {
  if (!actor || actor.peran !== 'praktikan') {
    throw new Error('Akses ditolak: Hanya praktikan yang dapat melakukan presensi.');
  }
  if (actor.id !== input.praktikanId) {
    throw new Error('Identitas praktikan tidak sesuai dengan akun yang sedang login.');
  }
  const sesiId = input.sesiId.trim();
  if (!sesiId) {
    throw new Error('ID sesi tidak valid.');
  }

  const trimmedCatatan = input.catatan?.trim() || undefined;
  if (trimmedCatatan && trimmedCatatan.length > 120) {
    throw new Error('Catatan maksimal 120 karakter.');
  }

  // Validasi lokal cepat sebelum transaksi Firestore
  if (input.localSesi) {
    if (input.localSesi.status !== 'dibuka') {
      throw new Error('Presensi ditolak: Sesi belum dibuka atau sudah ditutup.');
    }
    if (input.localSesi.kelasId !== actor.kelasId) {
      throw new Error('Presensi ditolak: Sesi ini bukan untuk kelas Anda.');
    }
  }
  if (input.alreadyAttendedLocally) {
    throw new Error('Presensi ganda ditolak: Anda sudah tercatat hadir pada sesi ini.');
  }

  const waktuPresensi = input.waktuPresensi ?? new Date().toISOString();
  const record: Presensi = {
    id: `pres-${sesiId}-${actor.id}`,
    sesiId,
    praktikanId: actor.id,
    waktuPresensi,
    catatan: trimmedCatatan,
  };

  const db = getDb();
  if (!db) {
    return record;
  }

  const sessionRef = doc(db, 'sessions', sesiId);
  // Sesuai data-model.md §5: lokasi dokumen tetap sessions/{sessionId}/attendances/{auth.uid}
  const attendanceRef = doc(db, 'sessions', sesiId, 'attendances', actor.id);

  await runTransaction(db, async (tx) => {
    const [sessionSnap, attSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(attendanceRef),
    ]);

    if (!sessionSnap.exists()) {
      throw new Error('Sesi praktikum tidak ditemukan di database.');
    }

    const sessionData = sessionSnap.data();
    const status = toStatusSesi(
      sessionData.status,
      sessionData.openedAt,
      sessionData.closedAt,
    );
    if (status !== 'dibuka') {
      throw new Error('Presensi ditolak: Sesi tidak sedang dibuka.');
    }

    const sessionClassId = String(
      sessionData.classId ?? sessionData.kelasId ?? actor.kelasId,
    );
    if (sessionClassId !== actor.kelasId) {
      throw new Error('Presensi ditolak: Anda tidak terdaftar di kelas sesi ini.');
    }

    if (attSnap.exists()) {
      throw new Error('Presensi ganda ditolak: Anda sudah melakukan presensi pada sesi ini.');
    }

    // Sesuai data-model.md §2: uid, sessionId, classId, status: 'hadir', recordedAt, catatan
    tx.set(attendanceRef, {
      uid: actor.id,
      sessionId: sesiId,
      classId: sessionClassId,
      status: 'hadir',
      recordedAt: serverTimestamp(),
      waktuPresensi,
      catatan: trimmedCatatan ?? null,
    });
  });

  return record;
}

function parseTimestampToIso(rawRecordedAt: unknown, fallbackIso?: unknown): string {
  if (typeof fallbackIso === 'string' && fallbackIso.length > 0) {
    return fallbackIso;
  }
  if (
    rawRecordedAt &&
    typeof rawRecordedAt === 'object' &&
    'toDate' in rawRecordedAt &&
    typeof (rawRecordedAt as { toDate: () => Date }).toDate === 'function'
  ) {
    return (rawRecordedAt as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function subscribeAttendancesRealtime(
  currentUser: Pengguna | null,
  sessionIds: string[],
  onUpdate: (presensi: Presensi[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const db = getDb();
  if (!db || !currentUser || sessionIds.length === 0) return () => {};

  const bySession = new Map<string, Presensi[]>();
  const unsubs: Unsubscribe[] = [];

  const emitAll = () => {
    const all: Presensi[] = [];
    for (const list of bySession.values()) {
      all.push(...list);
    }
    onUpdate(all);
  };

  for (const sesiId of sessionIds) {
    if (currentUser.peran === 'asisten') {
      // Asisten membaca seluruh subcollection attendances sesi tersebut
      const colRef = collection(db, 'sessions', sesiId, 'attendances');
      unsubs.push(
        onSnapshot(
          colRef,
          (snap) => {
            const items: Presensi[] = snap.docs.map((d) => {
              const data = d.data();
              const uid = String(data.uid ?? data.praktikanId ?? d.id);
              return {
                id: `pres-${sesiId}-${uid}`,
                sesiId,
                praktikanId: uid,
                waktuPresensi: parseTimestampToIso(
                  data.recordedAt,
                  data.waktuPresensi,
                ),
                catatan: data.catatan ? String(data.catatan) : undefined,
              };
            });
            bySession.set(sesiId, items);
            emitAll();
          },
          (err) => {
            onError(`Gagal memuat rekap presensi sesi ${sesiId}: ${err.message}`);
          },
        ),
      );
    } else {
      // Sesuai data-model.md §6: praktikan hanya membaca dokumen presensi UID miliknya sendiri
      const ownDocRef = doc(
        db,
        'sessions',
        sesiId,
        'attendances',
        currentUser.id,
      );
      unsubs.push(
        onSnapshot(
          ownDocRef,
          (snap) => {
            if (!snap.exists()) {
              bySession.set(sesiId, []);
            } else {
              const data = snap.data();
              const uid = String(data.uid ?? currentUser.id);
              bySession.set(sesiId, [
                {
                  id: `pres-${sesiId}-${uid}`,
                  sesiId,
                  praktikanId: uid,
                  waktuPresensi: parseTimestampToIso(
                    data.recordedAt,
                    data.waktuPresensi,
                  ),
                  catatan: data.catatan ? String(data.catatan) : undefined,
                },
              ]);
            }
            emitAll();
          },
          (err) => {
            onError(`Gagal memuat status presensi sesi ${sesiId}: ${err.message}`);
          },
        ),
      );
    }
  }

  return () => {
    for (const u of unsubs) u();
  };
}
