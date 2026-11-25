import type { ProfilPengguna } from '@/services/authService';
import { getPraktikanClassIds } from '@/store/selectors';
import type { Kelas, Pengguna, Sesi } from '@/types/models';
import type { LeaveSessionOption, PermissionActor } from './types';

/**
 * Memetakan profil Firebase Auth + Firestore P1 (`ProfilPengguna`)
 * menjadi `PermissionActor` untuk modul pengajuan dan pemeriksaan izin.
 */
export function mapProfilToPermissionActor(
  profil: ProfilPengguna | null,
  kelasOrLabIdsOverride?: string | string[],
): PermissionActor | null {
  if (!profil) return null;

  const rawRole = profil.role as string;
  if (rawRole === 'praktikan') {
    let classIds: string[] | undefined;
    if (Array.isArray(kelasOrLabIdsOverride)) {
      classIds =
        kelasOrLabIdsOverride.length > 0 ? kelasOrLabIdsOverride : undefined;
    } else {
      const resolvedClassId = kelasOrLabIdsOverride ?? profil.kelasId;
      classIds = resolvedClassId ? [resolvedClassId] : undefined;
    }
    return {
      uid: profil.uid,
      role: 'praktikan',
      displayName: profil.nama,
      nim: profil.nim,
      classIds,
    };
  }

  if (rawRole === 'aslab') {
    return {
      uid: profil.uid,
      role: 'aslab',
      displayName: profil.nama,
      nip: profil.nip,
    };
  }

  if (rawRole === 'asprak') {
    const assignedLabIds = Array.isArray(kelasOrLabIdsOverride)
      ? kelasOrLabIdsOverride
      : undefined;
    return {
      uid: profil.uid,
      role: 'asprak',
      displayName: profil.nama,
      nip: profil.nip,
      ...(assignedLabIds !== undefined ? { assignedLabIds } : {}),
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
      classIds: getPraktikanClassIds(user),
    };
  }

  if (user.peran === 'asprak') {
    return {
      uid: user.id,
      role: 'asprak',
      displayName: user.nama,
      nip: user.nip,
      assignedLabIds: user.assignedLabIds ?? [],
    };
  }

  if (user.peran === 'aslab') {
    return {
      uid: user.id,
      role: 'aslab',
      displayName: user.nama,
      nip: user.nip,
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
