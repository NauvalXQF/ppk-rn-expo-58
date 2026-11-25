# PRD dan SRS — Sprint 4: Manajemen Laboratorium (Aslab), Sistem Denda, Midtrans, dan Finalisasi UI

## 1. Informasi Dokumen

| Item | Isi |
| --- | --- |
| Produk | Aplikasi Pengelolaan dan Presensi Praktikum, Lanjutan Sprint 3 |
| Sprint | Sprint 4 — Manajemen Laboratorium (Aslab), Sistem Denda, Payment Gateway Midtrans, & Finalisasi UI |
| Versi Dokumen | 1.0 |
| Status | Rancangan Resmi; Seluruh SRS **Belum Terimplementasi & Belum Terverifikasi** |
| Pemilik | Project Manager (PM) |
| Tanggal Penyusunan | 25 November 2026 |
| Target Platform | Android, iOS, dan Web Pendukung (Expo SDK 58 + Backend API Webhook) |
| Layanan Terintegrasi | Firebase Auth, Cloud Firestore, Geolocation, Leaflet Maps, Expo Notifications, Backend Server + Midtrans Sandbox |

Dokumen ini menerjemahkan kebutuhan PRD Sprint 4 beserta analisis celah (*gap analysis*) terhadap codebase pasca-Sprint 3 menjadi spesifikasi teknis terukur. Detail arsitektur dibahas pada [arsitektur.md](./arsitektur.md), skema database pada [data-model.md](./data-model.md), antarmuka pada [navigasi-ui.md](./navigasi-ui.md), dan kriteria pengujian pada [acceptance-criteria.md](./acceptance-criteria.md).

---

## 2. Latar Belakang dan Problem Statement

Hingga akhir Sprint 3, aplikasi telah mendukung autentikasi dua peran (`praktikan` dan `asisten`), CRUD dasar kelas/jadwal/sesi, validasi presensi geofencing Haversine, peta laboratorium interaktif, pengajuan izin berbantuan klasifikasi AI lokal, serta push notification untuk tiga peristiwa kegiatan dasar.

Namun, untuk operasional laboratorium skala penuh terdapat lima celah utama yang belum terimplementasi:
1. **Belum Ada Pemisahan Kewenangan Aslab vs Asprak**: Seluruh kewenangan administratif (konfigurasi lab, distribusi praktikan) dan operasional harian (buka/tutup sesi kelas) masih bercampur dalam satu peran tunggal `asisten`, serta belum ada fitur *bulk insert* ber-template maupun perpindahan anggota antar laboratorium.
2. **Belum Ada Dashboard Pemantauan Lintas Laboratorium**: Pengelola laboratorium belum memiliki layar terpusat berfilter waktu (hari/minggu/bulan) untuk memantau keterisian lab, jadwal berjalan/mendatang, riwayat kegiatan, dan rekap keuangan denda.
3. **Belum Ada Aturan Keterlambatan (*Grace Period*) dan Tagihan Denda**: Semua presensi yang masuk saat sesi dibuka masih dianggap setara (`hadir`), belum membedakan keterlambatan melewati batas toleransi, dan belum membedakan ketidakhadiran berizin (*excused absence*) dari alfa pada rekap kehadiran.
4. **Belum Ada Sistem Pembayaran Denda Terverifikasi Server**: Belum tersedia integrasi Payment Gateway (Midtrans Sandbox) dengan arsitektur client–server–webhook yang aman dari manipulasi klien.
5. **Belum Ada Notifikasi & Riwayat Transaksi Pembayaran**: Praktikan belum mendapatkan pemberitahuan otomatis saat denda terbit atau pembayaran selesai/gagal, serta belum memiliki catatan riwayat pembayaran persisten.

---

## 3. Keputusan Desain & Asumsi Sistem yang Dikunci

Agar implementasi Sprint 4 selaras dengan fondasi kode Sprint 1–3 tanpa membongkar fitur yang sudah berjalan, ditetapkan asumsi sistem berikut:

1. **Penyatuan Unit Laboratorium Praktikum per Mata Kuliah**:
   - Setiap dokumen laboratorium aktif dikaitkan ke satu mata kuliah (`courseId` / `praktikumId`) yang menjadi tanggung jawab Aslab, sekaligus merepresentasikan unit kelompok praktikum (`classId` kompatibel) yang memiliki lokasi fisik, koordinat GPS, `radiusMeters`, `gracePeriodMinutes`, `lateFineAmount`, daftar Asprak bertugas, dan daftar Praktikan terdaftar.
