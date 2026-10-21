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

export type AppAction =
  | { type: 'PILIH_PENGGUNA'; pengguna: Pengguna }
  | { type: 'KELUAR' }
  | { type: 'BUKA_SESI'; sesiId: string }
  | { type: 'TUTUP_SESI'; sesiId: string }
  | {
      type: 'CATAT_PRESENSI';
      sesiId: string;
      praktikanId: string;
      catatan?: string;
      waktuPresensi?: string;
    }
  | { type: 'RESET_DATA' };

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
