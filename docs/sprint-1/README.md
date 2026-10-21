# Sprint 1 — Antarmuka dan Alur Praktikum

Dokumen ini adalah acuan kerja Sprint 1 untuk tim Mobile APK. Fokus sprint: membangun aplikasi presensi praktikum React Native dengan dua sudut pandang, **praktikan** dan **asisten**, memakai data dummy dan state lokal.

> Stack: Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router.
> Tidak ada backend, database, autentikasi, atau sinkronisasi antar perangkat.

---

## 1. Tujuan Sprint

1. Menampilkan jadwal dan detail sesi praktikum untuk kedua peran.
2. Memungkinkan asisten membuka dan menutup sesi.
3. Memungkinkan praktikan melakukan presensi hanya saat sesi dibuka, dengan waktu kehadiran tercatat dan tidak bisa dua kali.
4. Menampilkan rekap kehadiran untuk asisten dan riwayat kehadiran untuk praktikan.
5. Menerapkan Flexbox, navigasi, form, modal/bottom sheet, dan state yang responsif terhadap tindakan pengguna.

---

## 2. Ruang Lingkup

### Termasuk

- Form pemilihan peran dan identitas dummy di dalam aplikasi.
- Daftar jadwal + detail sesi (nama praktikum, kelas, waktu, ruang, asisten, status).
- Aksi asisten: buka sesi, tutup sesi, lihat rekap per sesi.
- Aksi praktikan: presensi saat sesi dibuka, lihat riwayat kehadiran sendiri.
- Empty state, state sesi belum dibuka, state sudah presensi, dan state sesi ditutup.
- Konfirmasi memakai Modal/Bottom Sheet.
- Layout responsif dengan Flexbox.

### Tidak termasuk

- Login, registrasi, atau keamanan akun.
- Backend/API, database, AsyncStorage, atau sinkronisasi antar HP.
- CRUD jadwal oleh asisten.
- QR code, GPS, face recognition, atau validasi lokasi.
- Status terlambat/alpha otomatis. Tidak hadir hanya dihitung dari tidak adanya record presensi.
- Push notification, dark mode, dan internasionalisasi.
- Build EAS wajib untuk pengembangan UI. Build development dipakai saat demo di HP.

---

## 3. Peta Dokumen

| Dokumen | Isi | Pembaca utama |
| --- | --- | --- |
| [README.md](./README.md) | Ringkasan sprint, scope, milestone, definition of done | Semua |
| [prd.md](./prd.md) | Latar belakang, tujuan, persona, user story, functional/non-functional requirements | PM, semua programmer |
| [arsitektur.md](./arsitektur.md) | Struktur folder, routing, state, data flow, keputusan teknis | Semua programmer |
| [data-model.md](./data-model.md) | TypeScript types, dummy data, reducer, selector, aturan bisnis | Dev 1, Dev 2, Dev 3 |
| [navigasi-ui.md](./navigasi-ui.md) | Route map, wireframe, spesifikasi layar, komponen, token UI | Dev 2, Dev 3, PM |
| [pembagian-tugas.md](./pembagian-tugas.md) | Milestone, pembagian file, dependency, Git workflow | Semua |
| [acceptance-criteria.md](./acceptance-criteria.md) | Kriteria penerimaan, test matrix, skrip demo | PM, semua programmer |

---

## 4. Alur Demo yang Harus Berhasil

1. Aplikasi dibuka → pilih peran **Asisten** dan identitas asisten → masuk.
2. Asisten membuka sesi yang berstatus **dijadwalkan**.
3. Ganti pengguna → pilih peran **Praktikan** dan identitas praktikan → masuk.
4. Praktikan membuka sesi yang sama → mengisi form presensi → konfirmasi lewat bottom sheet → mendapat umpan balik waktu kehadiran.
5. Praktikan mencoba presensi lagi → ditolak karena sudah tercatat.
6. Ganti pengguna ke Asisten → buka rekap → melihat nama dan waktu kehadiran praktikan.
7. Asisten menutup sesi → status berubah di daftar jadwal dan detail sesi.
8. Ganti ke Praktikan → sesi tampil **ditutup**, presensi tetap tercatat di riwayat.

Data konsisten selama aplikasi berjalan karena semua layar membaca state yang sama. Data tidak perlu selaras antar perangkat.

---

## 5. Peran Tim

