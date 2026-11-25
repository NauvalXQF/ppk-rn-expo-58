# Sprint 4 — Manajemen Laboratorium (Aslab), Sistem Denda, Integrasi Midtrans, dan Finalisasi UI

Dokumen ini adalah acuan kerja Sprint 4 untuk aplikasi pengelolaan dan presensi praktikum lanjutan Sprint 3. Fokus sprint: menghadirkan peran baru **Asisten Laboratorium (Aslab)** beserta manajemen bulk/distribusi laboratorium, membangun dashboard keberlangsungan & keuangan laboratorium, memfokuskan wewenang **Asisten Praktikum (Asprak)** pada sesi kelasnya, menerapkan mekanisme *grace period* keterlambatan & denda otomatis, mengintegrasikan pembayaran denda via **Midtrans Sandbox** berarsitektur client–server–webhook, memperluas push notification untuk siklus pembayaran, serta memfinalisasi antarmuka lintas peran.

> **Stack Aplikasi**: Expo SDK 58 (`~58.0.16`), React Native 0.88, React 19.3, TypeScript strict, Expo Router, Cloud Firestore, Firebase Authentication, Leaflet + WebView (`react-native-webview`), Geolocation (`expo-location`), Push Notification (`expo-notifications`), Backend Serverless / Cloud Functions (`firebase-admin` + Midtrans Snap API Sandbox).  
> **Status Dokumen**: Rancangan acuan resmi tim berdasarkan gap analysis pasca-Sprint 3. Seluruh SRS Sprint 4 berstatus **Belum Terimplementasi & Belum Terverifikasi**.  
> **Aturan Mutlak**: `MIDTRANS_SERVER_KEY` dilarang keras disimpan di aplikasi React Native. Status pelunasan denda wajib diverifikasi oleh backend melalui callback/webhook Midtrans yang sah, bukan ditentukan semata dari respons sisi klien.

---

## 1. Ringkasan Gap Analysis Pasca-Sprint 3

| Area Kebutuhan PRD Sprint 4 | Status di Codebase Saat Ini (Pasca-Sprint 3) | Gap yang Wajib Dibangun di Sprint 4 |
| --- | --- | --- |
| **1. Peran Aslab & Manajemen Lab** | Hanya ada 2 peran (`praktikan`, `asisten`). Single CRUD fisik lab & peserta kelas sudah ada, `praktikumId` masih statis. | Tambah peran `aslab` & pisahkan dari `asprak`; relasi Mata Kuliah → Lab; 3 fitur Bulk Insert terpisah + template `.csv` + preview `ScrollView` interaktif (accept/deny/edit/isi kosong); pindah praktikan & asprak antar lab; set *grace period* & nominal denda. |
| **2. Dashboard Keberlangsungan Lab** | Info sesi *ongoing* & *upcoming* baru ada di bottom sheet peta per lab; rekap hadir dasar ada di tab Rekap. | Halaman Dashboard Aslab terpusat: total lab & praktikan, status semua lab, lokasi & waktu, jadwal aktif & mendatang, riwayat kegiatan lintas hari, **riwayat keuangan denda**, serta **filter Hari, Minggu, Bulan**. |
| **3. Pengelolaan Sesi oleh Asprak** | Buka/tutup sesi real-time, rekap presensi, dan review izin sudah berjalan, namun `asisten` masih melihat semua kelas & kelola lab. | Kunci cakupan (*scoping*) Asprak hanya pada kelas/lab yang ditugaskan; cabut akses Asprak terhadap distribusi praktikan dan konfigurasi seluruh laboratorium di UI & Firestore Rules. |
| **4. Keterlambatan & Denda** | Waktu presensi (`recordedAt`) & izin (`leaveRequests`) sudah tercatat, tetapi semua presensi berstatus `hadir` biasa dan alfa/izin belum dibedakan di rekap. | Kalkulasi *grace period* saat presensi; status tepat waktu vs terlambat; pembuatan 1 tagihan denda nominal tetap per keterlambatan (`fines/{sessionId}_{uid}`); status *excused absence* (izin disetujui tidak jadi hadir & bebas denda). |
| **5. Payment Gateway (Midtrans)** | `react-native-webview` sudah terinstal, namun belum ada backend server, koleksi tagihan/transaksi, maupun alur bayar. | Layanan Backend (buat transaksi Snap & verifikasi SHA-512 webhook Midtrans Sandbox); halaman daftar tagihan praktikan; checkout WebView Midtrans; sinkronisasi status `pending`, `success`, `failed`. |
| **6. Notifikasi & Riwayat Bayar** | Infrastruktur `expo-notifications`, token registry, dan `NotificationBell` sudah matang untuk 3 event Sprint 3. | Tambah 3 trigger notifikasi pembayaran (`fine_created`, `payment_success`, `payment_failed`); buat halaman Riwayat Pembayaran persisten (sesi, tanggal tagihan, nominal, waktu transaksi, status). |
| **Finalisasi Antarmuka (UI/UX)** | Design system dasar (`AppCard`, `FloatingPillTabBar`, `theme.ts`) sudah ada untuk 2 peran. | Penyelarasan navigasi dinamis 3 peran (`praktikan`, `asprak`, `aslab`), konsistensi komponen, empty/loading/error state, dan polesan visual akhir. |

