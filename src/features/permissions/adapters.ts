import type { ProfilPengguna } from '@/services/authService';
import type { Kelas, Pengguna, Sesi } from '@/types/models';
import type { LeaveSessionOption, PermissionActor } from './types';

/**
 * Memetakan profil Firebase Auth + Firestore P1 (`ProfilPengguna`)
 * menjadi `PermissionActor` untuk modul pengajuan dan pemeriksaan izin.
 */
export function mapProfilToPermissionActor(
  profil: ProfilPengguna | null,
  kelasIdOverride?: string,
): PermissionActor | null {
  if (!profil) return null;

  if (profil.role === 'praktikan') {
    const resolvedClassId = kelasIdOverride ?? profil.kelasId;
    return {
      uid: profil.uid,
      role: 'praktikan',
      displayName: profil.nama,
      nim: profil.nim,
      classIds: resolvedClassId ? [resolvedClassId] : undefined,
    };
  }

  return {
    uid: profil.uid,
    role: 'asisten',
    displayName: profil.nama,
    nip: profil.nip,
  };
}

/**
 * Adapter helper untuk memetakan `Pengguna` dari `AppContext` (termasuk
 * `kelasId` yang disinkronkan dari koleksi `classMembers` oleh modul P2).
 */
export function mapPenggunaToPermissionActor(
  user: Pengguna | null,
): PermissionActor | null {
  if (!user) return null;

  if (user.peran === 'praktikan') {
    return {
      uid: user.id,
      role: 'praktikan',
      displayName: user.nama,
      nim: user.nim,
      classIds: [user.kelasId],
    };
  }

  return {
    uid: user.id,
    role: 'asisten',
    displayName: user.nama,
    nip: user.nip,
  };
}

/**
 * Adapter helper untuk memetakan daftar sesi & kelas menjadi `LeaveSessionOption[]`.
 */
export function mapSesiToLeaveOptions(
  sesiList: Sesi[],
  kelasList: Kelas[],
): LeaveSessionOption[] {
  const classNames = new Map(kelasList.map((k) => [k.id, k.nama]));

  return sesiList.map((sesi) => ({
    id: sesi.id,
    classId: sesi.kelasId,
    className: classNames.get(sesi.kelasId) ?? sesi.kelasId,
    topic: sesi.topik,
    date: sesi.tanggal,
    startTime: sesi.jamMulai,
    endTime: sesi.jamSelesai,
    status: sesi.status,
  }));
}
