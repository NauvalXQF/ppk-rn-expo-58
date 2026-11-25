import {
  isStaffUser,
  type AppState,
  type ApprovedLeaveRef,
  type BarisIzin,
  type BarisRekap,
  type DetailSesi,
  type Jadwal,
  type Pengguna,
  type Praktikan,
  type RekapSesi,
  type RekapSesiDetail,
  type RiwayatItem,
  type Sesi,
  type StaffPengguna,
  type StatusKehadiran,
  type StatusSesi,
} from '@/types/models';
import { DEFAULT_SCHEDULES } from '@/services/practicumService';

const prioritasStatus: Record<StatusSesi, number> = {
  dibuka: 0,
  dijadwalkan: 1,
  ditutup: 2,
};

export function getPraktikanClassIds(praktikan: Praktikan): string[] {
  if (Array.isArray(praktikan.kelasIds)) {
    return praktikan.kelasIds;
  }
  return praktikan.kelasId ? [praktikan.kelasId] : [];
}

export function isPraktikanInClass(
  praktikan: Praktikan,
  kelasId: string,
): boolean {
  return getPraktikanClassIds(praktikan).includes(kelasId);
}

export function selectCurrentUser(state: AppState): Pengguna | null {
  return state.currentUser;
}

export function selectSesiById(state: AppState, sesiId: string): Sesi | null {
  return state.sesi.find((s) => s.id === sesiId) ?? null;
}

export function selectTotalPraktikan(state: AppState, kelasId: string): number {
  return state.pengguna.filter(
    (u): u is Praktikan => u.peran === 'praktikan' && isPraktikanInClass(u, kelasId),
  ).length;
}

export function selectJumlahHadir(state: AppState, sesiId: string): number {
  return state.presensi.filter((p) => p.sesiId === sesiId).length;
}

export function selectSudahPresensi(
  state: AppState,
  sesiId: string,
  praktikanId: string,
): boolean {
  return state.presensi.some(
    (p) => p.sesiId === sesiId && p.praktikanId === praktikanId,
  );
}

export function selectRekapSesi(state: AppState, sesiId: string): RekapSesi {
  const sesi = selectSesiById(state, sesiId);
  const presensiList = state.presensi
    .filter((p) => p.sesiId === sesiId)
    .sort(
      (a, b) =>
        new Date(a.waktuPresensi).getTime() - new Date(b.waktuPresensi).getTime(),
    );

  const baris: BarisRekap[] = [];
  for (const pres of presensiList) {
    const praktikan =
      state.pengguna.find(
        (u): u is Praktikan => u.id === pres.praktikanId && u.peran === 'praktikan',
      ) ?? {
        id: pres.praktikanId,
        peran: 'praktikan',
        nama: pres.praktikanId,
        nim: '-',
        kelasId: sesi?.kelasId ?? 'kelas-a',
      };
    baris.push({ presensi: pres, praktikan });
  }

  const totalPraktikan = sesi ? selectTotalPraktikan(state, sesi.kelasId) : 0;

  return {
    baris,
    jumlahHadir: presensiList.length,
    totalPraktikan,
  };
}

export function selectRekapSesiDetail(
  state: AppState,
  sesiId: string,
  approvedLeavesOverride?: ApprovedLeaveRef[],
): RekapSesiDetail {
  const base = selectRekapSesi(state, sesiId);
  const attendedUids = new Set(base.baris.map((b) => b.presensi.praktikanId));

  let jumlahTepatWaktu = 0;
  let jumlahTerlambat = 0;
  for (const b of base.baris) {
    if (b.presensi.lateStatus === 'late') {
      jumlahTerlambat += 1;
    } else {
      jumlahTepatWaktu += 1;
    }
  }

  const leaves = approvedLeavesOverride ?? state.approvedLeaves ?? [];
  const seenIzinUids = new Set<string>();
  const barisIzin: BarisIzin[] = [];

  for (const leave of leaves) {
    if (leave.sessionId !== sesiId) continue;
    if (attendedUids.has(leave.uid) || seenIzinUids.has(leave.uid)) continue;
    seenIzinUids.add(leave.uid);

    const praktikan = state.pengguna.find(
      (u): u is Praktikan => u.id === leave.uid && u.peran === 'praktikan',
    );
    barisIzin.push({
      uid: leave.uid,
      nama: praktikan?.nama || leave.praktikanName || leave.uid,
      nim: praktikan?.nim || leave.praktikanNim || '-',
      reason: leave.reason,
      decidedAt: leave.decidedAt ?? null,
    });
  }

  return {
    ...base,
    barisIzin,
    jumlahTepatWaktu,
    jumlahTerlambat,
    jumlahIzin: barisIzin.length,
  };
}

export function selectPesertaPraktikum(state: AppState): Praktikan[] {
  return state.pengguna.filter(
    (u): u is Praktikan => u.peran === 'praktikan',
  );
}