---

## 2. Tujuan Sprint

1. **Pemisahan Peran Aslab vs Asprak & Bulk Management**: Menghadirkan peran `aslab` untuk mengelola laboratorium per mata kuliah, distribusi praktikan & asprak (single maupun 3 bulk insert terpisah ber-template dengan editor `ScrollView`), perpindahan anggota antar lab, serta pengaturan radius & batas keterlambatan.
2. **Dashboard Pemantauan & Keuangan Aslab**: Menyediakan dashboard terpusat dengan filter harian, mingguan, dan bulanan untuk memantau operasional seluruh lab beserta arus kas denda praktikum dari Firebase.
3. **Isolasi Pelaksanaan Sesi oleh Asprak**: Memastikan `asprak` fokus membuka sesi, memantau/mengelola presensi & izin, dan menutup sesi secara real-time khusus pada laboratorium/kelas tanggung jawabnya.
4. **Otomasi Grace Period, Denda, & Izin Sah**: Menghitung keterlambatan presensi secara presisi menggunakan *grace period*, menerbitkan tepat satu tagihan per keterlambatan tanpa mengubah status kehadiran saat lunas, dan menjamin praktikan berizin tercatat sebagai *excused absence* bebas denda.
5. **Pembayaran Midtrans Sandbox End-to-End**: Mengimplementasikan alur transaksi aman Client → Backend → Midtrans Sandbox → Webhook Backend → Firestore untuk memperbarui status tagihan secara otoritatif.
6. **Notifikasi & Persistensi Riwayat Pembayaran**: Mengirimkan notifikasi otomatis pada pembuatan tagihan maupun hasil pembayaran, dilengkapi halaman riwayat transaksi yang persisten lintas sesi aplikasi.

---

## 3. Ruang Lingkup dan Kebutuhan Wajib

| ID | Kebutuhan | PIC Utama |
| --- | --- | --- |
| SRS-01 | Peran baru Aslab, manajemen laboratorium per mata kuliah, 3 bulk insert terpisah (template + `ScrollView` editor), dan perpindahan praktikan/asprak | P1 |
| SRS-02 | Dashboard keberlangsungan laboratorium & riwayat keuangan denda untuk Aslab dengan filter hari, minggu, dan bulan | P1 |
| SRS-03 | Pengelolaan sesi praktikum real-time oleh Asprak beserta pembatasan kewenangan pada lab/kelas tanggung jawabnya | P2 |
| SRS-04 | Perhitungan keterlambatan berbasis *grace period*, pembuatan tagihan denda tunggal, dan penanganan *excused absence* | P2 |
| SRS-05 | Backend transaksi & integrasi Midtrans Sandbox (Snap checkout, callback/webhook verification, update status tagihan) | P3 |
| SRS-06 | Integrasi push notification pembayaran (tagihan baru, sukses, gagal/pending) dan halaman riwayat pembayaran persisten | P3 |
| SRS-07 | Finalisasi antarmuka modern, konsisten, dan navigasi adaptif untuk seluruh peran (`praktikan`, `asprak`, `aslab`) | Bersama (PM, P1, P2, P3) |
| SRS-08 | RBAC 3-peran di Firestore Security Rules, pengamanan secret key di backend, dan penanganan error transaksi | Bersama (P1, P2, P3) |

