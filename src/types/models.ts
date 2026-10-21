export type Peran = 'praktikan' | 'asisten';

export type StatusSesi = 'dijadwalkan' | 'dibuka' | 'ditutup';

export interface Praktikan {
  id: string;
  peran: 'praktikan';
  nama: string;
  nim: string;
  kelasId: string;
}

export interface Asisten {
  id: string;
  peran: 'asisten';
  nama: string;
  nip: string;
}

export type Pengguna = Praktikan | Asisten;

export interface Praktikum {
  id: string;
  nama: string;
  kode: string;
}

export interface Kelas {
  id: string;
  nama: string;
  praktikumId: string;
}

export interface Sesi {
  id: string;
  praktikumId: string;
  kelasId: string;
  asistenId: string;
  topik: string;
  ruang: string;
  /** Format YYYY-MM-DD, memakai tanggal lokal perangkat. */
  tanggal: string;
  /** Format HH:mm, 24 jam. */
  jamMulai: string;
  /** Format HH:mm, 24 jam. */
  jamSelesai: string;
  status: StatusSesi;
}

export interface Presensi {
  id: string;
  sesiId: string;
  praktikanId: string;
  /** ISO 8601, waktu lokal perangkat saat presensi dicatat. */
  waktuPresensi: string;
  catatan?: string;
}

export interface AppState {
  currentUser: Pengguna | null;
  pengguna: Pengguna[];
  praktikum: Praktikum[];
  kelas: Kelas[];
  sesi: Sesi[];
  presensi: Presensi[];
}

export const LABEL_STATUS: Record<StatusSesi, string> = {
  dijadwalkan: 'Dijadwalkan',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};
