import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  getFirebaseDb,
  hasConfiguredFirebaseApp,
} from '@/config/firebaseApp';
import { initialState } from '@/data/dummy';
import {
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LATE_FINE_AMOUNT,
} from '@/types/fine';
import { parseTimestampToMs } from '@/services/fines/fineCalculationService';
import {
  canManageClassesAndMembers,
  isStaffUser,
  type Asisten,
  type Aslab,
  type Asprak,
  type FirestoreSessionStatus,
  type Jadwal,
  type Kelas,
  type Pengguna,
  type Praktikan,
  type Sesi,
  type StatusSesi,
} from '@/types/models';

export function isFirebaseConfigured(): boolean {
  return hasConfiguredFirebaseApp();
}

export function getDb(): Firestore | null {
  try {
    return getFirebaseDb();
  } catch {
    return null;
  }
}

/**
 * Konvensi ID deterministik classMembers sesuai docs/sprint-2/data-model.md:
 * {classId}_{uid}
 */
export function buildClassMemberId(classId: string, uid: string): string {
  return `${classId.trim()}_${uid.trim()}`;
}

/**
 * Konvensi ID deterministik labAssignments sesuai docs/sprint-4/data-model.md:
 * {labId}_{uid}
 */
export function buildLabAssignmentId(labId: string, uid: string): string {
  return `${labId.trim()}_${uid.trim()}`;
}

/**
 * Pemetaan status sesi sesuai docs/sprint-2/data-model.md §3:
 * - 'open' -> 'dibuka'
 * - 'closed' dengan openedAt & closedAt terisi -> 'ditutup'
 * - 'closed' dengan openedAt = null & closedAt = null -> 'dijadwalkan'
 */
export function toStatusSesi(
  raw: unknown,
  openedAt?: unknown,
  closedAt?: unknown,
): StatusSesi {
  if (raw === 'open' || raw === 'dibuka') return 'dibuka';
  if (raw === 'ditutup') return 'ditutup';
  if (raw === 'dijadwalkan' || raw === 'scheduled') return 'dijadwalkan';
  if (raw === 'closed') {
    if (openedAt != null || closedAt != null) return 'ditutup';
    // Jika dipanggil tanpa argumen audit (mis. unit test sederhana), kembalikan 'ditutup'
    if (arguments.length === 1) return 'ditutup';
    return 'dijadwalkan';
  }
  return 'dijadwalkan';
}

export function toFirestoreStatus(
  status: StatusSesi | FirestoreSessionStatus,
): FirestoreSessionStatus {
  if (status === 'dibuka' || status === 'open') return 'open';
  if (status === 'ditutup' || status === 'closed') return 'closed';
  return 'scheduled';
}

function assertCanManageClassesAndMembers(
  actor: Pengguna | null,
): asserts actor is Aslab | Asisten {
  if (!actor || actor.peran === 'praktikan') {
    throw new Error(
      'Akses ditolak: Hanya asisten atau Aslab yang dapat mengelola data kelas dan peserta.',
    );
  }
  if (actor.peran === 'asprak') {
    throw new Error(
      'Akses ditolak: Hanya Aslab yang dapat mengelola kelas dan distribusi peserta.',
    );
  }
  if (!canManageClassesAndMembers(actor)) {
    throw new Error(
      'Akses ditolak: Hanya Aslab yang dapat mengelola kelas dan distribusi peserta.',
    );
  }
}

function assertCanManageSessions(
  actor: Pengguna | null,
): asserts actor is Asprak | Aslab | Asisten {
  if (!isStaffUser(actor)) {
    throw new Error(
      'Akses ditolak: Hanya asisten yang dapat mengelola data praktikum.',
    );
  }
}

function assertAsprakLabScopeMemory(actor: Pengguna, kelasId: string) {
  if (actor.peran !== 'asprak') return;
  if (Array.isArray(actor.assignedLabIds) && !actor.assignedLabIds.includes(kelasId)) {
    throw new Error(
      'Akses ditolak: Anda hanya dapat mengelola sesi pada laboratorium/kelas tanggung jawab Anda.',
    );
  }
}

async function assertAsprakAssignedToLab(
  db: Firestore | null,
  actor: Pengguna,
  kelasId: string,
  tx?: {
    get: (ref: ReturnType<typeof doc>) => Promise<{
      exists: () => boolean;
      data: () => Record<string, unknown> | undefined;
    }>;
  },
) {
  if (actor.peran !== 'asprak') return;
  assertAsprakLabScopeMemory(actor, kelasId);
  if (!db) return;

  const assignmentRef = doc(
    db,
    'labAssignments',
    buildLabAssignmentId(kelasId, actor.id),
  );
  const snap = tx ? await tx.get(assignmentRef) : await getDoc(assignmentRef);
  if (!snap.exists() || snap.data()?.active !== true) {
    throw new Error(
      'Akses ditolak: Anda hanya dapat mengelola sesi pada laboratorium/kelas tanggung jawab Anda.',
    );
  }
}

function validateTimeFormat(jam: string, label: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jam.trim())) {
    throw new Error(`${label} harus berformat HH:mm (contoh 10:00).`);
  }
}

function validateDateFormat(tanggal: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal.trim())) {
    throw new Error('Tanggal harus berformat YYYY-MM-DD (contoh 2026-11-11).');
  }
}

export const DEFAULT_SCHEDULES: Jadwal[] = [
  {
    id: 'jadwal-a',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-a',
    asistenId: 'asisten-1',
    hari: 'Rabu',
    jamMulai: '10:00',
    jamSelesai: '12:00',
    ruang: 'Lab 3',
    topik: 'Praktikum PPK Kelas A',
  },
  {
    id: 'jadwal-b',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-b',
    asistenId: 'asisten-1',
    hari: 'Kamis',
    jamMulai: '13:00',
    jamSelesai: '15:00',
    ruang: 'Lab 5',
    topik: 'Praktikum PPK Kelas B',
  },
];

// ========================
// 1. CRUD KELAS PRAKTIKUM
// ========================

