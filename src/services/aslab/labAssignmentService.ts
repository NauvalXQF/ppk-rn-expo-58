import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/config/firebase';
import type { ProfilPengguna } from '@/services/authService';
import type { AsprakRowData, BulkRowItem, LabRowData, PraktikanRowData } from './bulkCsvService';

export interface LabAssignment {
  id: string;
  labId: string;
  courseId?: string;
  uid: string;
  nama: string;
  nip: string;
  email: string;
  active: boolean;
  assignedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassMember {
  id: string;
  classId: string;
  uid: string;
  nama: string;
  nim: string;
  email?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function commitBulkLaboratorium(
  actor: ProfilPengguna,
  courseId: string,
  courseNama: string,
  acceptedRows: BulkRowItem<LabRowData>[],
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab' && actor.role !== 'asisten') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk laboratorium.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const errors: string[] = [];
  let successCount = 0;

  for (const row of acceptedRows) {
    if (row.status !== 'accepted' || !row.isValid) continue;

    const { data } = row;
    const labRef = doc(collection(db, 'laboratories'));
    const labId = labRef.id;

    const labDoc = {
      id: labId,
      courseId,
      courseNama,
      nama: data.nama.trim(),
      kode: data.kode.trim(),
      gedung: data.gedung.trim(),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      radiusMeters: Number(data.radiusMeters),
      gracePeriodMinutes: Number(data.gracePeriodMinutes) || 15,
      lateFineAmount: Number(data.lateFineAmount) || 10000,
      kapasitas: Number(data.kapasitas),
      aktif: true,
      asprakUids: [],
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(labRef, labDoc);

    // Synchronize 1-to-1 with classes/{labId} for backwards compatibility
    const classRef = doc(db, 'classes', labId);
    batch.set(classRef, {
      id: labId,
      nama: data.nama.trim(),
      praktikumId: courseId,
      labId,
      aktif: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    successCount++;
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return { successCount, errors };
}

export async function commitBulkPraktikan(
  actor: ProfilPengguna,
  labId: string,
  acceptedRows: BulkRowItem<PraktikanRowData>[],
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab' && actor.role !== 'asisten') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk praktikan.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const errors: string[] = [];
  let successCount = 0;

  for (const row of acceptedRows) {
    if (row.status !== 'accepted' || !row.isValid) continue;

    const { data } = row;
    const nim = data.nim.trim();
    // Unique deterministic ID to prevent duplicates per lab
    const memberId = `${labId}_${nim}`;
    const memberRef = doc(db, 'classMembers', memberId);

    batch.set(memberRef, {
      id: memberId,
      classId: labId,
      uid: nim,
      nim,
      nama: data.nama.trim(),
      email: data.email.trim(),
      active: true,
      assignedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    successCount++;
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return { successCount, errors };
}

export async function commitBulkAsprak(
  actor: ProfilPengguna,
  labId: string,
  courseId: string,
  acceptedRows: BulkRowItem<AsprakRowData>[],
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab' && actor.role !== 'asisten') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk asprak.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const errors: string[] = [];
  let successCount = 0;
  const newAsprakNips: string[] = [];

  for (const row of acceptedRows) {
    if (row.status !== 'accepted' || !row.isValid) continue;

    const { data } = row;
    const nip = data.nip.trim();
    const assignmentId = `${labId}_${nip}`;
    const assignRef = doc(db, 'labAssignments', assignmentId);

    batch.set(assignRef, {
      id: assignmentId,
      labId,
      courseId,
      uid: nip,
      nip,
      nama: data.nama.trim(),
      email: data.email.trim(),
      active: true,
      assignedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    newAsprakNips.push(nip);
    successCount++;
  }

  if (successCount > 0) {
    const labRef = doc(db, 'laboratories', labId);
    batch.update(labRef, {
      asprakUids: arrayUnion(...newAsprakNips),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    await batch.commit();
  }

  return { successCount, errors };
}

/**
 * Transfers a praktikan from lab A to lab B atomically without touching schedules.
 */
export async function transferPraktikan(
  actor: ProfilPengguna,
  fromLabId: string,
  toLabId: string,
  member: { uid: string; nim: string; nama: string; email?: string },
): Promise<void> {
  if (actor.role !== 'aslab' && actor.role !== 'asisten') {
    throw new Error('Hanya Aslab yang berwenang memindahkan praktikan.');
  }
  if (fromLabId === toLabId) {
    throw new Error('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  const oldRef = doc(db, 'classMembers', `${fromLabId}_${member.nim || member.uid}`);
  batch.update(oldRef, {
    active: false,
    transferredTo: toLabId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const newRef = doc(db, 'classMembers', `${toLabId}_${member.nim || member.uid}`);
  batch.set(newRef, {
    id: `${toLabId}_${member.nim || member.uid}`,
    classId: toLabId,
    uid: member.uid,
    nim: member.nim,
    nama: member.nama,
    email: member.email ?? '',
    active: true,
    transferredFrom: fromLabId,
    assignedBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Transfers an asprak from lab A to lab B atomically without touching schedules.
 */
export async function transferAsprak(
  actor: ProfilPengguna,
  fromLabId: string,
  toLabId: string,
  asprak: { uid: string; nip: string; nama: string; email?: string; courseId?: string },
): Promise<void> {
  if (actor.role !== 'aslab' && actor.role !== 'asisten') {
    throw new Error('Hanya Aslab yang berwenang memindahkan asprak.');
  }
  if (fromLabId === toLabId) {
    throw new Error('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  const oldAssignRef = doc(db, 'labAssignments', `${fromLabId}_${asprak.nip || asprak.uid}`);
  batch.update(oldAssignRef, {
    active: false,
    transferredTo: toLabId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const newAssignRef = doc(db, 'labAssignments', `${toLabId}_${asprak.nip || asprak.uid}`);
  batch.set(newAssignRef, {
    id: `${toLabId}_${asprak.nip || asprak.uid}`,
    labId: toLabId,
    courseId: asprak.courseId ?? '',
    uid: asprak.uid,
    nip: asprak.nip,
    nama: asprak.nama,
    email: asprak.email ?? '',
    active: true,
    transferredFrom: fromLabId,
    assignedBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const oldLabRef = doc(db, 'laboratories', fromLabId);
  batch.update(oldLabRef, {
    asprakUids: arrayRemove(asprak.nip || asprak.uid),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const newLabRef = doc(db, 'laboratories', toLabId);
  batch.update(newLabRef, {
    asprakUids: arrayUnion(asprak.nip || asprak.uid),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  await batch.commit();
}

export async function fetchLabMembers(labId: string): Promise<ClassMember[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'classMembers'),
    where('classId', '==', labId),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ClassMember);
}

export async function fetchLabAspraks(labId: string): Promise<LabAssignment[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'labAssignments'),
    where('labId', '==', labId),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LabAssignment);
}
