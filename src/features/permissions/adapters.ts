import type { Kelas, Pengguna, Sesi } from '@/types/models';
import type { LeaveSessionOption, PermissionActor } from './types';

/**
 * Adapter helper untuk memetakan data pengguna Sprint 1 / store sementara
 * ke kontrak `PermissionActor` sebelum modul AuthContext P1 terintegrasi.
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
 * Adapter helper untuk memetakan daftar sesi & kelas Sprint 1 ke `LeaveSessionOption[]`.
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

