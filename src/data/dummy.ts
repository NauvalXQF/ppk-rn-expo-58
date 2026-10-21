import type {
  AppState,
  Asisten,
  Kelas,
  Praktikan,
  Praktikum,
  Presensi,
  Sesi,
} from '@/types/models';

function tanggalRelatif(offsetHari: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetHari);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function waktuRelatif(offsetHari: number, jam: number, menit: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetHari);
  d.setHours(jam, menit, 0, 0);
  return d.toISOString();
}

const asisten: Asisten = {
  id: 'asisten-1',
  peran: 'asisten',
  nama: 'Nauval',
  nip: '1987654321',
};

const praktikan: Praktikan[] = [
  {
    id: 'praktikan-1',
    peran: 'praktikan',
    nama: 'Budi Santoso',
    nim: '2310511001',
    kelasId: 'kelas-a',
  },
  {
    id: 'praktikan-2',
    peran: 'praktikan',
    nama: 'Siti Rahma',
    nim: '2310511002',
    kelasId: 'kelas-a',
  },
  {
    id: 'praktikan-3',
    peran: 'praktikan',
    nama: 'Rizky Pratama',
    nim: '2310511003',
    kelasId: 'kelas-b',
  },
  {
    id: 'praktikan-4',
    peran: 'praktikan',
    nama: 'Dewi Lestari',
    nim: '2310511004',
    kelasId: 'kelas-c',
  },
];

const praktikum: Praktikum[] = [
  {
    id: 'praktikum-ppk',
    nama: 'Praktikum Pemrograman Komputer',
    kode: 'PPK',
  },
];

const kelas: Kelas[] = [
  { id: 'kelas-a', nama: 'PPK A', praktikumId: 'praktikum-ppk' },
  { id: 'kelas-b', nama: 'PPK B', praktikumId: 'praktikum-ppk' },
  { id: 'kelas-c', nama: 'PPK C', praktikumId: 'praktikum-ppk' },
];

const sesi: Sesi[] = [
  {
    id: 'sesi-1',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-a',
    asistenId: 'asisten-1',
    topik: 'Pengenalan React Native',
    ruang: 'Lab 3',
    tanggal: tanggalRelatif(-7),
    jamMulai: '10:00',
    jamSelesai: '12:00',
    status: 'ditutup',
  },
  {
    id: 'sesi-2',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-a',
    asistenId: 'asisten-1',
    topik: 'Komponen & Layout',
    ruang: 'Lab 3',
    tanggal: tanggalRelatif(0),
    jamMulai: '10:00',
    jamSelesai: '12:00',
    status: 'dijadwalkan',
  },
  {
    id: 'sesi-3',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-a',
    asistenId: 'asisten-1',
    topik: 'State & Navigasi',
    ruang: 'Lab 3',
    tanggal: tanggalRelatif(7),
    jamMulai: '10:00',
    jamSelesai: '12:00',
    status: 'dijadwalkan',
  },
  {
    id: 'sesi-4',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-b',
    asistenId: 'asisten-1',
    topik: 'Pengenalan React Native',
    ruang: 'Lab 5',
    tanggal: tanggalRelatif(-6),
    jamMulai: '13:00',
    jamSelesai: '15:00',
    status: 'ditutup',
  },
  {
    id: 'sesi-5',
    praktikumId: 'praktikum-ppk',
    kelasId: 'kelas-b',
    asistenId: 'asisten-1',
    topik: 'Komponen & Layout',
    ruang: 'Lab 5',
    tanggal: tanggalRelatif(8),
    jamMulai: '13:00',
    jamSelesai: '15:00',
    status: 'dijadwalkan',
  },
];

const presensi: Presensi[] = [
  {
    id: 'pres-sesi-1-praktikan-1',
    sesiId: 'sesi-1',
    praktikanId: 'praktikan-1',
    waktuPresensi: waktuRelatif(-7, 10, 4),
  },
  {
    id: 'pres-sesi-1-praktikan-2',
    sesiId: 'sesi-1',
    praktikanId: 'praktikan-2',
    waktuPresensi: waktuRelatif(-7, 10, 12),
  },
  {
    id: 'pres-sesi-4-praktikan-3',
    sesiId: 'sesi-4',
    praktikanId: 'praktikan-3',
    waktuPresensi: waktuRelatif(-6, 13, 5),
    catatan: 'Hadir di Lab 5',
  },
];

export const initialState: AppState = {
  currentUser: null,
  pengguna: [asisten, ...praktikan],
  praktikum,
  kelas,
  sesi,
  presensi,
};
