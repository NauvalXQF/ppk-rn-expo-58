import type {
  AppState,
  Asisten,
  Kelas,
  Pengguna,
  Praktikan,
  Praktikum,
  Presensi,
  Sesi,
  StatusSesi,
} from '@/types/models';

export interface BarisRekap {
  presensi: Presensi;
  praktikan: Praktikan;
}

export interface RekapSesi {
  baris: BarisRekap[];
  jumlahHadir: number;
  totalPraktikan: number;
}

export type StatusKehadiran =
  | 'hadir'
  | 'belum-presensi'
  | 'belum-berlangsung'
  | 'tidak-hadir';

export interface RiwayatItem {
  sesi: Sesi;
  presensi: Presensi | null;
  status: StatusKehadiran;
}

export interface DetailSesi {
  sesi: Sesi;
  praktikum: Praktikum;
  kelas: Kelas;
  asisten: Asisten;
  presensiSaya: Presensi | null;
  rekap: RekapSesi;
}

export function selectCurrentUser(state: AppState): Pengguna | null {
  return state.currentUser;
}

export function selectSesiById(state: AppState, sesiId: string): Sesi | null {
  return state.sesi.find((s) => s.id === sesiId) || null;
}

export function selectTotalPraktikan(state: AppState, kelasId: string): number {
  return state.pengguna.filter(
    (u) => u.peran === 'praktikan' && (u as Praktikan).kelasId === kelasId,
  ).length;
}

export function selectJumlahHadir(state: AppState, sesiId: string): number {
  return state.presensi.filter((p) => p.sesiId === sesiId).length;
}

export function selectRekapSesi(state: AppState, sesiId: string): RekapSesi {
  const sesi = state.sesi.find((s) => s.id === sesiId);
  if (!sesi) {
    return { baris: [], jumlahHadir: 0, totalPraktikan: 0 };
  }

  const listPresensi = state.presensi
    .filter((p) => p.sesiId === sesiId)
    .sort(
      (a, b) =>
        new Date(a.waktuPresensi).getTime() - new Date(b.waktuPresensi).getTime(),
    );

  const baris: BarisRekap[] = [];
  for (const p of listPresensi) {
    const praktikan = state.pengguna.find(
      (u) => u.id === p.praktikanId && u.peran === 'praktikan',
    ) as Praktikan | undefined;
    if (praktikan) {
      baris.push({ presensi: p, praktikan });
    }
  }

  const totalPraktikan = selectTotalPraktikan(state, sesi.kelasId);

  return {
    baris,
    jumlahHadir: baris.length,
    totalPraktikan,
  };
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

export function selectDetailSesi(
  state: AppState,
  sesiId: string,
): DetailSesi | null {
  const sesi = selectSesiById(state, sesiId);
  if (!sesi) return null;

  const praktikum = state.praktikum.find((p) => p.id === sesi.praktikumId);
  const kelas = state.kelas.find((k) => k.id === sesi.kelasId);
  const asisten = state.pengguna.find(
    (u) => u.id === sesi.asistenId && u.peran === 'asisten',
  ) as Asisten | undefined;

  if (!praktikum || !kelas || !asisten) return null;

  const presensiSaya =
    state.currentUser && state.currentUser.peran === 'praktikan'
      ? state.presensi.find(
          (p) =>
            p.sesiId === sesiId && p.praktikanId === state.currentUser?.id,
        ) || null
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

export function selectSesiUntukPengguna(state: AppState): Sesi[] {
  if (!state.currentUser) return [];

  const prioritas: Record<StatusSesi, number> = {
    dibuka: 0,
    dijadwalkan: 1,
    ditutup: 2,
  };

  const pool =
    state.currentUser.peran === 'asisten'
      ? [...state.sesi]
      : state.sesi.filter(
          (s) => s.kelasId === (state.currentUser as Praktikan).kelasId,
        );

  return pool.sort((a, b) => {
    if (prioritas[a.status] !== prioritas[b.status]) {
      return prioritas[a.status] - prioritas[b.status];
    }
    const timeA = `${a.tanggal}T${a.jamMulai}`;
    const timeB = `${b.tanggal}T${b.jamMulai}`;
    if (a.status === 'ditutup') {
      return timeB.localeCompare(timeA);
    }
    return timeA.localeCompare(timeB);
  });
}

export function selectRiwayatPraktikan(
  state: AppState,
  praktikanId: string,
): RiwayatItem[] {
  const praktikan = state.pengguna.find(
    (u) => u.id === praktikanId && u.peran === 'praktikan',
  ) as Praktikan | undefined;

  if (!praktikan) return [];

  const sesiKelas = state.sesi
    .filter((s) => s.kelasId === praktikan.kelasId)
    .sort((a, b) => {
      const timeA = `${a.tanggal}T${a.jamMulai}`;
      const timeB = `${b.tanggal}T${b.jamMulai}`;
      return timeB.localeCompare(timeA);
    });

  return sesiKelas.map((sesi) => {
    const presensi =
      state.presensi.find(
        (p) => p.sesiId === sesi.id && p.praktikanId === praktikanId,
      ) || null;

    let status: StatusKehadiran;
    if (presensi) {
      status = 'hadir';
    } else if (sesi.status === 'dibuka') {
      status = 'belum-presensi';
    } else if (sesi.status === 'dijadwalkan') {
      status = 'belum-berlangsung';
    } else {
      status = 'tidak-hadir';
    }

    return { sesi, presensi, status };
  });
}