2. **Kompatibilitas Peran Lama (`asisten` $\rightarrow$ `asprak`)**:
   - Peran pengguna diperluas menjadi 3: `'praktikan' | 'asprak' | 'aslab'`. Dokumen lama di Firestore yang masih bernilai `role: 'asisten'` dinormalisasi sebagai `'asprak'` agar akun lama tetap berfungsi.
3. **Mekanisme Akun pada Single / Bulk Insert Praktikan & Asprak**:
   - Karena aplikasi memiliki layanan Backend (dengan `firebase-admin`), proses simpan single/bulk insert praktikan dan asprak memanggil endpoint provisioning backend (atau mencocokkan UID akun terdaftar berdasarkan email/NIM/NIP) sehingga Aslab dapat mendaftarkan banyak akun sekaligus tanpa ter-logout dari sesi Firebase klien.
4. **Format File Template Bulk Insert**:
   - Ketiga fitur bulk insert menggunakan template terpisah berformat **CSV (`.csv`)** yang dapat diunduh langsung ke perangkat, dibuka di Excel/Google Sheets, lalu dipilih kembali untuk di-parse menjadi daftar item interaktif pada `ScrollView`.
5. **Perpindahan Anggota Tanpa Pindah Jadwal**:
   - Sesuai PRD (*"Tidak perlu ada perpindahan jadwal praktikum. Cukup perpindahan praktikan dan aslab/asprak nya saja"*), fitur transfer memindahkan keanggotaan praktikan atau penugasan asprak dari laboratorium asal ke laboratorium tujuan dalam mata kuliah terkait tanpa memodifikasi entitas jadwal.
6. **Acuan Waktu Keterlambatan (*Grace Period*)**:
   - Titik mulai efektif sesi dihitung dari `effectiveStart = max(waktuJadwalMulaiSesi, openedAt)`. Batas akhir tepat waktu adalah `effectiveStart + gracePeriodMinutes`. Presensi dengan waktu server $\le$ batas dianggap **Tepat Waktu**; presensi $>$ batas dianggap **Terlambat** dan menerbitkan tepat 1 tagihan denda nominal tetap. (Jika Asprak membuka sesi tepat atau sebelum jam mulai, acuan otomatis sama dengan jam mulai sesi).
7. **Perlakuan Alfa vs Izin (*Excused Absence*) terhadap Denda**:
   - Sesuai ketentuan PRD, denda dikenakan atas **kejadian keterlambatan presensi** dengan nominal tetap. Praktikan yang memperoleh persetujuan izin (`approved`) dari Asprak dicatat berstatus **`izin` (*excused absence* / tidak hadir dengan izin)** — tidak diubah menjadi hadir, dan dibebaskan dari denda keterlambatan (apabila sebelumnya sempat terbit denda belum dibayar pada sesi tersebut, tagihan otomatis dibatalkan/`waived`).
8. **Retry Pembayaran pada Satu Tagihan**:
   - Satu keterlambatan hanya boleh menghasilkan **satu dokumen tagihan (`fineId = {sessionId}_{uid}`)**. Jika percobaan bayar di Midtrans kedaluwarsa atau gagal (`failed`), praktikan dapat membuat transaksi pembayaran ulang (`orderId` baru dengan sufiks percobaan) yang tetap merujuk pada `fineId` tunggal tersebut.

---

## 4. Target Pengguna dan User Stories

| Pengguna | Kebutuhan Utama di Sprint 4 | SRS Terkait |
| --- | --- | --- |
| **Aslab (Peran Baru)** | Mengelola data & aturan laboratorium (radius, batas telat, denda) sesuai mata kuliahnya, mengunduh template & mengeksekusi 3 bulk insert terpisah lewat editor `ScrollView`, memindahkan praktikan/asprak antar lab, serta memantau dashboard kegiatan & keuangan denda berfilter hari/minggu/bulan | SRS-01, SRS-02, SRS-07, SRS-08 |
| **Asprak** | Melihat daftar lab/kelas, jadwal, dan sesi yang menjadi tanggung jawabnya saja, membuka/menutup sesi secara real-time, memantau presensi (tepat waktu/terlambat/izin), dan memutus izin praktikan tanpa mengakses konfigurasi lab global | SRS-03, SRS-04, SRS-07, SRS-08 |
| **Praktikan** | Melakukan presensi sesuai batas *grace period*, melihat status *excused absence* saat izin disetujui, melihat rincian tagihan denda keterlambatan, membayar denda via Midtrans Sandbox, menerima push notification pembayaran, dan melihat riwayat pembayaran persisten | SRS-04, SRS-05, SRS-06, SRS-07, SRS-08 |

