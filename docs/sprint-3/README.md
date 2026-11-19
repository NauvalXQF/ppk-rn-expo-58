# Sprint 3 — Lokasi, Peta Interaktif, dan Push Notification

Dokumen ini adalah acuan kerja Sprint 3 untuk aplikasi presensi praktikum lanjutan Sprint 2. Fokus sprint: memperluas fungsionalitas aplikasi dengan validasi presensi berbasis lokasi fisik (geofencing), peta laboratorium interaktif dengan informasi aktivitas praktikum real-time, serta sistem push notification terarah berbasis peristiwa kegiatan.

> **Stack Aplikasi**: Expo SDK 58 (`~58.0.16`), React Native 0.88, React 19.3, TypeScript strict, Expo Router, Cloud Firestore, Firebase Authentication, Geolocation/Maps (`expo-location`, `react-native-maps`), Push Notification (`expo-notifications` / FCM).  
> **Status Dokumen**: Rancangan acuan resmi tim. Seluruh SRS berstatus **Belum Terverifikasi**; seluruh checklist fitur dan pengujian **belum dijalankan**.  
> **Aturan Mutlak**: Validasi lokasi wajib menjadi syarat kelulusan transaksi presensi di database, bukan sekadar penanda visual di antarmuka. Push notification harus terarah ke pengguna yang berkepentingan.

---

## 1. Tujuan Sprint

1. **Halaman Presensi Khusus & Validasi Geofencing**: Menyediakan halaman presensi terpisah dari detail sesi yang memvalidasi keberadaan fisik praktikan dalam radius laboratorium aktif sebelum presensi dicatat.
2. **Pengelolaan Data Laboratorium**: Mengelola data laboratorium (nama, gedung, koordinat latitude/longitude, dan radius toleransi) yang tersimpan di Cloud Firestore dan dikelola oleh asisten.
3. **Peta Interaktif & Pelacakan Pengguna**: Menampilkan peta persebaran laboratorium Informatika dengan custom marker, visualisasi radius geofence, serta marker posisi pengguna yang diperbarui secara langsung (*live user location tracking*).
4. **Informasi Aktivitas Laboratorium Real-time**: Menampilkan praktikum yang sedang berlangsung (*ongoing*) dan jadwal praktikum berikutnya (*upcoming*) pada setiap laboratorium yang dipilih di peta.
5. **Push Notification Berbasis Peristiwa**: Mengirimkan pemberitahuan otomatis ke perangkat praktikan saat sesi dibuka, jadwal mengalami perubahan, atau pengajuan izin diputuskan oleh asisten.
6. **Penanganan Kondisi Perangkat & Izin**: Mengelola izin akses lokasi dan notifikasi secara defensif, termasuk penanganan kondisi saat GPS mati, izin ditolak, sinyal lemah, atau token perangkat tidak valid.

---

## 2. Ruang Lingkup dan Kebutuhan Wajib

| ID | Kebutuhan | PIC Utama |
| --- | --- | --- |
| SRS-01 | Halaman presensi terpisah dari detail sesi, penampil info sesi, dan aksi presensi (opsional: QR Code) | P2 |
| SRS-02 | Validasi lokasi perangkat terhadap radius laboratorium (geofencing), penolakan presensi di luar radius | P2 |
| SRS-03 | Pengelolaan data dan koordinat laboratorium (CRUD lab & radius) oleh asisten di Cloud Firestore | P3 |
| SRS-04 | Peta laboratorium interaktif, custom marker lab, dan pelacakan posisi pengguna secara real-time | P3 |
| SRS-05 | Penampil aktivitas laboratorium di peta (praktikum sedang berjalan & berikutnya) tersinkronisasi real-time | P3 |
| SRS-06 | Pengiriman push notification otomatis untuk peristiwa buka sesi, perubahan jadwal, dan keputusan izin | P1 |
| SRS-07 | Manajemen pendaftaran token perangkat pengguna (*device token registry*) dan penargetan notifikasi | P1 |
| SRS-08 | Penanganan izin runtime (lokasi & notifikasi), error GPS/jaringan, dan Security Rules Firestore | Bersama (P1, P2, P3) |

Rincian spesifikasi lengkap per SRS tersedia di [prd.md](./prd.md).

---

## 3. Peta Dokumen

| Dokumen | Isi | Pembaca Utama |
| --- | --- | --- |
| [README.md](./README.md) | Ikhtisar sprint, tujuan, ruang lingkup, tim, milestone, dan definition of done | Seluruh Tim |
| [prd.md](./prd.md) | PRD & SRS-01–SRS-08, user stories, input/output, kriteria penerimaan, traceability | PM dan Programmer |
| [arsitektur.md](./arsitektur.md) | Arsitektur teknis, integrasi Maps/Geolocation, flow push notification, dan penanganan lifecycle | Programmer |
| [data-model.md](./data-model.md) | Skema Firestore `laboratories`, pembaruan `sessions`, `attendances`, token device, dan Security Rules | Programmer |
| [navigasi-ui.md](./navigasi-ui.md) | Rute Expo Router (tab peta, halaman presensi, kelola lab), wireframe, dan state penanganan error | Programmer dan PM |
| [pembagian-tugas.md](./pembagian-tugas.md) | Struktur 1 PM + 3 Programmer, kepemilikan file, timeline 90 menit praktikum, Git workflow | Seluruh Tim |
| [acceptance-criteria.md](./acceptance-criteria.md) | Kriteria pengujian Given/When/Then, test matrix, tiga skrip demo utama, dan lembar verifikasi | PM dan Programmer |

---

## 4. Struktur Tim dan Pembagian Tugas