Rincian spesifikasi lengkap per SRS tersedia di [prd.md](./prd.md).

---

## 4. Peta Dokumen

| Dokumen | Isi | Pembaca Utama |
| --- | --- | --- |
| [README.md](./README.md) | Ikhtisar sprint, gap analysis pasca-Sprint 3, tujuan, tim, milestone, dan Definition of Done | Seluruh Tim |
| [prd.md](./prd.md) | PRD & SRS-01–SRS-08, asumsi desain yang dikunci, user stories, kriteria penerimaan | PM dan Programmer |
| [arsitektur.md](./arsitektur.md) | Arsitektur 3-peran, pipeline bulk insert, alur client–backend–Midtrans webhook, dan kalkulasi *grace period* | Programmer |
| [data-model.md](./data-model.md) | Skema Firestore baru/diperbarui (`courses`, `laboratories`, `labAssignments`, `fines`, `payments`) & Security Rules | Programmer |
| [navigasi-ui.md](./navigasi-ui.md) | Peta rute Expo Router 3-peran, spesifikasi layar Bulk Insert, Dashboard Aslab, Checkout Midtrans, & Riwayat Bayar | Programmer dan PM |
| [pembagian-tugas.md](./pembagian-tugas.md) | Struktur 1 PM + 3 Programmer, kepemilikan file client & backend, kontrak antarmodul, timeline kerja | Seluruh Tim |
| [acceptance-criteria.md](./acceptance-criteria.md) | Kriteria Given/When/Then, matriks pengujian end-to-end, skrip demo Sprint 4, dan lembar verifikasi | PM dan Programmer |

---

## 5. Struktur Tim dan Pembagian Tugas

| Peran | Branch | Fokus Tanggung Jawab |
| --- | --- | --- |
| **Project Manager (PM)** | `main` | Penyelarasan kontrak data 3-peran, penyediaan environment Sandbox Midtrans, finalisasi konsistensi UI global, review PR, integrasi, dan verifikasi demo |
| **Programmer 1 (P1)** | `feature/aslab-lab-dashboard` | Role `aslab`, CRUD & konfigurasi lab (radius + batas telat + nominal denda), 3 fitur Bulk Insert terpisah + unduh template CSV + preview `ScrollView` interaktif, pindah praktikan/asprak, dan Dashboard Aslab (filter hari/minggu/bulan + riwayat keuangan) |
| **Programmer 2 (P2)** | `feature/asprak-grace-fines` | Scoping akses `asprak` per lab/kelas, alur buka/kelola/tutup sesi Asprak, kalkulasi *grace period* saat presensi, penerbitan tagihan denda tunggal (`fines`), dan status *excused absence* pada izin yang disetujui |
| **Programmer 3 (P3)** | `feature/midtrans-payment-notif` | Backend endpoint Midtrans Sandbox (buat transaksi Snap + webhook verifikasi signature), UI daftar tagihan & halaman bayar WebView, halaman riwayat pembayaran persisten, serta 3 trigger push notification pembayaran |

---

## 6. Milestone Pengerjaan

```text
M0: Penyetujuan Kontrak Skema Firestore (3 Role, Lab-Course, Fines, Payments) & Setup Midtrans Sandbox
  │
  ├── M1: Fondasi Role & Backend
  │     ├── P1: Pemisahan role (praktikan, asprak, aslab) di Auth + struktur mata kuliah & lab
  │     ├── P2: Scoping query Asprak + ekstensi model sesi/presensi untuk grace period & denda
  │     └── P3: Setup fungsi backend Midtrans (create transaction & webhook endpoint)
  │
  ├── M2: Implementasi Fitur Inti Paralel
  │     ├── P1: 3 Bulk Insert (template + ScrollView accept/deny/edit) + Transfer anggota + Dashboard Aslab
  │     ├── P2: Engine keterlambatan saat presensi + auto-create tagihan + excused absence izin
  │     └── P3: UI Tagihan & WebView Midtrans + Riwayat Pembayaran + Push Notification 3 event bayar
  │
  ├── M3: Finalisasi UI Lintas Peran, Penguncian Firestore Security Rules, & Integrasi Bertahap
  │
  └── M4: Pengujian Webhook End-to-End Midtrans Sandbox, Regresi Sprint 1–3, Lint/Typecheck, & Demo
```

