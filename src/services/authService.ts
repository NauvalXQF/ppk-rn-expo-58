import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
import type { Pengguna } from '@/types/models';

export type Role = 'praktikan' | 'asprak' | 'aslab' | 'asisten';

export type ProfilPengguna = {
  uid: string;
  email: string;
  nama: string;
  role: Role;
  nim?: string;
  nip?: string;
  kelasId?: string;
  managedCourseIds?: string[];
  assignedLabIds?: string[];
};

const KOLEKSI_USERS = 'users';

function normalisasiProfil(uid: string, data: DocumentData, user: User): ProfilPengguna {
  const rawRole = data.role;
  let role: Role = 'praktikan';
  if (rawRole === 'aslab') {
    role = 'aslab';
  } else if (rawRole === 'asprak' || rawRole === 'asisten') {
    // Normalisasi role legacy 'asisten' menjadi 'asprak'
    role = 'asprak';
  }

  return {
    uid,
    email: String(data.email ?? user.email ?? ''),
    nama: String(data.nama ?? user.displayName ?? 'Pengguna'),
    role,
    nim: typeof data.nim === 'string' ? data.nim : undefined,
    nip: typeof data.nip === 'string' ? data.nip : undefined,
    kelasId: typeof data.kelasId === 'string' ? data.kelasId : undefined,
    managedCourseIds: Array.isArray(data.managedCourseIds) ? data.managedCourseIds : undefined,
    assignedLabIds: Array.isArray(data.assignedLabIds) ? data.assignedLabIds : undefined,
  };
}

export async function daftarPraktikan(input: {
  nama: string;
  nim?: string;
  email: string;
  password: string;
}): Promise<User> {
  const nama = input.nama.trim();
  if (nama.length < 2) throw new Error('Nama minimal 2 karakter.');
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );

  await updateProfile(credential.user, { displayName: nama });

  await pastikanProfil(credential.user, nama, input.nim?.trim() || undefined);

  return credential.user;
}

export async function masukDenganEmail(input: {
  email: string;
  password: string;
}): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    input.email.trim(),
    input.password,
  );
  return credential.user;
}

export async function keluarDariAplikasi(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/**
 * Memastikan dokumen users/{uid} tersedia. Dokumen lama yang belum punya profil
 * (misalnya dibuat manual dari Firebase Console) akan dilengkapi sebagai praktikan.
 */
export async function pastikanProfil(
  user: User,
  namaRegistrasi?: string,
  nimRegistrasi?: string,
): Promise<ProfilPengguna> {
  const db = getFirebaseDb();
  const ref = doc(db, KOLEKSI_USERS, user.uid);
  // Sesi yang sudah punya profil tetap dapat dipulihkan dari cache Firestore.
  if (namaRegistrasi === undefined && nimRegistrasi === undefined) {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) return normalisasiProfil(user.uid, snapshot.data(), user);
  }

  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      const profil = normalisasiProfil(user.uid, snapshot.data(), user);
      const updates: Record<string, unknown> = {};
      if (namaRegistrasi !== undefined && profil.role === 'praktikan' && profil.nama !== namaRegistrasi) {
        updates.nama = namaRegistrasi;
      }
      if (nimRegistrasi && profil.role === 'praktikan' && !profil.nim) {
        updates.nim = nimRegistrasi;
      }
      if (Object.keys(updates).length > 0) {
        tx.update(ref, { ...updates, updatedAt: serverTimestamp() });
        return {
          ...profil,
          ...(typeof updates.nama === 'string' ? { nama: updates.nama } : {}),
          ...(typeof updates.nim === 'string' ? { nim: updates.nim } : {}),
        };
      }
      return profil;
    }

    const nama = (namaRegistrasi ?? user.displayName ?? user.email?.split('@')[0] ?? '').trim();
    const profil: ProfilPengguna = {
      uid: user.uid,
      email: user.email ?? '',
      nama: nama.length >= 2 ? nama : 'Pengguna',
      role: 'praktikan',
      ...(nimRegistrasi ? { nim: nimRegistrasi } : {}),
    };

    tx.set(ref, {
      ...profil,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profil;
  });
}

export async function updateProfilSaya(
  uid: string,
  input: { nama: string; nim?: string },
): Promise<void> {
  const nama = input.nama.trim();
  if (nama.length < 2) {
    throw new Error('Nama minimal 2 karakter.');
  }
  const db = getFirebaseDb();
  const ref = doc(db, KOLEKSI_USERS, uid);
  const payload: Record<string, unknown> = {
    nama,
    updatedAt: serverTimestamp(),
  };
  if (input.nim !== undefined) {
    payload.nim = input.nim.trim();
  }
  await updateDoc(ref, payload);
}

export function langgananProfil(
  uid: string,
  terima: (profil: ProfilPengguna) => void,
  gagal: (error: Error) => void,
): () => void {
  const ref = doc(getFirebaseDb(), KOLEKSI_USERS, uid);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) return;
      const user = getFirebaseAuth().currentUser;
      if (!user) return;
      terima(normalisasiProfil(uid, snapshot.data(), user));
    },
    gagal,
  );
}

export function pesanErrorAuth(error: unknown): string {
  const code = (error as { code?: string }).code;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Gunakan email lain atau masuk.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Minimal 6 karakter.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau password salah.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa saat.';
    case 'auth/network-request-failed':
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
    case 'auth/operation-not-allowed':
      return 'Metode Email/Password belum diaktifkan di Firebase Console.';
    case 'auth/configuration-not-found':
      return 'Konfigurasi Authentication tidak ditemukan. Periksa Firebase Console.';
    case 'permission-denied':
      return 'Akses Firestore ditolak. Periksa Security Rules.';
    default:
      return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
  }
}

export function isAslab(profil?: ProfilPengguna | Pengguna | null): boolean {
  if (!profil) return false;
  return 'role' in profil ? profil.role === 'aslab' : (profil as Pengguna).peran === 'aslab';
}

export function isAsprak(profil?: ProfilPengguna | Pengguna | null): boolean {
  if (!profil) return false;
  const role = 'role' in profil ? profil.role : (profil as Pengguna).peran;
  return role === 'asprak' || role === 'asisten';
}

export function isPraktikan(profil?: ProfilPengguna | Pengguna | null): boolean {
  if (!profil) return false;
  const role = 'role' in profil ? profil.role : (profil as Pengguna).peran;
  return role === 'praktikan';
}

export function kePenggunaAplikasi(profil: ProfilPengguna): Pengguna {
  if (profil.role === 'aslab') {
    return {
      id: profil.uid,
      peran: 'aslab',
      nama: profil.nama,
      nip: profil.nip ?? '-',
      email: profil.email,
      managedCourseIds: profil.managedCourseIds,
    };
  }

  if (profil.role === 'asprak' || profil.role === 'asisten') {
    return {
      id: profil.uid,
      peran: 'asprak',
      nama: profil.nama,
      nip: profil.nip ?? '-',
      email: profil.email,
      assignedLabIds: profil.assignedLabIds,
    };
  }

  return {
    id: profil.uid,
    peran: 'praktikan',
    nama: profil.nama,
    nim: profil.nim ?? '-',
    kelasId: '',
  };
}