| Peran | Branch | Fokus Tanggung Jawab |
| --- | --- | --- |
| **Project Manager (PM)** | `main` | Planning, penyusunan SRS, koordinasi kontrak intermodul, review PR, integrasi, demo pengujian, dan pelaporan |
| **Programmer 1 (P1)** | `feature/push-notification` | Setup layanan Push Notification (`expo-notifications`/FCM), registry token perangkat di Firestore, listener event pemicu notifikasi (sesi, jadwal, izin), dan penanganan izin notifikasi |
| **Programmer 2 (P2)** | `feature/geo-attendance` | Halaman presensi khusus (`/presensi/[sesiId]`), integrasi Geolocation perangkat, kalkulasi jarak Haversine & geofence, validasi presensi berbasis lokasi, dan pencegahan duplikasi |
| **Programmer 3 (P3)** | `feature/maps-laboratory` | Halaman peta interaktif (`/peta`), integrasi `react-native-maps`, custom marker lab & user location tracking, callout aktivitas lab real-time, dan manajemen master data laboratorium |

Setiap programmer bertanggung jawab penuh pada branch masing-masing. Integrasi ke `main` dikelola bertahap oleh PM setelah melalui verifikasi otomatis (*lint*, *typecheck*, dan *unit test*).

---

## 5. Milestone dan Timeline Praktikum (90 Menit)

```text
M0 (00–15 m): Planning & SRS disepakati tim (PM memfasilitasi kontrak data-model & koordinat)
  │
  ├── M1 (15–30 m): Setup & Fondasi Modul (P1: Notification service; P2: Location service; P3: Maps base)
  │
  ├── M2 (30–60 m): Implementasi Fitur Paralel
  │     ├── P1: Device token registry + trigger notifikasi (sesi/jadwal/izin)
  │     ├── P2: Halaman presensi + validasi geofence Haversine + feedback UI
  │     └── P3: Peta interaktif + marker real-time + bottom sheet aktivitas lab
  │
  ├── M3 (60–75 m): Integrasi & Review Bertahap (Merge ke main terurut: Data/Peta → Presensi → Notifikasi)
  │
  └── M4 (75–90 m): Eksekusi 3 Demo Pengujian, Sign-Off, dan Penulisan Alur Kode Praktikum
```

---

## 6. Git Workflow

- Seluruh programmer bekerja di *feature branch* masing-masing yang dibuat dari commit terbaru `main`.
- Menggunakan konvensi *Conventional Commits*:
  - P1: `feat(notification): ...`
  - P2: `feat(geo-attendance): ...`
  - P3: `feat(maps-lab): ...`
- Sebelum mengajukan Pull Request ke `main`, programmer wajib memastikan:
  1. `npx tsc --noEmit` lolos tanpa error.
  2. `npx eslint src ...` lolos tanpa peringatan fatal.
  3. Unit test lokal berjalan sukses.
- PM mereview diff, memvalidasi bukti pengujian, dan melakukan merge ke `main`.

---

## 7. Tiga Alur Demo Utama (Acceptance Target)

1. **Alur Demo 1 — Presensi Berbasis Lokasi & Geofence**:
   Asisten membuka sesi praktikum → Praktikan membuka halaman presensi khusus → Aplikasi meminta izin lokasi dan mengambil koordinat GPS perangkat → Sistem menghitung jarak ke titik laboratorium → Jika di luar radius, presensi ditolak dengan visualisasi jarak; jika di dalam radius, presensi sukses dicatat ke Firestore → Asisten melihat rekapitulasi kehadiran real-time.
2. **Alur Demo 2 — Peta Interaktif & Aktivitas Laboratorium**:
   Pengguna membuka tab Peta → Peta menampilkan posisi pengguna saat ini dan marker seluruh laboratorium Informatika → Visualisasi radius geofence tampak di sekitar laboratorium → Pengguna mengetuk marker laboratorium → Tampil rincian aktivitas praktikum yang sedang berjalan (*ongoing*) serta sesi praktikum berikutnya (*upcoming*) dari data Firestore.
3. **Alur Demo 3 — Push Notification Kegiatan Praktikum**:
   Perangkat praktikan mendaftarkan token notifikasi saat login → Asisten membuka sesi praktikum baru → Sistem memicu push notification ke seluruh praktikan kelas terkait → Notifikasi berbunyi dan menampilkan judul/pesan kegiatan → Asisten mengubah jadwal atau memutuskan izin → Praktikan menerima pemberitahuan instan yang dapat diketuk untuk membuka layar terkait.

---

## 8. Definition of Done (DoD)

Sprint 3 dinyatakan selesai apabila:

1. Seluruh 8 SRS terpenuhi dan terbukti melalui pengujian pada [acceptance-criteria.md](./acceptance-criteria.md).
2. Halaman presensi terpisah berhasil memvalidasi lokasi perangkat secara matematis (Haversine) terhadap koordinat laboratorium.
3. Presensi yang berada di luar radius laboratorium atau sesi tertutup ditolak oleh klien dan dilindungi oleh Cloud Firestore Security Rules.
4. Peta laboratorium menampilkan marker lab, visualisasi radius geofence, dan live tracking lokasi pengguna tanpa crash.
5. Notifikasi berhasil terkirim dan diterima pada peristiwa pembukaan sesi, perubahan jadwal, dan keputusan izin.
6. Penanganan izin lokasi dan notifikasi ditangani dengan pesan pengguna yang jelas saat ditolak atau dimatikan.
7. Tidak ada regresi pada fitur Sprint 1 dan Sprint 2 (autentikasi, CRUD jadwal/sesi, model sentimen AI lokal).
8. Kode lolos pengujian *typecheck* TypeScript (`tsc --noEmit`), *lint* ESLint, dan seluruh suite unit test lulus 100%.
