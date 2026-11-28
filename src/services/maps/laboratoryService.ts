import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/config/firebase';
import type { ProfilPengguna } from '@/services/authService';
import type { Laboratory, LaboratoryInput } from '@/types/laboratory';
import { readLaboratory, validateLaboratory } from './laboratories';

export interface LaboratorySnapshot {
  laboratories: Laboratory[];
  documentCount: number;
  fromCache: boolean;
}

export function subscribeLaboratories(
  onChange: (data: LaboratorySnapshot) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(getFirebaseDb(), 'laboratories'),
    { includeMetadataChanges: true },
    (snapshot) => {
      // Keep markers and selection on the last accepted values until Firestore settles the write.
      if (snapshot.metadata.hasPendingWrites) return;
      const laboratories = snapshot.docs.flatMap((item) => {
        const laboratory = readLaboratory(item.id, item.data());
        return laboratory ? [laboratory] : [];
      });
      laboratories.sort((first, second) => first.nama.localeCompare(second.nama, 'id'));
      onChange({ laboratories, documentCount: snapshot.size, fromCache: snapshot.metadata.fromCache });
    },
    onError,
  );
}

function requireAssistant(actor: ProfilPengguna | null): asserts actor is ProfilPengguna {
  if (!actor?.uid || actor.role !== 'aslab') {
    throw new Error('Hanya aslab yang dapat mengelola laboratorium.');
  }
}

export async function syncLaboratoryMetadataToSessions(
  db: Firestore,
  laboratoryId: string,
  metadata: {
    nama: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    gracePeriodMinutes?: number;
    lateFineAmount?: number;
  },
): Promise<number> {
  if (
    typeof getDocs !== 'function' ||
    typeof query !== 'function' ||
    typeof where !== 'function' ||
    typeof writeBatch !== 'function'
  ) {
    return 0;
  }

  const sessionsSnap = await getDocs(
    query(collection(db, 'sessions'), where('labId', '==', laboratoryId)),
  );
  const activeDocs = sessionsSnap.docs.filter((item) => {
    const data = item.data();
    return data.archived !== true && data.closedAt == null;
  });

  if (activeDocs.length === 0) return 0;

  // Setiap update sesi kini membaca scope kelas. Jaga batas akses dokumen pada batch.
  const CHUNK_SIZE = 15;
  let updatedCount = 0;
  for (let i = 0; i < activeDocs.length; i += CHUNK_SIZE) {
    const chunk = activeDocs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const sessionDoc of chunk) {
      const data = sessionDoc.data();
      const patch: Record<string, unknown> = {
        labNama: metadata.nama,
        ruang: metadata.nama,
        labCoordinates: {
          latitude: metadata.latitude,
          longitude: metadata.longitude,
        },
        radiusMeters: metadata.radiusMeters,
        updatedAt: serverTimestamp(),
      };
      if (data.openedAt == null) {
        if (metadata.gracePeriodMinutes !== undefined) {
          patch.gracePeriodMinutes = metadata.gracePeriodMinutes;
        }
        if (metadata.lateFineAmount !== undefined) {
          patch.lateFineAmount = metadata.lateFineAmount;
        }
      }
      batch.update(doc(db, 'sessions', sessionDoc.id), patch);
      updatedCount += 1;
    }
    await batch.commit();
  }

  return updatedCount;
}

export async function saveLaboratory(
  actor: ProfilPengguna | null,
  input: LaboratoryInput,
  laboratoryId?: string,
) {
  requireAssistant(actor);
  const error = validateLaboratory(input);
  if (error) throw new Error(error);

  const { latitude, longitude, radiusMeters, kapasitas } = input;
  const trimmedNama = input.nama.trim();
  const fields: Record<string, unknown> = {
    nama: trimmedNama,
    kode: input.kode.trim(),
    gedung: input.gedung.trim(),
    latitude,
    longitude,
    radiusMeters,
    kapasitas,
    updatedAt: serverTimestamp(),
  };
  if (input.gracePeriodMinutes !== undefined) fields.gracePeriodMinutes = input.gracePeriodMinutes;
  if (input.lateFineAmount !== undefined) fields.lateFineAmount = input.lateFineAmount;
  const courseId = input.courseId ??
    (!laboratoryId && actor.managedCourseIds?.length === 1 ? actor.managedCourseIds[0] : undefined);
  if (courseId) fields.courseId = courseId;
  if (input.courseNama) fields.courseNama = input.courseNama;
  if (actor.role === 'aslab') fields.updatedBy = actor.uid;

  const db = getFirebaseDb();
  const labs = collection(db, 'laboratories');
  if (laboratoryId) {
    await updateDoc(doc(labs, laboratoryId), fields);
    await syncLaboratoryMetadataToSessions(db, laboratoryId, {
      nama: trimmedNama,
      latitude,
      longitude,
      radiusMeters,
      gracePeriodMinutes: input.gracePeriodMinutes,
      lateFineAmount: input.lateFineAmount,
    });
    return;
  }
  if (!courseId) {
    throw new Error('Pilih mata kuliah melalui dashboard Aslab untuk membuat laboratorium.');
  }
  const reference = doc(labs);
  const audit = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(reference, {
    ...fields,
    id: reference.id,
    aktif: true,
    createdBy: actor.uid,
    ...audit,
  });
  batch.set(doc(db, 'classes', reference.id), {
    id: reference.id,
    nama: trimmedNama,
    praktikumId: courseId,
    labId: reference.id,
    aktif: true,
    ...audit,
  });
  await batch.commit();
}

export async function archiveLaboratory(actor: ProfilPengguna | null, laboratoryId: string) {
  requireAssistant(actor);
  const fields: Record<string, unknown> = {
    aktif: false,
    updatedAt: serverTimestamp(),
  };
  if (actor.role === 'aslab') fields.updatedBy = actor.uid;
  await updateDoc(doc(getFirebaseDb(), 'laboratories', laboratoryId), fields);
}