export function selectJadwalUntukPengguna(state: AppState): Jadwal[] {
  const user = state.currentUser;
  const list = state.jadwal ?? DEFAULT_SCHEDULES;
  if (!user) return [];
  if (user.peran === 'aslab' || user.peran === 'asisten') return [...list];
  if (user.peran === 'asprak') {
    const allowedLabs = new Set(user.assignedLabIds ?? []);
    if (allowedLabs.size === 0) return [];
    return list.filter((j) => allowedLabs.has(j.kelasId));
  }
  const classIds = getPraktikanClassIds(user);
  return list.filter((j) => classIds.includes(j.kelasId));
}

export function selectSesiUntukPengguna(state: AppState): Sesi[] {
  const user = state.currentUser;
  let daftarSesi: Sesi[] = [];

  if (!user) {
    daftarSesi = [];
  } else if (user.peran === 'aslab' || user.peran === 'asisten') {
    daftarSesi = [...state.sesi];
  } else if (user.peran === 'asprak') {
    const allowedLabs = new Set(user.assignedLabIds ?? []);
    daftarSesi =
      allowedLabs.size === 0
        ? []
        : state.sesi.filter((s) => allowedLabs.has(s.kelasId));
  } else {
    const classIds = getPraktikanClassIds(user);
    daftarSesi = state.sesi.filter((s) => classIds.includes(s.kelasId));
  }

  return daftarSesi.sort((a, b) => {
    const diffStatus = prioritasStatus[a.status] - prioritasStatus[b.status];
    if (diffStatus !== 0) return diffStatus;

    const timeA = new Date(`${a.tanggal}T${a.jamMulai}:00`).getTime();
    const timeB = new Date(`${b.tanggal}T${b.jamMulai}:00`).getTime();

    if (a.status === 'ditutup') {
      return timeB - timeA; // turun
    }
    return timeA - timeB; // naik
  });
}

export function selectDetailSesi(
  state: AppState,
  sesiId: string,
): DetailSesi | null {
  const sesi = selectSesiById(state, sesiId);
  if (!sesi) return null;

  const praktikum =
    state.praktikum.find((p) => p.id === sesi.praktikumId) ??
    state.praktikum[0];
  const kelas = state.kelas.find((k) => k.id === sesi.kelasId) ?? {
    id: sesi.kelasId,
    nama: sesi.kelasId,
    praktikumId: sesi.praktikumId,
  };
  const asisten: StaffPengguna =
    state.pengguna.find(
      (u): u is StaffPengguna => isStaffUser(u) && u.id === sesi.asistenId,
    ) ??
    (isStaffUser(state.currentUser) && state.currentUser.id === sesi.asistenId
      ? state.currentUser
      : {
          id: sesi.asistenId,
          peran: 'asisten',
          nama: sesi.asistenNama || 'Asisten Praktikum',
          nip: '-',
        });

  if (!praktikum) {
    return null;
  }

  const presensiSaya =
    state.currentUser && state.currentUser.peran === 'praktikan'
      ? state.presensi.find(
          (p) =>
            p.sesiId === sesiId && p.praktikanId === state.currentUser?.id,
        ) ?? null
      : null;

  const rekap = selectRekapSesi(state, sesiId);

  return {
    sesi,
    praktikum,
    kelas,
    asisten,
    presensiSaya,
    rekap,
  };
}

export function selectRiwayatPraktikan(
  state: AppState,
  praktikanId: string,
  approvedLeavesOverride?: ApprovedLeaveRef[],
): RiwayatItem[] {
  const praktikan =
    state.pengguna.find(
      (u): u is Praktikan => u.id === praktikanId && u.peran === 'praktikan',
    ) ??
    (state.currentUser?.peran === 'praktikan' &&
    state.currentUser.id === praktikanId
      ? state.currentUser
      : undefined);
  if (!praktikan) return [];

  const classIds = getPraktikanClassIds(praktikan);
  const leaves = approvedLeavesOverride ?? state.approvedLeaves ?? [];
  const sesiList = state.sesi
    .filter((s) => classIds.includes(s.kelasId))
    .sort((a, b) => {
      const timeA = new Date(`${a.tanggal}T${a.jamMulai}:00`).getTime();
      const timeB = new Date(`${b.tanggal}T${b.jamMulai}:00`).getTime();
      return timeB - timeA; // sesi terbaru di atas
    });

  return sesiList.map((sesi) => {
    const presensi =
      state.presensi.find(
        (p) => p.sesiId === sesi.id && p.praktikanId === praktikanId,
      ) ?? null;

    const approvedLeave =
      leaves.find((l) => l.sessionId === sesi.id && l.uid === praktikanId) ??
      null;

    let status: StatusKehadiran;
    if (presensi) {
      status = 'hadir';
    } else if (approvedLeave) {
      status = 'izin';
    } else if (sesi.status === 'dibuka') {
      status = 'belum-presensi';
    } else if (sesi.status === 'dijadwalkan') {
      status = 'belum-berlangsung';
    } else {
      status = 'tidak-hadir';
    }

    return {
      sesi,
      presensi,
      status,
      approvedLeave,
    };
  });
}
