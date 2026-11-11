export type Peran = 'praktikan' | 'asisten';

export type StatusSesi = 'dijadwalkan' | 'dibuka' | 'ditutup';

/** Status sesi di dokumen Firestore sesuai kontrak Sprint 2. */
export type FirestoreSessionStatus = 'scheduled' | 'open' | 'closed';

export interface Praktikan {
  id: string;
  peran: 'praktikan';
  nama: string;
  nim: string;
  kelasId: string;
  email?: string;
}

export interface Asisten {
  id: string;
  peran: 'asisten';
  nama: string;
  nip: string;
  email?: string;
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
  asistenId?: string;
}

export interface AnggotaKelas {
  id: string;
  uid: string;
  kelasId: string;
  nama: string;
  nim: string;
}

export interface Jadwal {
  id: string;
  praktikumId: string;
  kelasId: string;
  asistenId: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
  topik: string;
}

export interface Sesi {
  id: string;
  praktikumId: string;
  kelasId: string;
  asistenId: string;
  scheduleId?: string;
  topik: string;
  ruang: string;
  /** Format YYYY-MM-DD, memakai tanggal lokal perangkat. */
  tanggal: string;
  /** Format HH:mm, 24 jam. */
  jamMulai: string;
  /** Format HH:mm, 24 jam. */
  jamSelesai: string;
  status: StatusSesi;
  waktuBuka?: string;
  waktuTutup?: string;
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
  jadwal?: Jadwal[];
}

export const LABEL_STATUS: Record<StatusSesi, string> = {
  dijadwalkan: 'Dijadwalkan',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export type AppAction =
  | { type: 'PILIH_PENGGUNA'; pengguna: Pengguna }
  | { type: 'SET_PENGGUNA'; pengguna: Pengguna }
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
  | { type: 'TAMBAH_KELAS'; kelas: Kelas }
  | { type: 'UBAH_KELAS'; kelas: Kelas }
  | { type: 'HAPUS_KELAS'; kelasId: string }
  | { type: 'TAMBAH_PESERTA'; peserta: Praktikan }
  | { type: 'UBAH_PESERTA'; peserta: Praktikan }
  | { type: 'HAPUS_PESERTA'; praktikanId: string }
  | { type: 'TAMBAH_JADWAL'; jadwal: Jadwal }
  | { type: 'UBAH_JADWAL'; jadwal: Jadwal }
  | { type: 'HAPUS_JADWAL'; jadwalId: string }
  | { type: 'TAMBAH_SESI'; sesi: Sesi }
  | { type: 'UBAH_SESI'; sesi: Sesi }
  | { type: 'HAPUS_SESI'; sesiId: string }
  | {
      type: 'SYNC_FIRESTORE';
      payload: Partial<Pick<AppState, 'pengguna' | 'praktikum' | 'kelas' | 'sesi' | 'presensi' | 'jadwal' | 'currentUser'>>;
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