---

## 5. Software Requirements Specification (SRS)

### SRS-01 — Manajemen Laboratorium & Distribusi Anggota oleh Aslab

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menyediakan kewenangan khusus bagi peran baru **Aslab** untuk mengelola laboratorium berdasarkan mata kuliah tanggung jawabnya, mencakup konfigurasi lokasi/geofence/keterlambatan, single & 3 bulk insert terpisah (Lab, Praktikan, Asprak) dengan file template unduhan dan editor pratinjau `ScrollView`, serta perpindahan praktikan/asprak antar laboratorium. |
| **Input** | Mata kuliah dipilih, form single insert atau file `.csv` hasil template, pengeditan baris di `ScrollView` (*accept/deny*, update field, isi kolom kosong), parameter lab (`nama`, `lokasi/gedung`, `latitude`, `longitude`, `radiusMeters`, `gracePeriodMinutes`, `lateFineAmount`), serta aksi pindah laboratorium asal $\rightarrow$ tujuan. |
| **Output** | Dokumen laboratorium, keanggotaan praktikan, dan penugasan asprak tersimpan/diperbarui di Firestore; file template `.csv` berhasil diunduh pengguna. |
| **Acceptance Criteria** | 1. Aslab hanya mengelola laboratorium dan distribusi pada mata kuliah yang menjadi tanggung jawabnya.<br>2. Tersedia 3 fitur **Single & Bulk Insert yang terpisah** (bukan digabung menjadi satu): (a) Laboratorium berdasarkan satu mata kuliah, (b) Praktikan ke laboratorium tertentu, (c) Asprak ke laboratorium tertentu.<br>3. Masing-masing fitur bulk insert menyediakan tombol **Unduh File Template** yang menghasilkan file contoh siap pakai.<br>4. Saat file bulk dimuat, setiap baris data ditampilkan sebagai daftar kartu di dalam `ScrollView` interaktif di mana Aslab dapat melakukan **Accept / Deny** per baris, mengubah isi field, dan melengkapi kolom yang masih kosong sebelum konfirmasi simpan.<br>5. Aslab dapat memindahkan praktikan maupun asprak dari satu laboratorium ke laboratorium lain tanpa memindahkan jadwal praktikum.<br>6. Aslab dapat mengatur informasi nama, lokasi, koordinat, cakupan radius validasi presensi (`radiusMeters`), dan batasan waktu keterlambatan (`gracePeriodMinutes` beserta nominal denda). |
| **Dependensi** | Fondasi `laboratoryService` & `practicumService` Sprint 3; Backend Admin Provisioning; SRS-08 |
| **PIC** | Programmer 1 (P1) |
| **Status** | Belum Terverifikasi |

---

### SRS-02 — Dashboard Keberlangsungan & Keuangan Laboratorium (Aslab)

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menyediakan halaman dashboard terpusat bagi Aslab untuk memantau kegiatan praktikum dan arus kas pembayaran denda pada seluruh laboratorium yang dikelolanya dengan dukungan filter rentang waktu. |
| **Input** | Data real-time `laboratories`, `classMembers`, `schedules`, `sessions`, `fines`, dan `payments` dari Firestore; pilihan filter periode (`hari`, `minggu`, `bulan`). |
| **Output** | Metrik jumlah lab & praktikan, kartu status kegiatan tiap lab (lokasi & waktu), daftar jadwal berlangsung & mendatang, daftar riwayat kegiatan lab, serta ringkasan & daftar riwayat keuangan denda praktikum. |
| **Acceptance Criteria** | 1. Menampilkan total laboratorium aktif dan total praktikan terdaftar di bawah pengelolaan Aslab.<br>2. Menampilkan status kegiatan praktikum terkini pada setiap laboratorium beserta informasi lokasi dan waktu pelaksanaan.<br>3. Menampilkan jadwal/sesi praktikum yang sedang berlangsung (*ongoing*) maupun yang akan datang (*upcoming*) secara real-time.<br>4. Menampilkan riwayat kegiatan laboratorium yang telah selesai.<br>5. Menampilkan riwayat keuangan hasil dari denda praktikum (total denda terbayar, tertunda/belum lunas, dan rincian pembayaran).<br>6. Menyediakan filter **Hari**, **Minggu**, dan **Bulan** yang memperbarui data kegiatan dan keuangan berdasarkan data jadwal, sesi, dan transaksi di Firebase. |
| **Dependensi** | SRS-01; SRS-04; SRS-05 |
| **PIC** | Programmer 1 (P1) |
| **Status** | Belum Terverifikasi |

