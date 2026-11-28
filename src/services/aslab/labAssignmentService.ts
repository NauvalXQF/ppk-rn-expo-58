import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
import { kirimResetPassword, type ProfilPengguna } from '@/services/authService';
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
  activationEmailFailed?: boolean;
}

export type ProvisionUsersFn = (input: {
  courseId: string;
  labId: string;
  users: ProvisionUserInput[];
}) => Promise<ProvisionUserResult[]>;

const MAX_PROVISION_BATCH_ROWS = 100;
const MAX_PROVISION_BODY_BYTES = 14_000;

function utf8Length(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function chunkProvisionUsers(
  users: ProvisionUserInput[],
  courseId: string,
  labId: string,
): ProvisionUserInput[][] {
  const chunks: ProvisionUserInput[][] = [];
  let current: ProvisionUserInput[] = [];

  for (const user of users) {
    const candidate = [...current, user];
    const byteLength = utf8Length(JSON.stringify({ courseId, labId, users: candidate }));
    if (
      current.length > 0 &&
      (candidate.length > MAX_PROVISION_BATCH_ROWS || byteLength >= MAX_PROVISION_BODY_BYTES)
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
  if (!input.labId.trim() || !input.courseId.trim()) {
    throw new Error('Mata kuliah dan laboratorium tujuan wajib dipilih.');
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('Sesi login tidak aktif. Silakan masuk kembali.');
  }
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_PAYMENT_API_URL?.trim();
  if (!base) {
    throw new Error('Alamat backend belum diatur (EXPO_PUBLIC_API_BASE_URL).');
  }
  const origin = resolvePaymentApiOrigin(base, typeof __DEV__ !== 'undefined' ? __DEV__ : true);
  if (!origin) {
    throw new Error('Gunakan HTTPS atau alamat loopback pada development build.');
  }
  const idToken = await user.getIdToken();
  const allResults: ProvisionUserResult[] = [];
  const seen = new Set<string>();
  const unique = input.users.filter((row) => {
    const email = row.email.trim().toLowerCase();
    const identity = (row.role === 'praktikan' ? row.nim : row.nip)?.trim();
    const identityKey = `${row.role}:${identity}`;
    if (seen.has(email) || (identity && seen.has(identityKey))) {
      allResults.push({ rowId: row.rowId, outcome: 'conflict', code: 'DUPLICATE_ROW' });
      return false;
    }
    seen.add(email);
    if (identity) seen.add(identityKey);
    return true;
  });
  const chunks = chunkProvisionUsers(unique, input.courseId, input.labId);
  let completedChunks = 0;

  for (const [index, chunk] of chunks.entries()) {
    const body = JSON.stringify({ courseId: input.courseId, labId: input.labId, users: chunk });
    if (utf8Length(body) >= MAX_PROVISION_BODY_BYTES) {
      allResults.push(...chunk.map(({ rowId }) => ({ rowId, outcome: 'error' as const, code: 'INVALID_ROW' })));
      continue;
    }
    try {
      const response = await fetch(`${origin}/api/admin/provisioning/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        results?: ProvisionUserResult[];
        error?: { message?: string };
        message?: string;
      };
      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(payload.error?.message || payload.message || 'Gagal memproses provisioning akun di backend.');
      }
      allResults.push(...payload.results);
      completedChunks++;
    } catch (error) {
      if (!completedChunks) throw error;
      allResults.push(...chunks.slice(index).flat().map(({ rowId }) => ({
        rowId, outcome: 'error' as const, code: 'PROVISIONING_RETRY',
      })));
      break;
    }
  }
  const emails = new Map(input.users.map(({ rowId, email }) => [rowId, email]));
  const created = allResults.filter((result) => result.outcome === 'created' && result.uid);
  for (let start = 0; start < created.length; start += 4) {
    await Promise.all(created.slice(start, start + 4).map(async (result) => {
      const email = emails.get(result.rowId);
      if (!email) return;
      try {
        await kirimResetPassword(email);
      } catch {
        result.activationEmailFailed = true;
      }
    }));
  }
  const byRowId = new Map(allResults.map((result) => [result.rowId, result]));
  return input.users.map(({ rowId }) => byRowId.get(rowId) ?? { rowId, outcome: 'error', code: 'PROVISIONING_RETRY' });
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
): Promise<{ successCount: number; errors: string[]; committedRowIds: string[] }> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk laboratorium.');
  }

  const db = getFirebaseDb();
  let batch = writeBatch(db);
  const errors: string[] = [];
  const committedRowIds: string[] = [];
  let pending: BulkRowItem<LabRowData>[] = [];

  async function commitPending() {
    try {
      await batch.commit();
      committedRowIds.push(...pending.map(({ id }) => id));
    } catch {
      const indexes = pending.map(({ index }) => index).join(', ');
      errors.push(`Penyimpanan baris ${indexes} belum terkonfirmasi. Periksa daftar laboratorium sebelum mengulang.`);
      return false;
    }
    batch = writeBatch(db);
    pending = [];
    return true;
  }

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

    pending.push(row);
    // Alokasi aturan Firestore maksimal 20 akses dokumen per batch.
    if (pending.length === 6 && !await commitPending()) break;
  }

  if (errors.length === 0 && pending.length > 0) {
    await commitPending();
  }

  return { successCount: committedRowIds.length, errors, committedRowIds };
}

export async function commitBulkPraktikan(
  actor: ProfilPengguna,
  labId: string,
  acceptedRows: BulkRowItem<PraktikanRowData>[],
  options?: { courseId?: string; provisionUsers?: ProvisionUsersFn },
): Promise<{ successCount: number; errors: string[]; committedRowIds: string[] }> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk praktikan.');
  }

  const validRows = acceptedRows.filter(
    (row) => row.status === 'accepted' && row.isValid,
  );
  if (validRows.length === 0) {
    return { successCount: 0, errors: [], committedRowIds: [] };
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
  const errors: string[] = [];
  const members: { rowId: string; index: number; uid: string; nim: string; nama: string }[] = [];
  const committedRowIds: string[] = [];

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
    members.push({ rowId: row.id, index: row.index, uid, nim, nama: row.data.nama.trim() });
    if (res.activationEmailFailed) {
      errors.push(`Baris ${row.index}: email aktivasi gagal dikirim. Pengguna dapat memakai Lupa password.`);
    }
  }

  // Satu akses profil per anggota, ditambah profil Aslab dan dokumen kelas.
  for (let start = 0; start < members.length; start += 15) {
    const chunk = members.slice(start, start + 15);
    try {
      await runTransaction(db, async (tx) => {
        const refs = chunk.map(({ uid }) => doc(db, 'classMembers', `${labId}_${uid}`));
        const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
        chunk.forEach(({ uid, nim, nama }, index) => {
          tx.set(refs[index], {
            uid, nim, nama,
            classId: labId,
            active: true,
            ...(snapshots[index].exists() ? {} : { createdAt: serverTimestamp() }),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
      });
    } catch {
      errors.push(`Penyimpanan baris ${chunk.map(({ index }) => index).join(', ')} belum terkonfirmasi. Coba lagi.`);
      break;
    }
    committedRowIds.push(...chunk.map(({ rowId }) => rowId));
  }

  return { successCount: committedRowIds.length, errors, committedRowIds };
}

export async function commitBulkAsprak(
  actor: ProfilPengguna,
  labId: string,
  courseId: string,
  acceptedRows: BulkRowItem<AsprakRowData>[],
  options?: { provisionUsers?: ProvisionUsersFn },
): Promise<{ successCount: number; errors: string[]; committedRowIds: string[] }> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang mengeksekusi bulk asprak.');
  }

  const validRows = acceptedRows.filter(
    (row) => row.status === 'accepted' && row.isValid,
  );
  if (validRows.length === 0) {
    return { successCount: 0, errors: [], committedRowIds: [] };
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
  const committedRowIds: string[] = [];
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
    committedRowIds.push(row.id);
    if (res.activationEmailFailed) {
      errors.push(`Baris ${row.index}: email aktivasi gagal dikirim. Pengguna dapat memakai Lupa password.`);
    }
  }

  if (committedRowIds.length > 0) {
    const labRef = doc(db, 'laboratories', labId);
    batch.update(labRef, {
      asprakUids: arrayUnion(...newAsprakUids),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    await batch.commit();
  }

  return { successCount: committedRowIds.length, errors, committedRowIds };
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
  const oldRef = doc(db, 'classMembers', `${fromLabId}_${uid}`);
  const newRef = doc(db, 'classMembers', `${toLabId}_${uid}`);
  await runTransaction(db, async (tx) => {
    const existingDest = await tx.get(newRef);
    tx.update(oldRef, { active: false, updatedAt: serverTimestamp() });
    const fields = {
      nama: member.nama,
      nim: member.nim,
      active: true,
      updatedAt: serverTimestamp(),
    };
    if (existingDest.exists()) tx.update(newRef, fields);
    else tx.set(newRef, { ...fields, classId: toLabId, uid, createdAt: serverTimestamp() });
  });
}

/**
 * Transfers an asprak from lab A to lab B atomically without touching schedules.
 */
export async function transferAsprak(
  actor: ProfilPengguna,
  fromLabId: string,
  toLabId: string,
  asprak: { uid: string; nip: string; nama: string; email?: string; courseId?: string },
  options?: { provisionUsers?: ProvisionUsersFn; targetCourseId?: string },
): Promise<void> {
  if (actor.role !== 'aslab') {
    throw new Error('Hanya Aslab yang berwenang memindahkan asprak.');
  }
  if (fromLabId === toLabId) {
    throw new Error('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
  }
  const targetCourseId = options?.targetCourseId ?? asprak.courseId;
  if (!targetCourseId) throw new Error('Mata kuliah laboratorium tujuan tidak tersedia.');

  let uid = asprak.uid.trim();
  if (asprak.email && options?.provisionUsers) {
    const res = await options.provisionUsers({
      courseId: targetCourseId,
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
    courseId: targetCourseId,
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
  if (!labId.trim() || !courseId.trim()) throw new Error('Pilih laboratorium dalam mata kuliah yang dikelola.');
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
