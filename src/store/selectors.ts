import type {
  AppState,
  BarisRekap,
  DetailSesi,
  Pengguna,
  Praktikan,
  RekapSesi,
  RiwayatItem,
  Sesi,
  StatusKehadiran,
  StatusSesi,
} from '@/types/models';

const prioritasStatus: Record<StatusSesi, number> = {
  dibuka: 0,
  dijadwalkan: 1,
  ditutup: 2,
};

export function selectCurrentUser(state: AppState): Pengguna | null {
  return state.currentUser;
}

export function selectSesiById(state: AppState, sesiId: string): Sesi | null {
  return state.sesi.find((s) => s.id === sesiId) ?? null;
}

export function selectTotalPraktikan(state: AppState, kelasId: string): number {
  return state.pengguna.filter(
    (u): u is Praktikan => u.peran === 'praktikan' && u.kelasId === kelasId,
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
    const praktikan = state.pengguna.find(
      (u): u is Praktikan => u.id === pres.praktikanId && u.peran === 'praktikan',
    );
    if (praktikan) {
      baris.push({ presensi: pres, praktikan });
    }
  }

  const totalPraktikan = sesi ? selectTotalPraktikan(state, sesi.kelasId) : 0;

  return {
    baris,
    jumlahHadir: presensiList.length,
    totalPraktikan,
  };
}

export function selectSesiUntukPengguna(state: AppState): Sesi[] {
  const user = state.currentUser;
  let daftarSesi: Sesi[] = [];

  if (!user) {
    daftarSesi = [];
  } else if (user.peran === 'asisten') {
    daftarSesi = [...state.sesi];
  } else {
    daftarSesi = state.sesi.filter((s) => s.kelasId === user.kelasId);
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

  const praktikum = state.praktikum.find((p) => p.id === sesi.praktikumId);
  const kelas = state.kelas.find((k) => k.id === sesi.kelasId);
  const asisten = state.pengguna.find(
    (u) => u.id === sesi.asistenId && u.peran === 'asisten',
  );

  if (!praktikum || !kelas || !asisten || asisten.peran !== 'asisten') {
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
): RiwayatItem[] {
  const praktikan = state.pengguna.find(
    (u): u is Praktikan => u.id === praktikanId && u.peran === 'praktikan',
  );
  if (!praktikan) return [];

  const sesiList = state.sesi
    .filter((s) => s.kelasId === praktikan.kelasId)
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

    return {
      sesi,
      presensi,
      status,
    };
  });
}
