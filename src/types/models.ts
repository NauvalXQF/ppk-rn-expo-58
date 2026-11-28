import type { LateStatus } from '@/types/fine';

export type Peran = 'praktikan' | 'asprak' | 'aslab' | 'asisten';

export type StatusSesi = 'dijadwalkan' | 'dibuka' | 'ditutup';

/** Status sesi di dokumen Firestore sesuai kontrak Sprint 2. */
export type FirestoreSessionStatus = 'scheduled' | 'open' | 'closed';

export interface Praktikan {
  id: string;
  peran: 'praktikan';
  nama: string;
  nim: string;
  kelasId: string;
  kelasIds?: string[];
  email?: string;
}

export interface Asprak {
  id: string;
  peran: 'asprak';
  nama: string;
  nip: string;
  email?: string;
  assignedLabIds?: string[];
}

export interface Aslab {
  id: string;
  peran: 'aslab';
  nama: string;
  nip?: string;
  email?: string;
  managedCourseIds?: string[];
}

export interface Asisten {
  id: string;
  peran: 'asisten';
  nama: string;
  nip: string;
  email?: string;
}

export type StaffPengguna = Asprak | Aslab | Asisten;

export type Pengguna = Praktikan | StaffPengguna;

export function isPraktikanUser(
  user: Pengguna | null | undefined,
): user is Praktikan {
  return Boolean(user && user.peran === 'praktikan');
}

export function isAsprakUser(
  user: Pengguna | null | undefined,
): user is Asprak {
  return Boolean(user && (user.peran === 'asprak' || user.peran === 'asisten'));
}

export function isAslabUser(
  user: Pengguna | null | undefined,
): user is Aslab {
  return Boolean(user && user.peran === 'aslab');
}

export function isStaffUser(
  user: Pengguna | null | undefined,
): user is StaffPengguna {
  return Boolean(
    user &&
    (user.peran === 'asprak' ||
      user.peran === 'aslab' ||
      user.peran === 'asisten'),
  );
}

export function canManageClassesAndMembers(
  user: Pengguna | null | undefined,
): boolean {
  return Boolean(user && user.peran === 'aslab');
}

export interface Praktikum {
  id: string;
  nama: string;
  kode: string;
  aslabUids?: string[];
  defaultGracePeriodMinutes?: number;
  defaultLateFineAmount?: number;
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
  labId?: string;
  topik: string;
  courseId?: string;
}

export interface Sesi {
  id: string;
  praktikumId: string;
  courseId?: string;
  kelasId: string;
  asistenId: string;
  asistenNama?: string;
  scheduleId?: string;
  labId?: string;
  labNama?: string;
  labCoordinates?: {
    latitude: number;
    longitude: number;
  };
  radiusMeters?: number;
  gracePeriodMinutes?: number;
  lateFineAmount?: number;
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
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  distanceMeters?: number;
  geofenceStatus?: 'in_radius';
  lateStatus?: LateStatus;
  lateMinutes?: number;
  graceDeadlineAt?: string;
  fineId?: string | null;
}

export interface ApprovedLeaveRef {
  id: string;
  uid: string;
  sessionId: string;
  classId: string;
  praktikanName?: string;
  praktikanNim?: string;
  reason?: string;
  decidedAt?: string | null;
}

export interface LeaveRequestRef {
  id: string;
  uid: string;
  sessionId: string;
  classId: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  decisionNote?: string | null;
  decidedAt?: string | null;
}

export interface AppState {
  currentUser: Pengguna | null;
  pengguna: Pengguna[];
  praktikum: Praktikum[];
  kelas: Kelas[];
  sesi: Sesi[];
  presensi: Presensi[];
  jadwal?: Jadwal[];
  approvedLeaves?: ApprovedLeaveRef[];
  leaveRequests?: LeaveRequestRef[];
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
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    distanceMeters?: number;
    geofenceStatus?: 'in_radius';
    lateStatus?: LateStatus;
    lateMinutes?: number;
    graceDeadlineAt?: string;
    fineId?: string | null;
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
    payload: Partial<
      Pick<
        AppState,
        | 'pengguna'
        | 'praktikum'
        | 'kelas'
        | 'sesi'
        | 'presensi'
        | 'jadwal'
        | 'currentUser'
        | 'approvedLeaves'
        | 'leaveRequests'
      >
    >;
  }
  | { type: 'RESET_DATA' };

export interface BarisRekap {
  presensi: Presensi;
  praktikan: Praktikan;
}

export interface BarisIzin {
  uid: string;
  nama: string;
  nim: string;
  reason?: string;
  decidedAt?: string | null;
}

export interface RekapSesi {
  baris: BarisRekap[];
  jumlahHadir: number;
  totalPraktikan: number;
}

export interface RekapSesiDetail extends RekapSesi {
  barisIzin: BarisIzin[];
  jumlahTepatWaktu: number;
  jumlahTerlambat: number;
  jumlahIzin: number;
}

export type StatusKehadiran =
  | 'hadir'
  | 'izin'
  | 'belum-presensi'
  | 'belum-berlangsung'
  | 'tidak-hadir';

export interface RiwayatItem {
  sesi: Sesi;
  presensi: Presensi | null;
  status: StatusKehadiran;
  approvedLeave?: ApprovedLeaveRef | null;
}

export interface DetailSesi {
  sesi: Sesi;
  praktikum: Praktikum;
  kelas: Kelas;
  asisten: StaffPengguna;
  presensiSaya: Presensi | null;
  rekap: RekapSesi;
}