export async function saveClassToFirestore(
  actor: Pengguna | null,
  input: { id?: string; nama: string; praktikumId?: string; asistenId?: string },
): Promise<Kelas> {
  assertCanManageClassesAndMembers(actor);
  const nama = input.nama.trim();
  if (!nama) throw new Error('Nama kelas wajib diisi.');

  const isUpdate = Boolean(input.id?.trim());
  const id =
    input.id?.trim() ||
    `kelas-${nama.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const praktikumId = input.praktikumId?.trim() || 'praktikum-ppk';
  const asistenId = input.asistenId?.trim() || actor.id;

  const kelas: Kelas = { id, nama, praktikumId, asistenId };
  const db = getDb();
  if (db) {
    await setDoc(
      doc(db, 'classes', id),
      {
        nama,
        praktikumId,
        praktikumNama: 'Praktikum Pemrograman Komputer',
        praktikumKode: 'PPK',
        archived: false,
        createdBy: actor.id,
        ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return kelas;
}

export async function deleteClassFromFirestore(
  actor: Pengguna | null,
  kelasId: string,
): Promise<void> {
  assertCanManageClassesAndMembers(actor);
  if (!kelasId.trim()) throw new Error('ID kelas tidak valid.');
  const db = getDb();
  if (db) {
    // Sesuai data-model.md §7: gunakan archived = true karena delete fisik ditolak Rules
    await updateDoc(doc(db, 'classes', kelasId), {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }
}

// =======================================
// 2. CRUD PESERTA & KEANGGOTAAN KELAS
// =======================================

function resolvePraktikumId(data?: Record<string, unknown>): string {
  const raw = data?.praktikumId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'praktikum-ppk';
}

export async function saveClassMemberToFirestore(
  actor: Pengguna | null,
  input: { id?: string; nama: string; nim?: string; kelasId: string },
): Promise<Praktikan> {
  assertCanManageClassesAndMembers(actor);
  const nama = input.nama.trim();
  const rawNim = input.nim?.trim() ?? '';
  const nim = rawNim || '-';
  const kelasId = input.kelasId.trim();
  const uid = input.id?.trim();

  if (!nama) throw new Error('Nama praktikan wajib diisi.');
  if (!kelasId) throw new Error('Kelas praktikan wajib dipilih.');
  if (!uid || uid.includes('/')) throw new Error('Pilih akun Firebase praktikan yang terdaftar.');
  const memberId = buildClassMemberId(kelasId, uid);

  const peserta: Praktikan = {
    id: uid,
    peran: 'praktikan',
    nama,
    nim,
    kelasId,
  };

  const db = getDb();
  if (!db) throw new Error('Firebase belum dikonfigurasi untuk mengelola peserta.');

  const targetClassSnap = await getDoc(doc(db, 'classes', kelasId));
  if (!targetClassSnap.exists() || targetClassSnap.data().archived === true) {
    throw new Error('Pilih kelas yang tersedia dan aktif.');
  }
  const targetPraktikumId = resolvePraktikumId(targetClassSnap.data());

  const activeMembershipsSnap = await getDocs(
    query(
      collection(db, 'classMembers'),
      where('uid', '==', uid),
      where('active', '==', true),
    ),
  );
  const otherClassIds = Array.from(
    new Set(
      activeMembershipsSnap.docs
        .map((d) => d.data())
        .filter((data) => data.active === true && typeof data.classId === 'string' && data.classId !== kelasId)
        .map((data) => String(data.classId)),
    ),
  );

  if (otherClassIds.length > 0) {
    const otherClassSnaps = await Promise.all(
      otherClassIds.map((otherId) => getDoc(doc(db, 'classes', otherId))),
    );
    const hasSamePraktikumConflict = otherClassSnaps.some(
      (snap) => snap.exists() && resolvePraktikumId(snap.data()) === targetPraktikumId,
    );
    if (hasSamePraktikumConflict) {
      throw new Error(
        'Praktikan sudah terdaftar di kelas lain pada mata kuliah praktikum ini. Hanya boleh mengambil 1 kelas paralel per praktikum.',
      );
    }
  }

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'classMembers', memberId);
    const [profil, kelas, anggota] = await Promise.all([
      tx.get(doc(db, 'users', uid)),
      tx.get(doc(db, 'classes', kelasId)),
      tx.get(ref),
    ]);
    if (profil.data()?.role !== 'praktikan' || profil.data()?.uid !== uid) {
      throw new Error('UID harus cocok dengan profil akun praktikan terdaftar.');
    }
    if (!kelas.exists() || kelas.data().archived === true) {
      throw new Error('Pilih kelas yang tersedia dan aktif.');
    }
    if (anggota.exists()) {
      const data = anggota.data();
      if (data.uid !== uid || data.classId !== kelasId) {
        throw new Error('Identitas dokumen keanggotaan tidak cocok.');
      }
      tx.update(ref, { nama, nim, active: true, updatedAt: serverTimestamp() });
    } else {
      tx.set(ref, {
        classId: kelasId,
        uid,
        nama,
        nim,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
  return peserta;
}

export async function deleteClassMemberFromFirestore(
  actor: Pengguna | null,
  praktikanId: string,
  kelasId?: string,
): Promise<void> {
  assertCanManageClassesAndMembers(actor);
  const uid = praktikanId.trim();
  if (!uid) throw new Error('ID praktikan tidak valid.');
  const db = getDb();
  if (!db) return;
  if (!kelasId?.trim()) throw new Error('Kelas keanggotaan tidak valid.');

  const ref = doc(db, 'classMembers', buildClassMemberId(kelasId, uid));
  await runTransaction(db, async (tx) => {
    const member = await tx.get(ref);
    if (!member.exists() || member.data().uid !== uid || member.data().classId !== kelasId) {
      throw new Error('Keanggotaan kelas tidak ditemukan.');
    }
    if (member.data().active !== false) {
      tx.update(ref, { active: false, updatedAt: serverTimestamp() });
    }
  });
}

// =========================
// 3. CRUD JADWAL PRAKTIKUM
// =========================

export async function saveScheduleToFirestore(
  actor: Pengguna | null,
  input: {
    id?: string;
    kelasId: string;
    hari: string;
    jamMulai: string;
    jamSelesai: string;
    ruang: string;
    labId?: string;
    topik: string;
    praktikumId?: string;
  },
): Promise<Jadwal> {
  assertCanManageSessions(actor);
  const kelasId = input.kelasId.trim();
  const hari = input.hari.trim();
  const jamMulai = input.jamMulai.trim();
  const jamSelesai = input.jamSelesai.trim();
  const ruang = input.ruang.trim();
  const labId = input.labId?.trim() || undefined;
  const topik = input.topik.trim();

  if (!kelasId) throw new Error('Kelas wajib dipilih.');
  if (!hari) throw new Error('Hari jadwal wajib diisi.');
  if (!ruang) throw new Error('Ruang wajib diisi.');
  if (!topik) throw new Error('Informasi/topik jadwal wajib diisi.');
  validateTimeFormat(jamMulai, 'Jam mulai');
  validateTimeFormat(jamSelesai, 'Jam selesai');
  if (jamMulai >= jamSelesai) {
    throw new Error('Jam mulai harus lebih awal dari jam selesai.');
  }

  const db = getDb();
  await assertAsprakAssignedToLab(db, actor, kelasId);

  const isUpdate = Boolean(input.id?.trim());
  const id = input.id?.trim() || `jadwal-${Date.now().toString(36)}`;
  const praktikumId = input.praktikumId?.trim() || 'praktikum-ppk';
  const jadwal: Jadwal = {
    id,
    praktikumId,
    kelasId,
    asistenId: actor.id,
    hari,
    jamMulai,
    jamSelesai,
    ruang,
    ...(labId ? { labId } : {}),
    topik,
  };

  if (db) {
    await setDoc(
      doc(db, 'schedules', id),
      {
        classId: kelasId,
        praktikumId,
        hari,
        jamMulai,
        jamSelesai,
        startAt: jamMulai,
        endAt: jamSelesai,
        ruang,
        ...(labId ? { labId } : {}),
        topik,
        archived: false,
        createdBy: actor.id,
        ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return jadwal;
}

export async function deleteScheduleFromFirestore(
  actor: Pengguna | null,
  jadwalId: string,
): Promise<void> {
  assertCanManageSessions(actor);
  if (!jadwalId.trim()) throw new Error('ID jadwal tidak valid.');
  const db = getDb();
  if (db) {
    if (actor.peran === 'asprak') {
      const snap = await getDoc(doc(db, 'schedules', jadwalId));
      const classId = snap.exists() ? String(snap.data().classId ?? '') : '';
      if (!classId) {
        throw new Error('Jadwal tidak ditemukan di database.');
      }
      await assertAsprakAssignedToLab(db, actor, classId);
    }
    await updateDoc(doc(db, 'schedules', jadwalId), {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }
}

// ==========================================
// 4. CRUD SESI PRAKTIKUM & MANAJEMEN STATUS
// ==========================================

function extractLabMetadata(input: {
  labId?: string;
  labNama?: string;
  labCoordinates?: { latitude: number; longitude: number };
  radiusMeters?: number;
}) {
  const labId = input.labId?.trim() || undefined;
  const labNama = input.labNama?.trim() || undefined;
  const coords = input.labCoordinates;
  const labCoordinates =
    coords &&
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
      ? { latitude: coords.latitude, longitude: coords.longitude }
      : undefined;
  const radiusMeters =
    typeof input.radiusMeters === 'number' &&
    Number.isFinite(input.radiusMeters) &&
    input.radiusMeters > 0
      ? input.radiusMeters
      : undefined;

  return {
    ...(labId ? { labId } : {}),
    ...(labNama ? { labNama } : {}),
    ...(labCoordinates ? { labCoordinates } : {}),
    ...(radiusMeters !== undefined ? { radiusMeters } : {}),
  };
}

export async function saveSessionToFirestore(
  actor: Pengguna | null,
  input: {
    id?: string;
    kelasId: string;
    scheduleId?: string;
    courseId?: string;
    labId?: string;
    labNama?: string;
    labCoordinates?: { latitude: number; longitude: number };
    radiusMeters?: number;
    gracePeriodMinutes?: number;
    lateFineAmount?: number;
    topik: string;
    ruang: string;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    status?: StatusSesi;
    praktikumId?: string;
  },
): Promise<Sesi> {
  assertCanManageSessions(actor);
  const kelasId = input.kelasId.trim();
  const topik = input.topik.trim();
  const ruang = input.ruang.trim();
  const tanggal = input.tanggal.trim();
  const jamMulai = input.jamMulai.trim();
  const jamSelesai = input.jamSelesai.trim();

  if (!kelasId) throw new Error('Kelas sesi wajib dipilih.');
  if (!topik) throw new Error('Topik sesi wajib diisi.');
  if (!ruang) throw new Error('Ruang sesi wajib diisi.');
  validateDateFormat(tanggal);
  validateTimeFormat(jamMulai, 'Jam mulai');
  validateTimeFormat(jamSelesai, 'Jam selesai');
  if (jamMulai >= jamSelesai) {
    throw new Error('Jam mulai harus lebih awal dari jam selesai.');
  }
  assertAsprakLabScopeMemory(actor, kelasId);

  const db = getDb();
  const existingId = input.id?.trim();
  const id = existingId || `sesi-${db ? doc(collection(db, 'sessions')).id : Date.now().toString(36)}`;
  let scheduleId = input.scheduleId?.trim();
  const praktikumId = input.praktikumId?.trim() || 'praktikum-ppk';
  const labMeta = extractLabMetadata(input);
  const policyMeta = {
    ...(input.courseId?.trim() ? { courseId: input.courseId.trim() } : {}),
    ...(typeof input.gracePeriodMinutes === 'number' &&
    Number.isFinite(input.gracePeriodMinutes)
      ? { gracePeriodMinutes: input.gracePeriodMinutes }
      : {}),
    ...(typeof input.lateFineAmount === 'number' &&
    Number.isFinite(input.lateFineAmount)
      ? { lateFineAmount: input.lateFineAmount }
      : {}),
  };
  const waktu = {
    tanggal,
    jamMulai,
    jamSelesai,
    startAt: `${tanggal}T${jamMulai}:00`,
    endAt: `${tanggal}T${jamSelesai}:00`,
  };

  if (!db) {
    return {
      id,
      praktikumId,
      courseId: policyMeta.courseId ?? praktikumId,
      kelasId,
      asistenId: actor.id,
      scheduleId,
      ...labMeta,
      gracePeriodMinutes:
        policyMeta.gracePeriodMinutes ?? DEFAULT_GRACE_PERIOD_MINUTES,
      lateFineAmount: policyMeta.lateFineAmount ?? DEFAULT_LATE_FINE_AMOUNT,
      topik,
      ruang,
      tanggal,
      jamMulai,
      jamSelesai,
      status: existingId ? (input.status ?? 'dijadwalkan') : 'dijadwalkan',
    };
  }

  const ref = doc(db, 'sessions', id);
  if (existingId) {
    return runTransaction(db, async (tx) => {
      const [snapshot, assignmentSnap] = await Promise.all([
        tx.get(ref),
        actor.peran === 'asprak'
          ? tx.get(
              doc(db, 'labAssignments', buildLabAssignmentId(kelasId, actor.id)),
            )
          : Promise.resolve(null),
      ]);
      if (
        actor.peran === 'asprak' &&
        (!assignmentSnap || !assignmentSnap.exists() || assignmentSnap.data()?.active !== true)
      ) {
        throw new Error(
          'Akses ditolak: Anda hanya dapat mengelola sesi pada laboratorium/kelas tanggung jawab Anda.',
        );
      }
      if (!snapshot.exists()) throw new Error('Sesi tidak ditemukan di database.');
      const data = snapshot.data();
      if (data.archived === true) throw new Error('Sesi yang diarsipkan tidak dapat diedit.');
      const sesi = mapSessionDoc(id, data);
      if (sesi.kelasId !== kelasId || (scheduleId && sesi.scheduleId !== scheduleId)) {
        throw new Error('Kelas dan jadwal pada sesi yang sudah dibuat tidak dapat diubah.');
      }
      const waktuBerubah =
        sesi.tanggal !== tanggal || sesi.jamMulai !== jamMulai || sesi.jamSelesai !== jamSelesai;
      if (waktuBerubah && (data.status !== 'closed' || data.openedAt !== null || data.closedAt !== null)) {
        throw new Error('Tanggal dan jam hanya dapat diubah sebelum sesi pertama kali dibuka.');
      }
      tx.update(ref, {
        topik,
        ruang,
        ...labMeta,
        ...policyMeta,
        ...(waktuBerubah ? waktu : {}),
        updatedAt: serverTimestamp(),
      });
      return {
        ...sesi,
        ...labMeta,
        ...policyMeta,
        topik,
        ruang,
        tanggal,
        jamMulai,
        jamSelesai,
      };
    });
  }

  if (!scheduleId) {
    const schedules = await getDocs(query(collection(db, 'schedules'), where('classId', '==', kelasId)));
    const active = schedules.docs.filter((item) => item.data().archived !== true);
    const effectiveLabId = labMeta.labId ?? (await getDoc(doc(db, 'classes', kelasId))).data()?.labId;
    scheduleId = active.find((item) => effectiveLabId && item.data().labId === effectiveLabId)?.id
      ?? active.find((item) => !item.data().labId)?.id;
    if (!scheduleId && active.length > 0) {
      throw new Error('Pilih laboratorium yang sesuai dengan jadwal aktif kelas.');
    }
  }
  if (!scheduleId) throw new Error('Buat jadwal aktif untuk kelas ini sebelum membuat sesi.');

  const baseData = {
    classId: kelasId,
    scheduleId,
    praktikumId,
    asistenUid: actor.id,
    asistenNama: actor.nama,
    topik,
    ruang,
    ...labMeta,
    ...waktu,
    status: 'closed',
    openedAt: null,
    closedAt: null,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const scheduleRef = doc(db, 'schedules', scheduleId);
  const policyLabId = labMeta.labId ?? kelasId;
  const savedPayload = await runTransaction(db, async (tx) => {
    const [kelas, jadwal, labSnap, assignmentSnap] = await Promise.all([
      tx.get(doc(db, 'classes', kelasId)),
      tx.get(scheduleRef),
      tx.get(doc(db, 'laboratories', policyLabId)),
      actor.peran === 'asprak'
        ? tx.get(
            doc(db, 'labAssignments', buildLabAssignmentId(kelasId, actor.id)),
          )
        : Promise.resolve(null),
    ]);
    if (
      actor.peran === 'asprak' &&
      (!assignmentSnap || !assignmentSnap.exists() || assignmentSnap.data()?.active !== true)
    ) {
      throw new Error(
        'Akses ditolak: Anda hanya dapat mengelola sesi pada laboratorium/kelas tanggung jawab Anda.',
      );
    }
    if (!kelas.exists() || kelas.data().archived === true) {
      throw new Error('Pilih kelas yang tersedia dan aktif.');
    }
    if (!jadwal.exists() || jadwal.data().archived === true || jadwal.data().classId !== kelasId) {
      throw new Error('Jadwal harus aktif dan berasal dari kelas sesi.');
    }
    const scheduleLabId = jadwal.data().labId;
    if (scheduleLabId && scheduleLabId !== (labMeta.labId ?? kelas.data().labId)) {
      throw new Error('Laboratorium sesi harus sesuai dengan jadwal yang dipilih.');
    }
    const labData = labSnap.exists() ? labSnap.data() : undefined;
    const resolvedCourseId =
      policyMeta.courseId ||
      (typeof labData?.courseId === 'string' && labData.courseId.trim()
        ? labData.courseId.trim()
        : undefined) ||
      praktikumId;
    const resolvedGracePeriodMinutes =
      policyMeta.gracePeriodMinutes ??
      (typeof labData?.gracePeriodMinutes === 'number' &&
      Number.isFinite(labData.gracePeriodMinutes)
        ? labData.gracePeriodMinutes
        : DEFAULT_GRACE_PERIOD_MINUTES);
    const resolvedLateFineAmount =
      policyMeta.lateFineAmount ??
      (typeof labData?.lateFineAmount === 'number' &&
      Number.isFinite(labData.lateFineAmount)
        ? labData.lateFineAmount
        : DEFAULT_LATE_FINE_AMOUNT);

    const fullData = {
      ...baseData,
      courseId: resolvedCourseId,
      gracePeriodMinutes: resolvedGracePeriodMinutes,
      lateFineAmount: resolvedLateFineAmount,
    };
    tx.set(ref, fullData);
    return fullData;
  });
  return mapSessionDoc(id, savedPayload);
}

export async function deleteSessionFromFirestore(
  actor: Pengguna | null,
  sesiId: string,
): Promise<void> {
  assertCanManageSessions(actor);
  if (!sesiId.trim()) throw new Error('ID sesi tidak valid.');
  const db = getDb();
  if (db) {
    const ref = doc(db, 'sessions', sesiId.trim());
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error('Sesi tidak ditemukan di database.');
      const data = snapshot.data();
      if (actor.peran === 'asprak') {
        await assertAsprakAssignedToLab(db, actor, String(data.classId ?? ''), tx);
      }
      if (data.archived === true) return;
      const belumDibuka = ['closed', 'scheduled', 'dijadwalkan'].includes(data.status) &&
        data.openedAt === null && data.closedAt === null;
      const sudahDitutup = data.status === 'closed' && data.openedAt != null && data.closedAt != null;
      if (!belumDibuka && !sudahDitutup) {
        throw new Error('Hanya sesi terjadwal atau sesi yang sudah ditutup yang dapat diarsipkan.');
      }
      tx.update(ref, { archived: true, updatedAt: serverTimestamp() });
    });
  }
}

export async function updateSessionStatusInFirestore(
  actor: Pengguna | null,
  sesiId: string,
  target: 'open' | 'closed',
): Promise<void> {
  assertCanManageSessions(actor);
  const db = getDb();
  if (!db) return;

  const ref = doc(db, 'sessions', sesiId);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Sesi tidak ditemukan di database.');
    const data = snapshot.data();
    if (actor.peran === 'asprak') {
      await assertAsprakAssignedToLab(db, actor, String(data.classId ?? ''), tx);
    }
    if (data.archived === true) throw new Error('Sesi sudah diarsipkan.');

    if (target === 'open') {
      if (data.status !== 'closed' || data.openedAt !== null || data.closedAt !== null) {
        throw new Error('Hanya sesi yang belum pernah dibuka yang dapat dibuka.');
      }
      tx.update(ref, { status: 'open', openedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      if (data.status !== 'open' || data.openedAt == null || data.closedAt !== null) {
        throw new Error('Hanya sesi yang sedang dibuka yang dapat ditutup.');
      }
      tx.update(ref, { status: 'closed', closedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  });
}

// ==========================================
// 5. INISIALISASI DATA DEMO FIRESTORE
// ==========================================

export async function seedInitialDataToFirestore(
  actor: Pengguna | null,
  { onlyWhenSessionsEmpty = false } = {},
): Promise<void> {
  assertCanManageClassesAndMembers(actor);
  const db = getDb();
  if (!db) throw new Error('Firebase belum dikonfigurasi untuk inisialisasi data.');

  if (onlyWhenSessionsEmpty) {
    if (actor.peran !== 'aslab' || !actor.managedCourseIds?.includes('praktikum-ppk')) return;
    const course = await getDoc(doc(db, 'courses', 'praktikum-ppk'));
    if (!course.exists() || course.data().aktif !== true) return;
    const existing = await getDocsFromServer(query(collection(db, 'sessions'), limit(1)));
    if (!existing.empty) return;
  }

  await runTransaction(db, async (tx) => {
    const marker = doc(db, 'practicumInitialization', 'demo');
    if ((await tx.get(marker)).exists()) return;

    const read = async <T extends { id: string }>(name: string, fixtures: T[]) =>
      Promise.all(fixtures.map(async (fixture) => {
        const ref = doc(db, name, fixture.id);
        return { fixture, ref, snapshot: await tx.get(ref) };
      }));
    const [classes, schedules, sessions] = await Promise.all([
      read('classes', initialState.kelas),
      read('schedules', DEFAULT_SCHEDULES),
      read('sessions', initialState.sesi),
    ]);
    const audit = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const activeClasses = new Set<string>();
    for (const { fixture: k, ref, snapshot } of classes) {
      if (snapshot.data()?.archived === true) continue;
      activeClasses.add(k.id);
      if (snapshot.exists()) continue;
      tx.set(ref, {
        nama: k.nama,
        praktikumId: k.praktikumId,
        praktikumNama: 'Praktikum Pemrograman Komputer',
        praktikumKode: 'PPK',
        archived: false,
        createdBy: actor.id,
        ...audit,
      });
    }

    const activeScheduleByClass = new Map<string, string>();
    for (const { fixture: j, ref, snapshot } of schedules) {
      if (!activeClasses.has(j.kelasId)) continue;
      const data = snapshot.data();
      if (data && (data.archived === true || data.classId !== j.kelasId)) continue;
      activeScheduleByClass.set(j.kelasId, j.id);
      if (snapshot.exists()) continue;
      tx.set(ref, {
        classId: j.kelasId,
        praktikumId: j.praktikumId,
        hari: j.hari,
        jamMulai: j.jamMulai,
        jamSelesai: j.jamSelesai,
        startAt: j.jamMulai,
        endAt: j.jamSelesai,
        ruang: j.ruang,
        topik: j.topik,
        archived: false,
        createdBy: actor.id,
        ...audit,
      });
    }

    for (const { fixture: s, ref, snapshot } of sessions) {
      const scheduleId = activeScheduleByClass.get(s.kelasId);
      if (snapshot.exists() || !scheduleId) continue;
      tx.set(ref, {
        classId: s.kelasId,
        scheduleId,
        praktikumId: s.praktikumId,
        asistenUid: actor.id,
        asistenNama: actor.nama,
        topik: s.topik,
        ruang: s.ruang,
        tanggal: s.tanggal,
        jamMulai: s.jamMulai,
        jamSelesai: s.jamSelesai,
        startAt: `${s.tanggal}T${s.jamMulai}:00`,
        endAt: `${s.tanggal}T${s.jamSelesai}:00`,
        status: 'closed',
        openedAt: null,
        closedAt: null,
        archived: false,
        ...audit,
      });
    }
    tx.set(marker, { initializedBy: actor.id, initializedAt: serverTimestamp() });
  });
}

// ==========================================
// 6. REAL-TIME LISTENERS (onSnapshot)
// ==========================================

export interface RegisteredPraktikanAccount {
  uid: string;
  nama: string;
  email: string;
  nim?: string;
}

export function subscribeRegisteredPraktikanUsers(
  onUpdate: (accounts: RegisteredPraktikanAccount[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) return () => {};

  const q = query(collection(db, 'users'), where('role', '==', 'praktikan'));
  return onSnapshot(
    q,
    (snap) => {
      const list: RegisteredPraktikanAccount[] = snap.docs
        .filter((d) => d.data().uid === d.id)
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            nama: String(data.nama ?? data.name ?? data.email ?? d.id),
            email: String(data.email ?? '-'),
            nim: typeof data.nim === 'string' && data.nim.trim() ? data.nim.trim() : undefined,
          };
        })
        .sort((a, b) => a.nama.localeCompare(b.nama));
      onUpdate(list);
    },
    (err) => {
      onError?.(`Gagal memuat daftar akun praktikan: ${err.message}`);
    },
  );
}

function mapScheduleDoc(id: string, data: Record<string, unknown>): Jadwal {
  return {
    id,
    praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
    kelasId: String(data.classId ?? data.kelasId ?? 'kelas-a'),
    asistenId: String(data.createdBy ?? data.asistenId ?? 'asisten-1'),
    hari: String(data.hari ?? 'Rabu'),
    jamMulai: String(data.jamMulai ?? data.startAt ?? '10:00'),
    jamSelesai: String(data.jamSelesai ?? data.endAt ?? '12:00'),
    ruang: String(data.ruang ?? 'Lab'),
    ...(typeof data.labId === 'string' && data.labId.trim()
      ? { labId: data.labId.trim() }
      : {}),
    topik: String(data.topik ?? 'Praktikum'),
  };
}

function mapSessionDoc(id: string, data: Record<string, unknown>): Sesi {
  const startStr = typeof data.startAt === 'string' ? data.startAt : '';
  const endStr = typeof data.endAt === 'string' ? data.endAt : '';
  const rawLabCoords =
    data.labCoordinates &&
    typeof data.labCoordinates === 'object' &&
    typeof (data.labCoordinates as { latitude?: unknown }).latitude === 'number' &&
    typeof (data.labCoordinates as { longitude?: unknown }).longitude === 'number'
      ? {
          latitude: Number((data.labCoordinates as { latitude: number }).latitude),
          longitude: Number((data.labCoordinates as { longitude: number }).longitude),
        }
      : undefined;
  const rawRadius =
    typeof data.radiusMeters === 'number' && Number.isFinite(data.radiusMeters)
      ? data.radiusMeters
      : undefined;
  const rawGrace =
    typeof data.gracePeriodMinutes === 'number' &&
    Number.isFinite(data.gracePeriodMinutes)
      ? data.gracePeriodMinutes
      : undefined;
  const rawFineAmount =
    typeof data.lateFineAmount === 'number' &&
    Number.isFinite(data.lateFineAmount)
      ? data.lateFineAmount
      : undefined;
  const openedMs = parseTimestampToMs(data.openedAt);
  const closedMs = parseTimestampToMs(data.closedAt);

  return {
    id,
    praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
    ...(typeof data.courseId === 'string' && data.courseId.trim()
      ? { courseId: data.courseId.trim() }
      : {}),
    kelasId: String(data.classId ?? data.kelasId ?? 'kelas-a'),
    asistenId: String(data.asistenUid ?? data.asistenId ?? 'asisten-1'),
    asistenNama: typeof data.asistenNama === 'string' ? data.asistenNama : undefined,
    scheduleId: data.scheduleId ? String(data.scheduleId) : undefined,
    labId: data.labId ? String(data.labId) : undefined,
    labNama: data.labNama ? String(data.labNama) : undefined,
    labCoordinates: rawLabCoords,
    radiusMeters: rawRadius,
    ...(rawGrace !== undefined ? { gracePeriodMinutes: rawGrace } : {}),
    ...(rawFineAmount !== undefined ? { lateFineAmount: rawFineAmount } : {}),
    topik: String(data.topik ?? 'Sesi Praktikum'),
    ruang: String(data.ruang ?? 'Lab'),
    tanggal: String(
      data.tanggal ??
        (startStr.includes('T')
          ? startStr.slice(0, 10)
          : new Date().toISOString().slice(0, 10)),
    ),
    jamMulai: String(
      data.jamMulai ??
        (startStr.includes('T') ? startStr.slice(11, 16) : '10:00'),
    ),
    jamSelesai: String(
      data.jamSelesai ??
        (endStr.includes('T') ? endStr.slice(11, 16) : '12:00'),
    ),
    status: toStatusSesi(data.status, data.openedAt, data.closedAt),
    ...(openedMs !== null ? { waktuBuka: new Date(openedMs).toISOString() } : {}),
    ...(closedMs !== null ? { waktuTutup: new Date(closedMs).toISOString() } : {}),
  };
}

function mapActiveMembers(docs: QueryDocumentSnapshot[]): Praktikan[] {
  const members: Praktikan[] = [];
  for (const doc of docs) {
    const { uid, classId, active, nama, nim } = doc.data();
    if (
      active !== true || typeof uid !== 'string' || !uid ||
      typeof classId !== 'string' || !classId || doc.id !== buildClassMemberId(classId, uid)
    ) continue;

    members.push({
      id: uid,
      peran: 'praktikan',
      nama: String(nama ?? 'Praktikan'),
      nim: String(nim ?? '-'),
      kelasId: classId,
    });
  }
  return members;
}

/**
 * Menjaga aturan 1 user 1 kelas di sisi klien apabila masih ada residu
 * keanggotaan ganda di Firestore. Pemilihan diurutkan deterministik per kelasId.
 */
function selectCanonicalActiveMembers(members: Praktikan[]): Praktikan[] {
  if (members.length <= 1) return members;
  const sorted = [...members].sort((a, b) => a.kelasId.localeCompare(b.kelasId));
  return [sorted[0]];
}

function mapActiveAssignedLabIds(
  docs: QueryDocumentSnapshot[],
  uid: string,
): string[] {
  const labIds = new Set<string>();
  for (const d of docs) {
    const data = d.data();
    const rawLabId =
      typeof data.labId === 'string' && data.labId.trim()
        ? data.labId.trim()
        : typeof data.classId === 'string' && data.classId.trim()
          ? data.classId.trim()
          : '';
    if (
      data.active === true &&
      data.uid === uid &&
      rawLabId &&
      d.id === buildLabAssignmentId(rawLabId, uid)
    ) {
      labIds.add(rawLabId);
    }
  }
  return Array.from(labIds).sort((a, b) => a.localeCompare(b));
}

export interface PracticumSnapshotCallbacks {
  onClasses: (kelas: Kelas[]) => void;
  onMembers: (praktikan: Praktikan[]) => void;
  onSchedules: (jadwal: Jadwal[]) => void;
  onSessions: (sesi: Sesi[]) => void;
  onAssignedLabs?: (labIds: string[]) => void;
  onError: (message: string) => void;
}

export function subscribePracticumRealtime(
  currentUser: Pengguna | null,
  callbacks: PracticumSnapshotCallbacks,
): Unsubscribe {
  const db = getDb();
  if (!db || !currentUser) return () => {};

  if (currentUser.peran === 'praktikan') {
    const classUnsubs = new Map<string, Unsubscribe[]>();
    const classesById = new Map<string, Kelas | null>();
    const schedulesByClass = new Map<string, Jadwal[]>();
    const sessionsByClass = new Map<string, Sesi[]>();

    const emitClasses = () => {
      const list: Kelas[] = [];
      for (const k of classesById.values()) {
        if (k) list.push(k);
      }
      callbacks.onClasses(list);
    };

    const emitSchedules = () => {
      const list: Jadwal[] = [];
      for (const items of schedulesByClass.values()) {
        list.push(...items);
      }
      callbacks.onSchedules(list);
    };

    const emitSessions = () => {
      const list: Sesi[] = [];
      for (const items of sessionsByClass.values()) {
        list.push(...items);
      }
      callbacks.onSessions(list);
    };

    const cleanupClass = (cid: string) => {
      const list = classUnsubs.get(cid);
      if (list) {
        for (const u of list) u();
        classUnsubs.delete(cid);
      }
      classesById.delete(cid);
      schedulesByClass.delete(cid);
      sessionsByClass.delete(cid);
    };

    const subscribeClass = (cid: string) => {
      if (classUnsubs.has(cid)) return;
      const unsubList: Unsubscribe[] = [];

      unsubList.push(
        onSnapshot(
          doc(db, 'classes', cid),
          (snap) => {
            if (!snap.exists() || snap.data().archived === true) {
              classesById.set(cid, null);
            } else {
              const data = snap.data();
              classesById.set(cid, {
                id: snap.id,
                nama: String(data.nama ?? data.name ?? snap.id),
                praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
              });
            }
            emitClasses();
          },
          () => {},
        ),
      );

      unsubList.push(
        onSnapshot(
          query(collection(db, 'schedules'), where('classId', '==', cid)),
          (snap) => {
            const items = snap.docs
              .filter((d) => d.data().archived !== true)
              .map((d) => mapScheduleDoc(d.id, d.data() as Record<string, unknown>));
            schedulesByClass.set(cid, items);
            emitSchedules();
          },
          (err) => callbacks.onError(`Gagal memuat jadwal: ${err.message}`),
        ),
      );

      unsubList.push(
        onSnapshot(
          query(collection(db, 'sessions'), where('classId', '==', cid)),
          { includeMetadataChanges: true },
          (snap) => {
            if (snap.metadata.hasPendingWrites) return;
            const items = snap.docs
              .filter((d) => d.data().archived !== true)
              .map((d) => mapSessionDoc(d.id, d.data() as Record<string, unknown>));
            sessionsByClass.set(cid, items);
            emitSessions();
          },
          (err) => callbacks.onError(`Gagal memuat sesi: ${err.message}`),
        ),
      );

      classUnsubs.set(cid, unsubList);
    };

    const membersQuery = query(
      collection(db, 'classMembers'),
      where('uid', '==', currentUser.id),
    );
    const unsubMembers = onSnapshot(
      membersQuery,
      (snap) => {
        const activeMembers = selectCanonicalActiveMembers(mapActiveMembers(snap.docs));

        callbacks.onMembers(activeMembers);

        const nextClassIds = activeMembers.length > 0 ? [activeMembers[0].kelasId] : [];
        const nextSet = new Set(nextClassIds);

        let removed = false;
        for (const existingCid of Array.from(classUnsubs.keys())) {
          if (!nextSet.has(existingCid)) {
            cleanupClass(existingCid);
            removed = true;
          }
        }

        if (nextClassIds.length === 0) {
          emitClasses();
          emitSchedules();
          emitSessions();
          return;
        }

        for (const cid of nextClassIds) {
          subscribeClass(cid);
        }
        if (removed) {
          emitClasses();
          emitSchedules();
          emitSessions();
        }
      },
      (err) => callbacks.onError(`Gagal memuat keanggotaan kelas: ${err.message}`),
    );

    return () => {
      unsubMembers();
      for (const cid of Array.from(classUnsubs.keys())) {
        cleanupClass(cid);
      }
    };
  }

  if (currentUser.peran === 'asprak') {
    const labUnsubs = new Map<string, Unsubscribe[]>();
    const classesByLab = new Map<string, Kelas | null>();
    const membersByLab = new Map<string, Praktikan[]>();
    const schedulesByLab = new Map<string, Jadwal[]>();
    const sessionsByLab = new Map<string, Sesi[]>();

    const emitClasses = () => {
      const list: Kelas[] = [];
      for (const k of classesByLab.values()) {
        if (k) list.push(k);
      }
      callbacks.onClasses(list);
    };

    const emitMembers = () => {
      const list: Praktikan[] = [];
      for (const items of membersByLab.values()) {
        list.push(...items);
      }
      callbacks.onMembers(list);
    };

    const emitSchedules = () => {
      const list: Jadwal[] = [];
      for (const items of schedulesByLab.values()) {
        list.push(...items);
      }
      callbacks.onSchedules(list);
    };

    const emitSessions = () => {
      const list: Sesi[] = [];
      for (const items of sessionsByLab.values()) {
        list.push(...items);
      }
      callbacks.onSessions(list);
    };

    const cleanupLab = (labId: string) => {
      const list = labUnsubs.get(labId);
      if (list) {
        for (const u of list) u();
        labUnsubs.delete(labId);
      }
      classesByLab.delete(labId);
      membersByLab.delete(labId);
      schedulesByLab.delete(labId);
      sessionsByLab.delete(labId);
    };

    const subscribeLab = (labId: string) => {
      if (labUnsubs.has(labId)) return;
      const unsubList: Unsubscribe[] = [];

      unsubList.push(
        onSnapshot(
          doc(db, 'classes', labId),
          (snap) => {
            if (!snap.exists() || snap.data().archived === true) {
              classesByLab.set(labId, null);
            } else {
              const data = snap.data();
              classesByLab.set(labId, {
                id: snap.id,
                nama: String(data.nama ?? data.name ?? snap.id),
                praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
                asistenId: data.createdBy ? String(data.createdBy) : undefined,
              });
            }
            emitClasses();
          },
          () => {},
        ),
      );

      unsubList.push(
        onSnapshot(
          query(collection(db, 'classMembers'), where('classId', '==', labId)),
          (snap) => {
            membersByLab.set(labId, mapActiveMembers(snap.docs));
            emitMembers();
          },
          (err) => callbacks.onError(`Gagal memuat peserta lab: ${err.message}`),
        ),
      );

      unsubList.push(
        onSnapshot(
          query(collection(db, 'schedules'), where('classId', '==', labId)),
          (snap) => {
            const items = snap.docs
              .filter((d) => d.data().archived !== true)
              .map((d) => mapScheduleDoc(d.id, d.data() as Record<string, unknown>));
            schedulesByLab.set(labId, items);
            emitSchedules();
          },
          (err) => callbacks.onError(`Gagal memuat jadwal lab: ${err.message}`),
        ),
      );

      unsubList.push(
        onSnapshot(
          query(collection(db, 'sessions'), where('classId', '==', labId)),
          { includeMetadataChanges: true },
          (snap) => {
            if (snap.metadata.hasPendingWrites) return;
            const items = snap.docs
              .filter((d) => d.data().archived !== true)
              .map((d) => mapSessionDoc(d.id, d.data() as Record<string, unknown>));
            sessionsByLab.set(labId, items);
            emitSessions();
          },
          (err) => callbacks.onError(`Gagal memuat sesi lab: ${err.message}`),
        ),
      );

      labUnsubs.set(labId, unsubList);
    };

    const assignmentsQuery = query(
      collection(db, 'labAssignments'),
      where('uid', '==', currentUser.id),
    );
    const unsubAssignments = onSnapshot(
      assignmentsQuery,
      (snap) => {
        const nextLabIds = mapActiveAssignedLabIds(snap.docs, currentUser.id);
        callbacks.onAssignedLabs?.(nextLabIds);
        const nextSet = new Set(nextLabIds);

        let removed = false;
        for (const existingLabId of Array.from(labUnsubs.keys())) {
          if (!nextSet.has(existingLabId)) {
            cleanupLab(existingLabId);
            removed = true;
          }
        }

        if (nextLabIds.length === 0) {
          emitClasses();
          emitMembers();
          emitSchedules();
          emitSessions();
          return;
        }

        for (const labId of nextLabIds) {
          subscribeLab(labId);
        }
        if (removed) {
          emitClasses();
          emitMembers();
          emitSchedules();
          emitSessions();
        }
      },
      (err) => callbacks.onError(`Gagal memuat penugasan laboratorium: ${err.message}`),
    );

    return () => {
      unsubAssignments();
      for (const labId of Array.from(labUnsubs.keys())) {
        cleanupLab(labId);
      }
    };
  }

  const unsubs: Unsubscribe[] = [];

  // 1. Classes listener (asisten baca semua)
  unsubs.push(
    onSnapshot(
      collection(db, 'classes'),
      (snap) => {
        const list: Kelas[] = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              nama: String(data.nama ?? data.name ?? d.id),
              praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
              asistenId: data.createdBy ? String(data.createdBy) : undefined,
            };
          });
        callbacks.onClasses(list);
      },
      (err) => callbacks.onError(`Gagal memuat data kelas: ${err.message}`),
    ),
  );

  // 2. ClassMembers listener (asisten baca semua)
  unsubs.push(
    onSnapshot(
      collection(db, 'classMembers'),
      (snap) => callbacks.onMembers(mapActiveMembers(snap.docs)),
      (err) => callbacks.onError(`Gagal memuat keanggotaan kelas: ${err.message}`),
    ),
  );

  // 3. Schedules listener (asisten baca semua)
  unsubs.push(
    onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        const list: Jadwal[] = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => mapScheduleDoc(d.id, d.data() as Record<string, unknown>));
        callbacks.onSchedules(list);
      },
      (err) => callbacks.onError(`Gagal memuat jadwal: ${err.message}`),
    ),
  );

  // 4. Sessions listener (asisten baca semua)
  unsubs.push(
    onSnapshot(
      collection(db, 'sessions'),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;
        const list: Sesi[] = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => mapSessionDoc(d.id, d.data() as Record<string, unknown>));
        callbacks.onSessions(list);
      },
      (err) => callbacks.onError(`Gagal memuat sesi: ${err.message}`),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}
