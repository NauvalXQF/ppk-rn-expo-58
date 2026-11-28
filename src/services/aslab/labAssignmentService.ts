import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
import type { ProfilPengguna } from '@/services/authService';
import { resolvePaymentApiOrigin } from '@/services/payments/paymentData';
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
  id?: string;
  classId: string;
  uid: string;
  nama: string;
  nim: string;
  email?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProvisionUserInput {
  rowId: string;
  role: 'praktikan' | 'asprak';
  email: string;
  nama: string;
  nim?: string;
  nip?: string;
}

export interface ProvisionUserResult {
  rowId: string;
  outcome: 'created' | 'existing' | 'conflict' | 'error';
  uid?: string;
  code?: string;
}

export type ProvisionUsersFn = (input: {
  courseId: string;
  labId: string;
  users: ProvisionUserInput[];
}) => Promise<ProvisionUserResult[]>;

const MAX_PROVISION_BATCH_ROWS = 100;
const MAX_PROVISION_BODY_BYTES = 14_000;

function chunkProvisionUsers(
  users: ProvisionUserInput[],
  courseId: string,
  labId: string,
): ProvisionUserInput[][] {
  const chunks: ProvisionUserInput[][] = [];
  let current: ProvisionUserInput[] = [];

  for (const user of users) {
    const candidate = [...current, user];
    const byteLength = JSON.stringify({ courseId, labId, users: candidate }).length;
    if (
      current.length > 0 &&
      (candidate.length > MAX_PROVISION_BATCH_ROWS || byteLength > MAX_PROVISION_BODY_BYTES)
    ) {
      chunks.push(current);
      current = [user];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

export async function provisionBulkUsersViaBackend(input: {
  courseId: string;
  labId: string;
  users: ProvisionUserInput[];
}): Promise<ProvisionUserResult[]> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('Sesi login tidak aktif. Silakan masuk kembali.');
  }
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
  if (!base) {
    throw new Error('Alamat backend belum diatur (EXPO_PUBLIC_API_BASE_URL).');
  }
  const origin = resolvePaymentApiOrigin(base, typeof __DEV__ !== 'undefined' ? __DEV__ : true);
  if (!origin) {
    throw new Error('Gunakan HTTPS atau alamat loopback pada development build.');
  }
  const idToken = await user.getIdToken();
  const chunks = chunkProvisionUsers(input.users, input.courseId, input.labId);
  const allResults: ProvisionUserResult[] = [];

  for (const chunk of chunks) {
    const response = await fetch(`${origin}/api/admin/provisioning/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        courseId: input.courseId,
        labId: input.labId,
        users: chunk,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      results?: ProvisionUserResult[];
      error?: { message?: string };
      message?: string;
    };
    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(
        payload.error?.message ||
          payload.message ||
          'Gagal memproses provisioning akun di backend.',
      );
    }
    allResults.push(...payload.results);
  }
  return allResults;
}

function parseFiniteOrDefault(raw: unknown, fallback: number): number {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

export async function commitBulkLaboratorium(
  actor: ProfilPengguna,
  courseId: string,
  courseNama: string,
  acceptedRows: BulkRowItem<LabRowData>[],
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab') {
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
      gracePeriodMinutes: parseFiniteOrDefault(data.gracePeriodMinutes, 15),
      lateFineAmount: parseFiniteOrDefault(data.lateFineAmount, 10000),
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
  options?: { courseId?: string; provisionUsers?: ProvisionUsersFn },
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk praktikan.');
  }

  const validRows = acceptedRows.filter(
    (row) => row.status === 'accepted' && row.isValid,
  );
  if (validRows.length === 0) {
    return { successCount: 0, errors: [] };
  }

  const provisionFn = options?.provisionUsers ?? provisionBulkUsersViaBackend;
  const courseId = options?.courseId ?? actor.managedCourseIds?.[0] ?? 'praktikum-ppk';
  const results = await provisionFn({
    courseId,
    labId,
    users: validRows.map((row) => ({
      rowId: row.id,
      role: 'praktikan',
      email: row.data.email.trim().toLowerCase(),
      nama: row.data.nama.trim(),
      nim: row.data.nim.trim(),
    })),
  });

  const resultByRowId = new Map(results.map((r) => [r.rowId, r]));
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const errors: string[] = [];
  let successCount = 0;

  for (const row of validRows) {
    const res = resultByRowId.get(row.id);
    if (!res || (res.outcome !== 'created' && res.outcome !== 'existing') || !res.uid) {
      errors.push(
        `Baris ${row.index} (${row.data.email}): ${res?.code ?? 'PROVISIONING_FAILED'}`,
      );
      continue;
    }

    const uid = res.uid;
    const nim = row.data.nim.trim();
    const memberId = `${labId}_${uid}`;
    const memberRef = doc(db, 'classMembers', memberId);

    const existingMember =
      typeof getDoc === 'function' ? await getDoc(memberRef).catch(() => null) : null;
    if (existingMember?.exists()) {
      batch.update(memberRef, {
        nama: row.data.nama.trim(),
        nim,
        active: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Hanya tulis field yang diizinkan firestore.rules pada match /classMembers/{memberId}
      batch.set(memberRef, {
        classId: labId,
        uid,
        nama: row.data.nama.trim(),
        nim,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

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
  options?: { provisionUsers?: ProvisionUsersFn },
): Promise<{ successCount: number; errors: string[] }> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk asprak.');
  }

  const validRows = acceptedRows.filter(
    (row) => row.status === 'accepted' && row.isValid,
  );
  if (validRows.length === 0) {
    return { successCount: 0, errors: [] };
  }

  const provisionFn = options?.provisionUsers ?? provisionBulkUsersViaBackend;
  const results = await provisionFn({
    courseId,
    labId,
    users: validRows.map((row) => ({
      rowId: row.id,
      role: 'asprak',
      email: row.data.email.trim().toLowerCase(),
      nama: row.data.nama.trim(),
      nip: row.data.nip.trim(),
    })),
  });

  const resultByRowId = new Map(results.map((r) => [r.rowId, r]));
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const errors: string[] = [];
  let successCount = 0;
  const newAsprakUids: string[] = [];

  for (const row of validRows) {
    const res = resultByRowId.get(row.id);
    if (!res || (res.outcome !== 'created' && res.outcome !== 'existing') || !res.uid) {
      errors.push(
        `Baris ${row.index} (${row.data.email}): ${res?.code ?? 'PROVISIONING_FAILED'}`,
      );
      continue;
    }

    const uid = res.uid;
    const nip = row.data.nip.trim();
    const assignmentId = `${labId}_${uid}`;
    const assignRef = doc(db, 'labAssignments', assignmentId);

    batch.set(assignRef, {
      id: assignmentId,
      labId,
      courseId,
      uid,
      nip,
      nama: row.data.nama.trim(),
      email: row.data.email.trim().toLowerCase(),
      active: true,
      assignedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    newAsprakUids.push(uid);
    successCount++;
  }

  if (successCount > 0) {
    const labRef = doc(db, 'laboratories', labId);
    batch.update(labRef, {
      asprakUids: arrayUnion(...newAsprakUids),
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
  options?: { courseId?: string; provisionUsers?: ProvisionUsersFn },
): Promise<void> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang memindahkan praktikan.');
  }
  if (fromLabId === toLabId) {
    throw new Error('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
  }

  let uid = member.uid.trim();
  if (member.email && options?.provisionUsers) {
    const res = await options.provisionUsers({
      courseId: options.courseId ?? actor.managedCourseIds?.[0] ?? 'praktikum-ppk',
      labId: toLabId,
      users: [
        {
          rowId: 'transfer-praktikan',
          role: 'praktikan',
          email: member.email.trim().toLowerCase(),
          nama: member.nama.trim(),
          nim: member.nim.trim(),
        },
      ],
    });
    if (res[0]?.uid) uid = res[0].uid;
  }
  if (!uid) {
    throw new Error('UID praktikan tidak valid untuk pemindahan.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Deaktivasi keanggotaan lama hanya menyentuh ['active', 'updatedAt'] sesuai firestore.rules
  const oldRef = doc(db, 'classMembers', `${fromLabId}_${uid}`);
  batch.update(oldRef, {
    active: false,
    updatedAt: serverTimestamp(),
  });

  const newRef = doc(db, 'classMembers', `${toLabId}_${uid}`);
  const existingDest =
    typeof getDoc === 'function' ? await getDoc(newRef).catch(() => null) : null;
  if (existingDest?.exists()) {
    batch.update(newRef, {
      nama: member.nama,
      nim: member.nim,
      active: true,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(newRef, {
      classId: toLabId,
      uid,
      nama: member.nama,
      nim: member.nim,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

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
  options?: { provisionUsers?: ProvisionUsersFn },
): Promise<void> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang memindahkan asprak.');
  }
  if (fromLabId === toLabId) {
    throw new Error('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
  }

  let uid = asprak.uid.trim();
  if (asprak.email && options?.provisionUsers) {
    const res = await options.provisionUsers({
      courseId: asprak.courseId ?? actor.managedCourseIds?.[0] ?? 'praktikum-ppk',
      labId: toLabId,
      users: [
        {
          rowId: 'transfer-asprak',
          role: 'asprak',
          email: asprak.email.trim().toLowerCase(),
          nama: asprak.nama.trim(),
          nip: asprak.nip.trim(),
        },
      ],
    });
    if (res[0]?.uid) uid = res[0].uid;
  }
  if (!uid) {
    throw new Error('UID asprak tidak valid untuk pemindahan.');
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  const oldAssignRef = doc(db, 'labAssignments', `${fromLabId}_${uid}`);
  batch.update(oldAssignRef, {
    active: false,
    transferredTo: toLabId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const newAssignRef = doc(db, 'labAssignments', `${toLabId}_${uid}`);
  batch.set(newAssignRef, {
    id: `${toLabId}_${uid}`,
    labId: toLabId,
    courseId: asprak.courseId ?? '',
    uid,
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
    asprakUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const newLabRef = doc(db, 'laboratories', toLabId);
  batch.update(newLabRef, {
    asprakUids: arrayUnion(uid),
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
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassMember) }));
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

export interface AvailableAsprak {
  uid: string;
  nama: string;
  email: string;
  nip: string;
  role: string;
}

export async function fetchAvailableAspraks(): Promise<AvailableAsprak[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'users'),
    where('role', 'in', ['asprak', 'asisten']),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        uid: String(data.uid ?? d.id),
        nama: String(data.nama ?? 'Tanpa Nama'),
        email: String(data.email ?? ''),
        nip: String(data.nip ?? data.nim ?? ''),
        role: String(data.role ?? 'asprak'),
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

export async function assignSingleAsprakToLab(
  actor: ProfilPengguna,
  labId: string,
  courseId: string,
  asprak: { uid: string; nama: string; email: string; nip?: string },
): Promise<void> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang menugaskan Asprak ke lab.');
  }
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const assignmentId = `${labId}_${asprak.uid}`;
  const assignRef = doc(db, 'labAssignments', assignmentId);
  const existing = await getDoc(assignRef);

  if (existing.exists()) {
    batch.update(assignRef, {
      nama: asprak.nama.trim(),
      email: asprak.email.trim().toLowerCase(),
      nip: (asprak.nip ?? '').trim(),
      courseId,
      active: true,
      assignedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(assignRef, {
      id: assignmentId,
      labId,
      courseId,
      uid: asprak.uid,
      nip: (asprak.nip ?? '').trim(),
      nama: asprak.nama.trim(),
      email: asprak.email.trim().toLowerCase(),
      active: true,
      assignedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const labRef = doc(db, 'laboratories', labId);
  batch.update(labRef, {
    asprakUids: arrayUnion(asprak.uid),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  await batch.commit();
}

export async function unassignAsprakFromLab(
  actor: ProfilPengguna,
  labId: string,
  asprakUid: string,
): Promise<void> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mencopot Asprak dari lab.');
  }
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const assignRef = doc(db, 'labAssignments', `${labId}_${asprakUid}`);
  batch.update(assignRef, {
    active: false,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  const labRef = doc(db, 'laboratories', labId);
  batch.update(labRef, {
    asprakUids: arrayRemove(asprakUid),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  await batch.commit();
}