---

### SRS-03 — Pengelolaan Sesi Terfokus oleh Asprak

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Memfokuskan peran **Asprak** pada pelaksanaan kegiatan praktikum di kelas/laboratorium yang ditugaskan kepadanya, dengan sinkronisasi status sesi real-time ke praktikan dan pembatasan tegas terhadap fitur manajemen tingkat Aslab. |
| **Input** | Akun `asprak` terautentikasi, daftar penugasan lab/kelas Asprak, aksi buka sesi, kelola presensi/izin, dan tutup sesi. |
| **Output** | Daftar kelas/lab, jadwal, dan sesi milik Asprak; perubahan status sesi tersinkronisasi real-time ke praktikan; penolakan akses terhadap menu distribusi praktikan & konfigurasi seluruh lab. |
| **Acceptance Criteria** | 1. Asprak hanya melihat daftar kelas/laboratorium, jadwal, sesi praktikum, dan pengajuan izin yang menjadi tanggung jawabnya.<br>2. Asprak dapat membuka sesi saat praktikum dimulai, memantau & mengelola presensi praktikan (termasuk melihat indikator tepat waktu/terlambat/izin), dan menutup sesi saat selesai.<br>3. Perubahan status sesi (`scheduled` $\rightarrow$ `open` $\rightarrow$ `closed`) tersinkronisasi secara real-time ke aplikasi praktikan.<br>4. Asprak **tidak** memiliki akses UI maupun izin tulis database untuk mengelola distribusi praktikan/asprak atau mengubah konfigurasi seluruh laboratorium. |
| **Dependensi** | Kontrak sesi Sprint 2–3; SRS-01; SRS-08 |
| **PIC** | Programmer 2 (P2) |
| **Status** | Belum Terverifikasi |

---

### SRS-04 — Perhitungan Keterlambatan (*Grace Period*), Denda, & *Excused Absence*

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menentukan status ketepatan waktu presensi menggunakan mekanisme *grace period*, menerbitkan tagihan denda nominal tetap untuk setiap keterlambatan tanpa duplikasi, serta menjamin persetujuan izin tercatat sebagai ketidakhadiran berizin (*excused absence*) bebas denda. |
| **Input** | Waktu presensi praktikan, waktu mulai sesi, konfigurasi `gracePeriodMinutes` & `lateFineAmount` pada sesi/lab, serta status `leaveRequests` praktikan. |
| **Output** | Metadata ketepatan waktu pada dokumen presensi (`on_time` / `late`, `lateMinutes`), dokumen tagihan denda tunggal di koleksi `fines`, serta status kehadiran `izin` (*excused absence*) pada rekap. |
| **Acceptance Criteria** | 1. Durasi toleransi (*grace period*) dan nominal tetap denda dapat dikonfigurasi sesuai kebijakan praktikum/laboratorium.<br>2. Praktikan yang presensi sebelum atau tepat pada akhir *grace period* dicatat hadir **tepat waktu** tanpa tagihan denda.<br>3. Praktikan yang presensi setelah melewati batas *grace period* dinyatakan **terlambat** dan sistem otomatis menghasilkan **tepat satu tagihan denda** dengan nominal tetap.<br>4. Setiap dokumen tagihan terhubung secara eksplisit dengan identitas praktikan (`uid`), sesi (`sessionId`), dan catatan presensi terkait (`attendanceId`).<br>5. Pelunasan/pembayaran denda **tidak mengubah** status kehadiran maupun catatan keterlambatan praktikan.<br>6. Praktikan yang memperoleh persetujuan izin (`approved`) dari Asprak dicatat sebagai **tidak hadir dengan izin (*excused absence*)**, tidak pernah diubah menjadi hadir, dan dibebaskan dari denda keterlambatan. |
| **Dependensi** | `attendanceService` & `permissionService` Sprint 3; SRS-01; SRS-06 |
| **PIC** | Programmer 2 (P2) |
| **Status** | Belum Terverifikasi |

---

