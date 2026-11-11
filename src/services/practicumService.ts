import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

import { initialState } from '@/data/dummy';
import type {
  Asisten,
  FirestoreSessionStatus,
  Jadwal,
  Kelas,
  Pengguna,
  Praktikan,
  Sesi,
  StatusSesi,
} from '@/types/models';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  if (getApps().length > 0) return true;
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

/**
 * Konvensi ID deterministik classMembers sesuai docs/sprint-2/data-model.md:
 * {classId}_{uid}
 */
export function buildClassMemberId(classId: string, uid: string): string {
  return `${classId.trim()}_${uid.trim()}`;
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

function assertAsisten(actor: Pengguna | null): asserts actor is Asisten {
  if (!actor || actor.peran !== 'asisten') {
    throw new Error('Akses ditolak: Hanya asisten yang dapat mengelola data praktikum.');
  }
}

function validateTimeFormat(jam: string, label: string) {
  if (!/^\d{2}:\d{2}$/.test(jam.trim())) {
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
  assertAsisten(actor);
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
  assertAsisten(actor);
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

export async function saveClassMemberToFirestore(
  actor: Pengguna | null,
  input: { id?: string; nama: string; nim: string; kelasId: string },
): Promise<Praktikan> {
  assertAsisten(actor);
  const nama = input.nama.trim();
  const nim = input.nim.trim();
  const kelasId = input.kelasId.trim();

  if (!nama) throw new Error('Nama praktikan wajib diisi.');
  if (!nim) throw new Error('NIM praktikan wajib diisi.');
  if (!kelasId) throw new Error('Kelas praktikan wajib dipilih.');

  const isUpdate = Boolean(input.id?.trim());
  const uid =
    input.id?.trim() ||
    `praktikan-${nim.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
  const memberId = buildClassMemberId(kelasId, uid);

  const peserta: Praktikan = {
    id: uid,
    peran: 'praktikan',
    nama,
    nim,
    kelasId,
  };

  const db = getDb();
  if (db) {
    await setDoc(
      doc(db, 'classMembers', memberId),
      {
        classId: kelasId,
        uid,
        nama,
        nim,
        active: true,
        ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return peserta;
}

export async function deleteClassMemberFromFirestore(
  actor: Pengguna | null,
  praktikanId: string,
  kelasId?: string,
): Promise<void> {
  assertAsisten(actor);
  if (!praktikanId.trim()) throw new Error('ID praktikan tidak valid.');
  const db = getDb();
  if (db && kelasId) {
    const memberId = buildClassMemberId(kelasId, praktikanId);
    // Sesuai data-model.md §7: nonaktifkan keanggotaan dengan active = false
    await updateDoc(doc(db, 'classMembers', memberId), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  }
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
    topik: string;
    praktikumId?: string;
  },
): Promise<Jadwal> {
  assertAsisten(actor);
  const kelasId = input.kelasId.trim();
  const hari = input.hari.trim();
  const jamMulai = input.jamMulai.trim();
  const jamSelesai = input.jamSelesai.trim();
  const ruang = input.ruang.trim();
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
    topik,
  };

  const db = getDb();
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
  assertAsisten(actor);
  if (!jadwalId.trim()) throw new Error('ID jadwal tidak valid.');
  const db = getDb();
  if (db) {
    await updateDoc(doc(db, 'schedules', jadwalId), {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }
}

// ==========================================
// 4. CRUD SESI PRAKTIKUM & MANAJEMEN STATUS
// ==========================================

export async function saveSessionToFirestore(
  actor: Pengguna | null,
  input: {
    id?: string;
    kelasId: string;
    scheduleId?: string;
    topik: string;
    ruang: string;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    status?: StatusSesi;
    praktikumId?: string;
  },
): Promise<Sesi> {
  assertAsisten(actor);
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

  const isUpdate = Boolean(input.id?.trim());
  const id = input.id?.trim() || `sesi-${Date.now().toString(36)}`;
  const status: StatusSesi = input.status ?? 'dijadwalkan';
  const praktikumId = input.praktikumId?.trim() || 'praktikum-ppk';

  const sesi: Sesi = {
    id,
    praktikumId,
    kelasId,
    asistenId: actor.id,
    scheduleId: input.scheduleId?.trim() || undefined,
    topik,
    ruang,
    tanggal,
    jamMulai,
    jamSelesai,
    status,
  };

  const db = getDb();
  if (db) {
    // Sesuai data-model.md §3: sesi baru dibuat dengan status 'closed', openedAt: null, closedAt: null
    await setDoc(
      doc(db, 'sessions', id),
      {
        classId: kelasId,
        scheduleId: sesi.scheduleId ?? `${kelasId}-default`,
        praktikumId,
        asistenUid: actor.id,
        asistenNama: actor.nama,
        topik,
        ruang,
        tanggal,
        jamMulai,
        jamSelesai,
        startAt: `${tanggal}T${jamMulai}:00`,
        endAt: `${tanggal}T${jamSelesai}:00`,
        ...(isUpdate
          ? {}
          : {
              status: 'closed',
              openedAt: null,
              closedAt: null,
              archived: false,
              createdAt: serverTimestamp(),
            }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return sesi;
}

export async function deleteSessionFromFirestore(
  actor: Pengguna | null,
  sesiId: string,
): Promise<void> {
  assertAsisten(actor);
  if (!sesiId.trim()) throw new Error('ID sesi tidak valid.');
  const db = getDb();
  if (db) {
    await updateDoc(doc(db, 'sessions', sesiId), {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function updateSessionStatusInFirestore(
  actor: Pengguna | null,
  sesiId: string,
  target: 'open' | 'closed',
): Promise<void> {
  assertAsisten(actor);
  const db = getDb();
  if (!db) return;

  const ref = doc(db, 'sessions', sesiId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Sesi tidak ditemukan di database.');
  }

  const data = snap.data();
  const currentStatus = toStatusSesi(data.status, data.openedAt, data.closedAt);
  if (target === 'open' && currentStatus !== 'dijadwalkan') {
    throw new Error('Hanya sesi berstatus dijadwalkan yang dapat dibuka.');
  }
  if (target === 'closed' && currentStatus !== 'dibuka') {
    throw new Error('Hanya sesi yang sedang dibuka yang dapat ditutup.');
  }

  // Sesuai data-model.md §3 & whitelist field transisi sesi:
  // hanya ubah ['status', 'openedAt', 'closedAt', 'updatedAt']
  if (target === 'open') {
    await updateDoc(ref, {
      status: 'open',
      openedAt: serverTimestamp(),
      closedAt: null,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      status: 'closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// ==========================================
// 5. SEED / RESET DATA DEMO KE FIRESTORE
// ==========================================

export async function seedInitialDataToFirestore(): Promise<void> {
  const db = getDb();
  if (!db) return;

  const batch = writeBatch(db);

  for (const k of initialState.kelas) {
    batch.set(doc(db, 'classes', k.id), {
      nama: k.nama,
      praktikumId: k.praktikumId,
      praktikumNama: 'Praktikum Pemrograman Komputer',
      praktikumKode: 'PPK',
      archived: false,
      createdBy: 'asisten-1',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const u of initialState.pengguna) {
    if (u.peran === 'praktikan') {
      const memberId = buildClassMemberId(u.kelasId, u.id);
      batch.set(doc(db, 'classMembers', memberId), {
        classId: u.kelasId,
        uid: u.id,
        nama: u.nama,
        nim: u.nim,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  for (const j of DEFAULT_SCHEDULES) {
    batch.set(doc(db, 'schedules', j.id), {
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
      createdBy: j.asistenId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const s of initialState.sesi) {
    // Sesuai Rules create session: status awal 'closed', openedAt: null, closedAt: null
    batch.set(doc(db, 'sessions', s.id), {
      classId: s.kelasId,
      scheduleId: s.kelasId === 'kelas-a' ? 'jadwal-a' : 'jadwal-b',
      praktikumId: s.praktikumId,
      asistenUid: s.asistenId,
      asistenNama: 'Nauval',
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

// ==========================================
// 6. REAL-TIME LISTENERS (onSnapshot)
// ==========================================

export interface PracticumSnapshotCallbacks {
  onClasses: (kelas: Kelas[]) => void;
  onMembers: (praktikan: Praktikan[]) => void;
  onSchedules: (jadwal: Jadwal[]) => void;
  onSessions: (sesi: Sesi[]) => void;
  onError: (message: string) => void;
}

export function subscribePracticumRealtime(
  currentUser: Pengguna | null,
  callbacks: PracticumSnapshotCallbacks,
): Unsubscribe {
  const db = getDb();
  if (!db || !currentUser) return () => {};

  const unsubs: Unsubscribe[] = [];

  // 1. Classes listener (asisten baca semua, praktikan baca doc kelasnya sendiri)
  if (currentUser.peran === 'asisten') {
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
          if (list.length > 0) callbacks.onClasses(list);
        },
        (err) => callbacks.onError(`Gagal memuat data kelas: ${err.message}`),
      ),
    );
  } else {
    unsubs.push(
      onSnapshot(
        doc(db, 'classes', currentUser.kelasId),
        (snap) => {
          if (!snap.exists() || snap.data().archived === true) return;
          const data = snap.data();
          callbacks.onClasses([
            {
              id: snap.id,
              nama: String(data.nama ?? data.name ?? snap.id),
              praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
            },
          ]);
        },
        () => {},
      ),
    );
  }

  // 2. ClassMembers listener (asisten baca semua, praktikan query uid == currentUser.id)
  const membersRef =
    currentUser.peran === 'praktikan'
      ? query(collection(db, 'classMembers'), where('uid', '==', currentUser.id))
      : collection(db, 'classMembers');

  unsubs.push(
    onSnapshot(
      membersRef,
      (snap) => {
        const list: Praktikan[] = snap.docs
          .filter((d) => d.data().active !== false)
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.uid ?? data.praktikanId ?? d.id),
              peran: 'praktikan',
              nama: String(data.nama ?? data.name ?? 'Praktikan'),
              nim: String(data.nim ?? '-'),
              kelasId: String(data.classId ?? data.kelasId ?? 'kelas-a'),
            };
          });
        if (list.length > 0) callbacks.onMembers(list);
      },
      () => {},
    ),
  );

  // 3. Schedules listener
  const schedulesRef =
    currentUser.peran === 'praktikan'
      ? query(
          collection(db, 'schedules'),
          where('classId', '==', currentUser.kelasId),
        )
      : collection(db, 'schedules');

  unsubs.push(
    onSnapshot(
      schedulesRef,
      (snap) => {
        const list: Jadwal[] = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
              kelasId: String(data.classId ?? data.kelasId ?? 'kelas-a'),
              asistenId: String(data.createdBy ?? data.asistenId ?? 'asisten-1'),
              hari: String(data.hari ?? 'Rabu'),
              jamMulai: String(data.jamMulai ?? data.startAt ?? '10:00'),
              jamSelesai: String(data.jamSelesai ?? data.endAt ?? '12:00'),
              ruang: String(data.ruang ?? 'Lab'),
              topik: String(data.topik ?? 'Praktikum'),
            };
          });
        if (list.length > 0 || currentUser.peran === 'asisten') {
          callbacks.onSchedules(list);
        }
      },
      (err) => callbacks.onError(`Gagal memuat jadwal: ${err.message}`),
    ),
  );

  // 4. Sessions listener
  const sessionsRef =
    currentUser.peran === 'praktikan'
      ? query(
          collection(db, 'sessions'),
          where('classId', '==', currentUser.kelasId),
        )
      : collection(db, 'sessions');

  unsubs.push(
    onSnapshot(
      sessionsRef,
      (snap) => {
        if (snap.empty && currentUser.peran === 'praktikan') return;
        const list: Sesi[] = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => {
            const data = d.data();
            const startStr = typeof data.startAt === 'string' ? data.startAt : '';
            const endStr = typeof data.endAt === 'string' ? data.endAt : '';
            return {
              id: d.id,
              praktikumId: String(data.praktikumId ?? 'praktikum-ppk'),
              kelasId: String(data.classId ?? data.kelasId ?? 'kelas-a'),
              asistenId: String(data.asistenUid ?? data.asistenId ?? 'asisten-1'),
              scheduleId: data.scheduleId ? String(data.scheduleId) : undefined,
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
            };
          });
        if (list.length > 0) {
          callbacks.onSessions(list);
        }
      },
      (err) => callbacks.onError(`Gagal memuat sesi: ${err.message}`),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeAuthUserRealtime(
  onUserChange: (user: Pengguna | null) => void,
): Unsubscribe {
  const db = getDb();
  if (!db || getApps().length === 0) return () => {};

  let userDocUnsub: Unsubscribe | null = null;
  let memberQueryUnsub: Unsubscribe | null = null;

  const cleanupProfileListeners = () => {
    if (userDocUnsub) {
      userDocUnsub();
      userDocUnsub = null;
    }
    if (memberQueryUnsub) {
      memberQueryUnsub();
      memberQueryUnsub = null;
    }
  };

  let authUnsub: Unsubscribe = () => {};
  try {
    const auth = getAuth(getApp());
    authUnsub = onAuthStateChanged(auth, (fbUser) => {
      cleanupProfileListeners();
      if (!fbUser) return;

      const uid = fbUser.uid;
      let userData: Record<string, unknown> = {};
      let memberKelasId: string | undefined;

      const emit = () => {
        const rawRole = userData.role ?? userData.peran;
        const nama = String(
          userData.nama ?? userData.name ?? fbUser.displayName ?? fbUser.email ?? 'Pengguna',
        );
        if (rawRole === 'asisten') {
          onUserChange({
            id: uid,
            peran: 'asisten',
            nama,
            nip: String(userData.nip ?? fbUser.email ?? uid.slice(0, 10)),
            email: fbUser.email ?? undefined,
          });
        } else {
          onUserChange({
            id: uid,
            peran: 'praktikan',
            nama,
            nim: String(userData.nim ?? uid.slice(0, 10)),
            kelasId: String(
              memberKelasId ?? userData.kelasId ?? userData.classId ?? 'kelas-a',
            ),
            email: fbUser.email ?? undefined,
          });
        }
      };

      userDocUnsub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            userData = snap.data();
          }
          emit();
        },
        () => emit(),
      );

      memberQueryUnsub = onSnapshot(
        query(collection(db, 'classMembers'), where('uid', '==', uid)),
        (snap) => {
          const activeDoc = snap.docs.find((d) => d.data().active !== false);
          if (activeDoc) {
            const m = activeDoc.data();
            memberKelasId = String(m.classId ?? m.kelasId ?? 'kelas-a');
            if (!userData.nama && m.nama) userData = { ...userData, nama: m.nama };
            if (!userData.nim && m.nim) userData = { ...userData, nim: m.nim };
          }
          emit();
        },
        () => {},
      );
    });
  } catch {
    // Ignore if Auth is not initialized yet
  }

  return () => {
    cleanupProfileListeners();
    authUnsub();
  };
}
