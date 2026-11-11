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
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
import type { Pengguna } from '@/types/models';

export type Role = 'praktikan' | 'asisten';

export type ProfilPengguna = {
  uid: string;
  email: string;
  nama: string;
  role: Role;
  nim?: string;
  nip?: string;
  kelasId?: string;
};

const KOLEKSI_USERS = 'users';

function normalisasiProfil(uid: string, data: DocumentData, user: User): ProfilPengguna {
  return {
    uid,
    email: String(data.email ?? user.email ?? ''),
    nama: String(data.nama ?? user.displayName ?? 'Pengguna'),
    // Role tidak pernah dipercaya dari input pengguna saat registrasi;
    // nilai di luar daftar role yang sah dianggap praktikan.
    role: data.role === 'asisten' ? 'asisten' : 'praktikan',
    nim: typeof data.nim === 'string' ? data.nim : undefined,
    nip: typeof data.nip === 'string' ? data.nip : undefined,
    kelasId: typeof data.kelasId === 'string' ? data.kelasId : undefined,
  };
}

export async function daftarPraktikan(input: {
  nama: string;
  email: string;
  password: string;
}): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );

  const nama = input.nama.trim();
  await updateProfile(credential.user, { displayName: nama });

  // Registrasi mandiri selalu menghasilkan role praktikan.
  await setDoc(doc(getFirebaseDb(), KOLEKSI_USERS, credential.user.uid), {
    uid: credential.user.uid,
    email: credential.user.email,
    nama,
    role: 'praktikan' satisfies Role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

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
export async function pastikanProfil(user: User): Promise<ProfilPengguna> {
  const ref = doc(getFirebaseDb(), KOLEKSI_USERS, user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return normalisasiProfil(user.uid, snapshot.data(), user);
  }

  const profil: ProfilPengguna = {
    uid: user.uid,
    email: user.email ?? '',
    nama: user.displayName ?? user.email?.split('@')[0] ?? 'Pengguna',
    role: 'praktikan',
  };

  await setDoc(ref, {
    ...profil,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return profil;
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

// TODO(P2): hapus fallback ini setelah kelas & keanggotaan tersedia di Firestore.
const KELAS_SEMENTARA = 'kelas-a';

export function kePenggunaAplikasi(profil: ProfilPengguna): Pengguna {
  if (profil.role === 'asisten') {
    return {
      id: profil.uid,
      peran: 'asisten',
      nama: profil.nama,
      nip: profil.nip ?? '-',
    };
  }

  return {
    id: profil.uid,
    peran: 'praktikan',
    nama: profil.nama,
    nim: profil.nim ?? '-',
    kelasId: profil.kelasId ?? KELAS_SEMENTARA,
  };
}