### SRS-05 — Integrasi Payment Gateway (Midtrans Sandbox)

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengintegrasikan pembayaran denda praktikum dengan **Midtrans Sandbox** mengikuti arsitektur **Client – Backend – Payment Gateway**, termasuk pembuatan transaksi di server dan verifikasi status pembayaran melalui webhook/callback resmi. |
| **Input** | Pilihan tagihan belum lunas (`fineId`) oleh praktikan, token autentikasi Firebase ID Token, request pembuatan transaksi ke backend, serta HTTP POST notification webhook dari Midtrans Sandbox. |
| **Output** | Snap Token & Redirect URL pembayaran Midtrans Sandbox, pembaruan status pembayaran (`pending`, `success`, `failed`) dan status tagihan (`unpaid`, `pending`, `paid`) di Firestore. |
| **Acceptance Criteria** | 1. Menampilkan daftar tagihan denda praktikan beserta rincian sesi, keterlambatan, nominal denda, dan status terkini.<br>2. Pembuatan transaksi pembayaran dilakukan melalui endpoint backend; `MIDTRANS_SERVER_KEY` disimpan aman di server dan **tidak pernah ada** di kode/env klien React Native.<br>3. Aplikasi mengarahkan praktikan ke halaman/metode pembayaran Midtrans Sandbox (Snap WebView / browser terkelola).<br>4. Backend menangani callback/webhook dari Midtrans, memvalidasi `signature_key` (`SHA-512`), dan memperbarui status transaksi (`pending`, `success`, `failed`) serta status tagihan di Firestore.<br>5. Status lunas tagihan **tidak boleh** ditentukan hanya dari penutupan WebView atau klaim sisi klien, melainkan wajib menunggu hasil verifikasi backend. |
| **Dependensi** | SRS-04; Backend Serverless / Cloud Functions; Midtrans Sandbox Account; SRS-08 |
| **PIC** | Programmer 3 (P3) |
| **Status** | Belum Terverifikasi |

---

### SRS-06 — Notifikasi Siklus Pembayaran & Riwayat Pembayaran Persisten

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengintegrasikan alur denda dan pembayaran dengan sistem push notification yang telah dibangun pada Sprint 3, serta menyediakan halaman riwayat pembayaran lengkap yang persisten di database. |
| **Input** | Event pembuatan dokumen `fines`, event verifikasi webhook Midtrans di backend (`settlement`/`capture`, `pending`, `expire`/`cancel`/`deny`), dan query riwayat pembayaran per `uid` praktikan. |
| **Output** | Push notification OS + catatan in-app (`notifications`) pada 3 kondisi pembayaran; layar Riwayat Pembayaran yang persisten lintas restart aplikasi. |
| **Acceptance Criteria** | 1. Praktikan menerima pemberitahuan otomatis ketika **tagihan denda baru dibuat**.<br>2. Praktikan menerima pemberitahuan otomatis ketika **pembayaran berhasil** diverifikasi.<br>3. Praktikan menerima pemberitahuan otomatis ketika **pembayaran gagal atau membutuhkan penyelesaian lebih lanjut**.<br>4. Tersedia halaman **Riwayat Pembayaran** yang menampilkan informasi sesi, tanggal tagihan, nominal, waktu transaksi, dan status pembayaran (`pending`, `success`, `failed`).<br>5. Seluruh data riwayat pembayaran tersimpan di Cloud Firestore sehingga tetap tersedia meskipun aplikasi ditutup paksa dan dibuka kembali. |
| **Dependensi** | `notificationDispatcher` Sprint 3; SRS-04; SRS-05 |
| **PIC** | Programmer 3 (P3) |
| **Status** | Belum Terverifikasi |

---

### SRS-07 — Finalisasi Antarmuka Lintas Peran (UI/UX Polish)

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menyempurnakan seluruh layar baru maupun layar eksisting Sprint 1–3 agar memiliki tata letak, tipografi, warna, status visual, dan navigasi yang modern, konsisten, serta mudah digunakan oleh Praktikan, Asprak, dan Aslab. |
| **Input** | Pedoman desain `docs/ui-style-guide.md`, token tema `src/constants/theme.ts`, dan status peran pengguna aktif. |
| **Output** | Navigasi tab/stack yang bersih per peran (maksimal 5 item pada `FloatingPillTabBar`), transisi halus, feedback loading/empty/error yang seragam, dan ketiadaan elemen UI yang bocor antarperan. |
| **Acceptance Criteria** | 1. Bilah navigasi bawah (`FloatingPillTabBar`) menyesuaikan daftar tab secara rapi sesuai peran (`praktikan`, `asprak`, `aslab`) tanpa teks terpotong.<br>2. Seluruh layar baru (Bulk Insert Preview, Dashboard Aslab, Tagihan & Riwayat Pembayaran) menggunakan komponen standar (`AppCard`, `AppButton`, `FilterChip`, `StatusBadge`, `InfoBanner`).<br>3. Setiap aksi asinkron (upload CSV, bayar Midtrans, filter dashboard) menampilkan indikator loading dan pesan sukses/error yang informatif. |
| **Dependensi** | Seluruh SRS |
| **PIC** | Bersama (PM mengoordinasikan, P1/P2/P3 di layar masing-masing) |
| **Status** | Belum Terverifikasi |