| Peran | Fokus | Kepemilikan utama |
| --- | --- | --- |
| PM | Scope, dokumen, task board, review acceptance, koordinasi demo | `docs/sprint-1/**` |
| Dev 1 — Core | Types, dummy data, state, navigasi, shared UI, form peran | `src/types`, `src/data`, `src/store`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/components/ui` |
| Dev 2 — Praktikan | Jadwal, detail sesi praktikan, form presensi, riwayat kehadiran | `src/features/jadwal`, `src/features/presensi`, `src/features/kehadiran`, `src/app/(tabs)/jadwal.tsx`, `src/app/(tabs)/kehadiran.tsx` |
| Dev 3 — Asisten | Detail sesi asisten, buka/tutup sesi, rekap kehadiran | `src/features/sesi/asisten`, `src/features/rekap`, `src/app/(tabs)/rekap.tsx` |

Aturan utama: **kontrak data dan state dimiliki Dev 1**. Dev 2 dan Dev 3 tidak mengubah `src/types` atau `src/store` tanpa koordinasi.

---

## 6. Milestone

| Milestone | Fokus | Exit criteria |
| --- | --- | --- |
| M0 — Contract & Skeleton | Types, dummy data, provider, reducer, selector, route skeleton, shared UI dasar | Aplikasi boot; form peran bisa memilih user; tabs tampil; `tsc` dan ESLint bersih |
| M1 — Parallel Feature | Dev 1 menyelesaikan navigasi & profil; Dev 2 membangun alur praktikan; Dev 3 membangun alur asisten | Tiap branch bisa mendemokan alurnya sendiri memakai data dummy |
| M2 — Integration | Menyatukan kedua alur di detail sesi dan memastikan status konsisten di semua layar | Alur buka sesi → presensi → rekap → tutup sesi berjalan end-to-end |
| M3 — QA & Demo | Menjalankan acceptance criteria, memperbaiki bug, latihan demo | Semua AC lulus; tidak ada error di console; demo lancar |

Urutan di atas adalah dependency, bukan estimasi waktu.

---

## 7. Definition of Done

- [ ] Semua acceptance criteria di `acceptance-criteria.md` lulus.
- [ ] `npx tsc --noEmit` tanpa error.
- [ ] `npx eslint .` tanpa error.
- [ ] Tidak ada `console.error` / red screen saat alur demo dijalankan.
- [ ] Empty state, state sesi belum dibuka, state sudah presensi, dan state sesi ditutup sudah ada.
- [ ] Form dan Modal/Bottom Sheet dipakai sesuai spesifikasi.
- [ ] Layout tidak overflow di lebar 320 px dan tetap rapi di tablet.
- [ ] PR sudah direview minimal satu programmer lain.
- [ ] Demo dijalankan ulang dari kondisi data awal (reload aplikasi) dan berhasil.

---

## 8. Prasyarat

1. Setup environment sudah selesai (Node, Expo, EAS bila ingin demo di HP).
2. Bersihkan demo bawaan template **sekali saja** sebelum mulai:
   ```bash
   npm run reset-project
   ```
   Pilih `n` untuk menghapus demo, atau `y` untuk memindahkannya ke `/example`.
   Dokumen ini mengasumsikan `src/app` hanya berisi `_layout.tsx` dan `index.tsx`, lalu diisi ulang sesuai struktur di `arsitektur.md`.
3. Jalankan `npm install` bila belum.
4. Cek kesehatan project:
   ```bash
   npx expo-doctor
   npx tsc --noEmit
   npx eslint .
   ```

---

## 9. Asumsi dan Keputusan Awal

- Satu aplikasi, satu instance state. Peran diganti lewat layar Profil → Ganti Pengguna.
- Data dummy disimpan di memori. Reload aplikasi mengembalikan data ke kondisi awal.
- Sesi hanya bisa berpindah status satu arah: `dijadwalkan → dibuka → ditutup`. Sesi yang sudah ditutup tidak bisa dibuka kembali.
- Presensi hanya boleh dilakukan saat status sesi `dibuka` dan hanya untuk praktikan di kelas yang sama dengan sesi.
- Satu praktikan hanya boleh punya satu record presensi per sesi.
- Praktikan hanya melihat sesi kelasnya sendiri. Asisten melihat semua sesi.
- Tidak ada status terlambat. Semua record presensi dianggap hadir.
- Waktu memakai jam perangkat dan ditampilkan dengan locale `id-ID`.

---

## 10. Aturan Kerja Singkat

- **Contract-first**: Dev 1 menyelesaikan `types/models.ts`, `store/app-context.tsx`, dan `store/selectors.ts` sebelum Dev 2 dan Dev 3 masuk ke fitur.
- **Route tipis**: file di `src/app/**` hanya merender komponen fitur, bukan tempat logika bisnis.
- **Satu sumber kebenaran**: semua perubahan data lewat `dispatch`, bukan mutasi langsung.
- **Jangan menambah dependency** tanpa persetujuan PM dan Dev 1.
- **Jangan mengerjakan file milik orang lain** tanpa koordinasi. Lihat `pembagian-tugas.md`.
