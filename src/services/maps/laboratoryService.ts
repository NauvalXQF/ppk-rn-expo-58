import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  if (!actor?.uid || actor.role !== 'asisten') {
    throw new Error('Hanya asisten yang dapat mengelola laboratorium.');
  }
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
  const fields = {
    nama: input.nama.trim(),
    kode: input.kode.trim(),
    gedung: input.gedung.trim(),
    latitude,
    longitude,
    radiusMeters,
    kapasitas,
    updatedAt: serverTimestamp(),
  };
  const labs = collection(getFirebaseDb(), 'laboratories');
  if (laboratoryId) {
    await updateDoc(doc(labs, laboratoryId), fields);
    return;
  }
  const reference = doc(labs);
  await setDoc(reference, {
    ...fields,
    id: reference.id,
    aktif: true,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
  });
}

export async function archiveLaboratory(actor: ProfilPengguna | null, laboratoryId: string) {
  requireAssistant(actor);
  await updateDoc(doc(getFirebaseDb(), 'laboratories', laboratoryId), {
    aktif: false,
    updatedAt: serverTimestamp(),
  });
}