---

### SRS-08 — Keamanan RBAC 3-Peran & Integritas Transaksi Pembayaran

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menegakkan batas kewenangan antara `praktikan`, `asprak`, `aslab`, dan `backend` melalui Cloud Firestore Security Rules serta autentikasi token pada endpoint backend. |
| **Input** | Request baca/tulis Firestore dari klien, request HTTP dari klien ke backend (dengan Bearer Firebase ID Token), dan webhook HTTP dari Midtrans (dengan `signature_key`). |
| **Output** | Penolakan akses ilegal di level database & server; jaminan keutuhan nominal dan status pembayaran. |
| **Acceptance Criteria** | 1. Firestore Security Rules membedakan helper `isPraktikan()`, `isAsprak()`, dan `isAslab()`.<br>2. Hanya `aslab` yang diizinkan membuat/mengubah konfigurasi laboratorium dan memindahkan anggota lintas laboratorium.<br>3. Klien (`praktikan`, `asprak`, maupun `aslab`) **ditolak** oleh Firestore Rules jika mencoba mengubah status pembayaran menjadi `success` atau status tagihan menjadi `paid` secara langsung dari aplikasi; mutasi lunas hanya dilakukan oleh Backend Admin SDK.<br>4. Endpoint webhook backend menolak payload dengan `signature_key` tidak valid (`HTTP 401/403`). |
| **Dependensi** | Cloud Firestore Security Rules; Firebase Admin SDK; Midtrans Signature Key |
| **PIC** | Bersama (P1: Rules Lab/Role; P2: Rules Sesi/Fines; P3: Backend Auth/Webhook & Rules Payments) |
| **Status** | Belum Terverifikasi |

---

## 6. Kebutuhan Non-Fungsional (NFR)

1. **Idempotensi Tagihan & Webhook**: Pengiriman ulang webhook yang sama oleh Midtrans (*at-least-once delivery*) tidak boleh menggandakan catatan pelunasan atau mengirim notifikasi *"Pembayaran Berhasil"* berulang kali untuk transaksi yang sudah berstatus `success`.
2. **Keamanan Kredensial**: Variabel rahasia (`MIDTRANS_SERVER_KEY`, kredensial Service Account `firebase-admin`) tidak boleh menggunakan prefiks `EXPO_PUBLIC_` dan wajib masuk ke konfigurasi rahasia server/gitignore.
3. **Kinerja Bulk Insert**: Pratinjau dan penyimpanan bulk insert hingga 100 baris praktikan/laboratorium harus tetap responsif tanpa memblokir thread UI, menggunakan `writeBatch` Firestore (maksimal 500 operasi per batch).
4. **Konsistensi Waktu**: Evaluasi keterlambatan wajib mengacu pada timestamp server atau normalisasi waktu sesi yang konsisten agar rekayasa jam lokal perangkat tidak mudah mengecoh batas denda secara ekstrem.

---

## 7. Batasan Scope

- **Dalam Scope**:
  - Peran `aslab`, pemisahan kewenangan `asprak`, dan manajemen distribusi laboratorium per mata kuliah.
  - 3 fitur bulk insert terpisah ber-template CSV + editor `ScrollView` fleksibel + fitur pindah praktikan/asprak antar lab.
  - Dashboard Aslab (operasional & keuangan denda) dengan filter hari, minggu, dan bulan.
  - Perhitungan keterlambatan *grace period*, denda nominal tetap, dan *excused absence* izin.
  - Pembayaran denda menggunakan **Midtrans Sandbox** via backend + verifikasi webhook + 3 event push notification + halaman riwayat pembayaran persisten.
- **Di Luar Scope (Out of Scope)**:
  - Perpindahan jadwal praktikum otomatis saat memindahkan praktikan/asprak (sesuai PRD Poin 1).
  - Pencairan dana asli (*production payout* / uang riil) — seluruh transaksi menggunakan lingkungan **Sandbox**.
  - Sistem cicilan denda bertahap (setiap tagihan dibayar penuh sesuai nominal tetap).