---

## 7. Empat Alur Demo Utama (Acceptance Target)

1. **Alur Demo 1 — Manajemen Laboratorium & Bulk Insert Fleksibel oleh Aslab**:
   Aslab login → mengunduh template CSV → mengunggah bulk daftar laboratorium untuk satu mata kuliah → mengedit baris kosong & melakukan *accept/deny* pada `ScrollView` → mengatur koordinat, radius geofence, dan batas keterlambatan → melakukan bulk insert praktikan & asprak ke lab → memindahkan seorang praktikan ke lab lain.
2. **Alur Demo 2 — Pelaksanaan Sesi oleh Asprak, Grace Period, & Excused Absence**:
   Asprak login (hanya melihat lab tanggung jawabnya) → membuka sesi praktikum → Praktikan A presensi sebelum *grace period* habis (tercatat tepat waktu, tanpa denda) → Praktikan B presensi melewati *grace period* (tercatat hadir terlambat + otomatis terbit 1 tagihan denda + menerima notifikasi tagihan baru) → Praktikan C disetujui izinnya oleh Asprak (tercatat *tidak hadir dengan izin* / *excused absence*, bebas denda).
3. **Alur Demo 3 — Pembayaran Denda via Midtrans Sandbox & Notifikasi Real-time**:
   Praktikan B membuka daftar tagihan → menekan Bayar → backend membuat transaksi Midtrans Sandbox → halaman pembayaran Snap tampil → simulasi pembayaran berhasil di Sandbox → Midtrans mengirim webhook ke backend → backend memverifikasi signature, mengubah status pembayaran menjadi `success` (tanpa mengubah status hadir terlambat), dan memicu push notification *"Pembayaran Berhasil"* → tercatat permanen di Riwayat Pembayaran walau aplikasi ditutup dan dibuka ulang.
4. **Alur Demo 4 — Dashboard Keberlangsungan & Keuangan Laboratorium (Aslab)**:
   Aslab membuka Dashboard → memantau jumlah lab & praktikan, sesi aktif/mendatang, riwayat kegiatan, serta pemasukan denda dari pembayaran Praktikan B → mengganti filter **Hari**, **Minggu**, dan **Bulan** secara mulus.

---

## 8. Definition of Done (DoD)

Sprint 4 dinyatakan selesai apabila:

1. Seluruh 8 SRS terpenuhi dan lulus skenario pengujian pada [acceptance-criteria.md](./acceptance-criteria.md).
2. Ketiga peran (`praktikan`, `asprak`, `aslab`) memiliki isolasi tampilan dan hak akses yang ditegakkan oleh Cloud Firestore Security Rules.
3. Ketiga alur Bulk Insert (Lab, Praktikan, Asprak) terpisah, memiliki template unduhan, dan menyediakan editor `ScrollView` interaktif (*accept/deny*, update, isi field kosong).
4. Perhitungan keterlambatan menggunakan *grace period*, menghasilkan tepat satu tagihan per kejadian terlambat, pembayaran tidak mengubah catatan kehadiran, dan izin yang disetujui tercatat sebagai *excused absence* bebas denda.
5. Transaksi pembayaran Midtrans Sandbox berjalan melalui backend tanpa menyimpan `MIDTRANS_SERVER_KEY` di kode klien, dan perubahan status lunas diverifikasi dari webhook backend.
6. Push notification terkirim untuk tagihan baru, pembayaran berhasil, dan pembayaran gagal/pending, serta halaman riwayat pembayaran tetap persisten setelah restart aplikasi.
7. Tidak ada regresi pada fitur Sprint 1–3, serta `npx expo lint` dan `npx tsc --noEmit` lulus tanpa error.
