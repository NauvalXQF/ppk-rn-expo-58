# Acceptance Criteria, Test Matrix, dan Skrip Demo — Sprint 4

Dokumen ini adalah pedoman pengujian resmi bagi **Project Manager (PM)** dan seluruh anggota tim untuk memverifikasi kelulusan **Sprint 4**. Saat ini seluruh butir pengujian berstatus **Belum Dijalankan**.

---

## 1. Traceability Kebutuhan Sprint 4

| Kebutuhan | Area Fungsional | Acceptance Criteria | Test ID | Status SRS |
| --- | --- | --- | --- | --- |
| **SRS-01** | Manajemen Lab, 3 Bulk Insert Terpisah, & Transfer Anggota (Aslab) | AC-01 | T-01 s/d T-08 | Belum Terverifikasi |
| **SRS-02** | Dashboard Keberlangsungan & Keuangan Lab + Filter Waktu | AC-02 | T-09 s/d T-13 | Belum Terverifikasi |
| **SRS-03** | Pengelolaan Sesi Real-time & Pembatasan Wewenang Asprak | AC-03 | T-14 s/d T-17 | Belum Terverifikasi |
| **SRS-04** | Perhitungan Keterlambatan (*Grace Period*), Denda, & *Excused Absence* | AC-04 | T-18 s/d T-23 | Belum Terverifikasi |
| **SRS-05** | Backend Transaksi & Webhook Midtrans Sandbox | AC-05 | T-24 s/d T-29 | Belum Terverifikasi |
| **SRS-06** | Notifikasi Pembayaran & Halaman Riwayat Pembayaran Persisten | AC-06 | T-30 s/d T-34 | Belum Terverifikasi |
| **SRS-07** | Finalisasi Antarmuka Konsisten Lintas 3 Peran | AC-07 | T-35 s/d T-36 | Belum Terverifikasi |
| **SRS-08** | Firestore Security Rules 3-Peran & Proteksi Secret Key | AC-08 | T-37 s/d T-40 | Belum Terverifikasi |

---

## 2. Kriteria Penerimaan (Given — When — Then)

### AC-01 — Manajemen Laboratorium & 3 Bulk Insert oleh Aslab
- **Given** Pengguna login dengan peran `aslab` yang bertanggung jawab atas mata kuliah PPK.
- **When** Aslab membuka menu Bulk Insert pada fitur Laboratorium, Praktikan, atau Asprak.
- **Then** Ketiga menu bulk insert tersedia secara **terpisah**, masing-masing memiliki tombol unduh template `.csv` yang valid, dan saat file diunggah seluruh baris muncul di dalam `ScrollView` yang memungkinkan Aslab melakukan *accept/deny*, mengubah teks, serta mengisi field yang kosong sebelum disimpan.
- **When** Aslab memindahkan seorang praktikan dari `Lab PPK-A` ke `Lab PPK-B`.
- **Then** Keanggotaan aktif praktikan berpindah ke `Lab PPK-B` tanpa mengubah atau memindahkan entitas jadwal praktikum.

### AC-02 — Dashboard Keberlangsungan & Keuangan Laboratorium
- **Given** Aslab berada pada layar Dashboard (`/(tabs)/dashboard`).
- **When** Aslab memilih filter **Hari**, **Minggu**, atau **Bulan**.
- **Then** Dashboard menampilkan jumlah lab & praktikan, status kegiatan tiap lab, lokasi & waktu, jadwal sedang berlangsung & akan datang, riwayat kegiatan lab, serta riwayat keuangan denda praktikum sesuai periode waktu data di Firebase.

### AC-03 — Pengelolaan Sesi & Isolasi Kewenangan Asprak
- **Given** Pengguna login sebagai `asprak` yang ditugaskan hanya pada `Lab PPK-A`.
- **When** Asprak membuka aplikasi.
- **Then** Asprak hanya melihat kelas, jadwal, sesi, dan permohonan izin dari `Lab PPK-A`, dapat membuka & menutup sesi secara real-time ke aplikasi praktikan, serta tidak dapat mengakses menu distribusi praktikan maupun konfigurasi seluruh laboratorium.

### AC-04 — Perhitungan *Grace Period*, Denda Tunggal, & *Excused Absence*
- **Given** Sesi `Lab PPK-A` dimulai pukul `10:00` dengan `gracePeriodMinutes = 15` dan `lateFineAmount = 10000`.
- **When** Praktikan A presensi pukul `10:15:00` (tepat pada batas akhir *grace period*).
- **Then** Praktikan A tercatat hadir **tepat waktu** dan **tidak** menerima tagihan denda.
- **When** Praktikan B presensi pukul `10:16:05` (melewati batas *grace period*).
- **Then** Praktikan B tercatat hadir **terlambat**, dan sistem menghasilkan **tepat satu** tagihan denda sebesar `Rp10.000` yang tertaut ke `uid`, `sessionId`, dan `attendanceId`.
- **When** Praktikan C mengajukan izin pada sesi tersebut dan disetujui (`approved`) oleh Asprak.
- **Then** Praktikan C dicatat sebagai **tidak hadir dengan izin (*excused absence*)** (bukan hadir) dan dibebaskan dari denda keterlambatan.

### AC-05 — Pembayaran Midtrans Sandbox Berbasis Backend & Webhook
- **Given** Praktikan B memiliki tagihan denda berstatus `unpaid` sebesar `Rp10.000`.
- **When** Praktikan B menekan **"Bayar Denda"** dan menyelesaikan simulasi pembayaran di halaman Midtrans Sandbox.
- **Then** Transaksi dibuat melalui backend (tanpa `MIDTRANS_SERVER_KEY` di klien), status awal tercatat `pending`, dan status baru berubah menjadi `success` (`fines.status = 'paid'`) **hanya setelah** backend menerima & memvalidasi webhook Midtrans; status kehadiran Praktikan B tetap hadir terlambat (tidak berubah).

### AC-06 — Notifikasi Pembayaran & Persistensi Riwayat Pembayaran
- **Given** Perangkat Praktikan B telah mendaftarkan token notifikasi.
- **When** Tagihan denda baru dibuat, pembayaran berhasil diverifikasi webhook, atau pembayaran gagal/kedaluwarsa.
- **Then** Praktikan B menerima push notification yang sesuai pada ketiga kondisi tersebut.
- **When** Praktikan B menutup aplikasi sepenuhnya (*force close*) lalu membuka kembali halaman Riwayat Pembayaran.
- **Then** Seluruh riwayat pembayaran (informasi sesi, tanggal tagihan, nominal, waktu transaksi, dan status pembayaran) tetap tampil utuh dari Firestore.

### AC-07 & AC-08 — Konsistensi UI & Keamanan Sistem
- **Given** Pengguna login bergantian sebagai `praktikan`, `asprak`, dan `aslab`.
- **When** Pengguna menavigasi seluruh tab utama maupun mencoba melakukan operasi lintas wewenang (misal: klien mencoba menulis `payments` langsung ke Firestore atau mengirim webhook palsu tanpa signature valid).
- **Then** Antarmuka tampil konsisten sesuai peran, sementara operasi ilegal ditolak oleh Firestore Security Rules maupun validasi signature backend.

---

## 3. Test Matrix Komprehensif Sprint 4

| Test ID | Kategori | Skenario Pengujian | Hasil yang Diharapkan | PIC | Status |
| --- | --- | --- | --- | --- | --- |
| **T-01** | Role & Auth | Login akun `aslab`, `asprak`, dan `praktikan` | Masing-masing diarahkan ke susunan tab sesuai perannya | P1/PM | Belum Dijalankan |
| **T-02** | Bulk Template | Unduh template CSV pada 3 menu bulk berbeda | Menghasilkan 3 file `.csv` berbeda untuk Lab, Praktikan, dan Asprak | P1 | Belum Dijalankan |
| **T-03** | Bulk Lab | Upload CSV 4 lab pada matkul PPK (1 baris sengaja kosong radiusnya) | Tampil 4 item di `ScrollView`; baris kosong ditandai; setelah diisi & disimpan, 4 lab masuk ke Firestore | P1 | Belum Dijalankan |
| **T-04** | Bulk Accept/Deny | Upload CSV 5 praktikan, ubah 2 baris menjadi `Deny`, ubah NIM 1 baris | Hanya 3 praktikan berstatus `Accept` yang tersimpan ke laboratorium tujuan | P1 | Belum Dijalankan |
| **T-05** | Bulk Asprak | Upload CSV daftar asprak ke `Lab PPK-A` | Penugasan asprak tercatat aktif di `labAssignments` pada `Lab PPK-A` | P1 | Belum Dijalankan |
| **T-06** | Transfer | Pindahkan praktikan dari `Lab PPK-A` ke `Lab PPK-B` | Keanggotaan di Lab A nonaktif, aktif di Lab B; jadwal praktikum tidak berubah | P1 | Belum Dijalankan |
| **T-07** | Transfer Asprak | Pindahkan asprak dari `Lab PPK-A` ke `Lab PPK-B` | Daftar sesi yang terlihat di akun Asprak berpindah mengikuti Lab B | P1/P2 | Belum Dijalankan |
| **T-08** | Kebijakan Lab | Aslab ubah radius `40m`, batas telat `10 menit`, denda `Rp15.000` | Konfigurasi tersimpan di `laboratories` dan teraplikasi pada sesi berikutnya | P1/P2 | Belum Dijalankan |
| **T-09** | Dashboard Aslab | Verifikasi angka jumlah lab & total praktikan | Angka sesuai jumlah dokumen aktif di bawah mata kuliah Aslab | P1 | Belum Dijalankan |
| **T-10** | Dashboard Aslab | Verifikasi kartu status kegiatan, lokasi, jadwal ongoing & upcoming | Sesi `open` tampil sebagai berlangsung, sesi terjadwal tampil di akan datang | P1 | Belum Dijalankan |
| **T-11** | Dashboard Aslab | Verifikasi riwayat kegiatan & riwayat keuangan denda | Menampilkan sesi selesai dan total nominal denda lunas vs belum lunas | P1 | Belum Dijalankan |
| **T-12** | Filter Dashboard | Ganti filter antara **Hari**, **Minggu**, dan **Bulan** | Data kegiatan dan rekap keuangan berubah akurat sesuai rentang tanggal | P1 | Belum Dijalankan |
| **T-13** | Isolasi Aslab | Aslab Matkul PPK melihat lab Matkul Basis Data | Lab di luar tanggung jawab mata kuliahnya tidak dapat dimodifikasi | P1 | Belum Dijalankan |
| **T-14** | Scope Asprak | Asprak `Lab PPK-A` membuka daftar kelas/jadwal/sesi | Hanya menampilkan data `Lab PPK-A`, data `Lab PPK-B` tidak muncul | P2 | Belum Dijalankan |
| **T-15** | Sesi Real-time | Asprak buka lalu tutup sesi; amati layar Praktikan | Status sesi di aplikasi praktikan berubah real-time tanpa reload manual | P2 | Belum Dijalankan |
| **T-16** | Pembatasan Asprak | Cek layar Peta & Jadwal pada akun Asprak | Tombol konfigurasi seluruh lab & distribusi praktikan tidak tersedia & ditolak Rules | P2/P1 | Belum Dijalankan |
| **T-17** | Kelola Presensi | Asprak melihat daftar hadir sesi di detail sesi | Menampilkan pembeda jelas antara tepat waktu, terlambat, dan izin (*excused*) | P2 | Belum Dijalankan |
| **T-18** | Grace Period | Praktikan presensi sebelum/tepat akhir *grace period* | Tercatat `on_time`, tidak ada dokumen di koleksi `fines` | P2 | Belum Dijalankan |
| **T-19** | Denda Otomatis | Praktikan presensi 1 menit setelah *grace period* berakhir | Tercatat `late`, terbit dokumen `fines/{sessionId}_{uid}` dengan nominal tetap | P2 | Belum Dijalankan |
| **T-20** | Anti-Duplikasi Denda | Simulasi retry/double trigger pada keterlambatan sesi yang sama | Tetap hanya ada **1 dokumen tagihan** untuk pasangan `(sessionId, uid)` tersebut | P2 | Belum Dijalankan |
| **T-21** | Relasi Tagihan | Inspeksi dokumen `fines/{fineId}` di Firestore | Memuat `uid`, `sessionId`, dan `attendanceId` yang valid | P2 | Belum Dijalankan |
| **T-22** | Imutabilitas Hadir | Tagihan denda dilunasi hingga berstatus `paid` | Catatan kehadiran praktikan tidak berubah (tetap hadir dengan penanda terlambat) | P2/P3 | Belum Dijalankan |
| **T-23** | Excused Absence | Asprak menyetujui (`approved`) izin praktikan pada sesi X | Status riwayat = `Izin (Tidak Hadir dengan Izin)` (bukan hadir) & bebas denda | P2 | Belum Dijalankan |
| **T-24** | Keamanan Key | Pindai seluruh file di `src/` dan `.env` klien | Tidak ditemukan `MIDTRANS_SERVER_KEY` di sisi aplikasi React Native | P3/PM | Belum Dijalankan |
| **T-25** | Create Transaksi | Praktikan ketuk Bayar pada tagihan `Rp10.000` | Backend mengembalikan Snap URL Sandbox; transaksi tercatat `pending` | P3 | Belum Dijalankan |
| **T-26** | Tutup WebView Dini | Praktikan tutup halaman Snap sebelum membayar | Status tetap `pending` (tidak lunas palsu); dapat dilanjutkan kembali | P3 | Belum Dijalankan |
| **T-27** | Webhook Sukses | Bayar via Midtrans Payment Simulator (`settlement`) | Backend memvalidasi signature, `payments.status = 'success'`, `fines.status = 'paid'` | P3 | Belum Dijalankan |
| **T-28** | Webhook Gagal | Transaksi dibatalkan / kedaluwarsa (`expire`/`cancel`) | `payments.status = 'failed'`, `fines.status = 'unpaid'`, tombol bayar ulang aktif | P3 | Belum Dijalankan |
| **T-29** | Webhook Palsu | Kirim HTTP POST ke endpoint webhook dengan `signature_key` salah | Backend menolak dengan HTTP `401/403`, data Firestore tidak berubah | P3 | Belum Dijalankan |
| **T-30** | Notif Denda Baru | Praktikan melakukan presensi terlambat | Praktikan menerima notifikasi *"Tagihan Denda Baru Dibuat"* | P3/P2 | Belum Dijalankan |
| **T-31** | Notif Bayar Sukses | Webhook `settlement` diterima backend | Praktikan menerima notifikasi *"Pembayaran Denda Berhasil"* | P3 | Belum Dijalankan |
| **T-32** | Notif Bayar Gagal | Webhook `expire` / `cancel` diterima backend | Praktikan menerima notifikasi kegagalan / instruksi penyelesaian lanjut | P3 | Belum Dijalankan |
| **T-33** | Riwayat Pembayaran | Buka tab Riwayat Pembayaran pada akun Praktikan | Menampilkan sesi, tanggal tagihan, nominal, waktu transaksi, dan status | P3 | Belum Dijalankan |
| **T-34** | Persistensi Riwayat | Tutup paksa aplikasi (*kill app*), buka kembali Riwayat Pembayaran | Seluruh data riwayat pembayaran tetap muncul lengkap dari Firestore | P3 | Belum Dijalankan |
| **T-35** | Konsistensi UI | Periksa seluruh layar baru (`Dashboard`, `Kelola Lab`, `Denda`, `Checkout`) terhadap [ui-style-guide.md](../ui-style-guide.md) | Memakai `theme.ts` (zero hex hardcode), font Outfit, glass card/white sheet `Radius >= 20`, aksen tunggal charcoal `#2B2E35`, floating pill nav 5 tab lega | Semua | Belum Dijalankan |
| **T-36** | Regresi Sprint 1–3 | Uji geofence Haversine, peta Leaflet, dan klasifikasi izin AI lokal | Seluruh fitur Sprint 1–3 tetap berfungsi tanpa regresi | Semua | Belum Dijalankan |
| **T-37** | Security Rules | Klien praktikan mencoba `updateDoc` langsung `fines.status = 'paid'` | Ditolak `permission-denied` oleh Cloud Firestore Security Rules | P3/PM | Belum Dijalankan |
| **T-38** | Kualitas Kode | Jalankan `npx expo lint` dan `npx tsc --noEmit` | 0 error lint, 0 error kompilasi TypeScript | Semua | Belum Dijalankan |

---

## 4. Checklist QA Visual ("Soft Glass Pastel" — [ui-style-guide.md](../ui-style-guide.md))

- [ ] Seluruh layar overview (`Dashboard Aslab`, `Denda & Riwayat`) menggunakan `ScreenContainer variant="gradient"` (`Gradients.screen`) dan `AppCard variant="glass"` (`Radius.lg` = 28).
- [ ] Seluruh modal (`BulkInsertModal`, `MemberTransferModal`) dan checkout memakai **White Sheet** (`Radius.xl` = 32 di sudut atas) dengan drag handle `Colors.handle`.
- [ ] Seluruh teks pada layar baru menggunakan `FontFamily` (**Outfit**), tanpa font sistem bawaan tersisa.
- [ ] Hanya satu warna aksi utama charcoal (`Colors.primary: #2B2E35`); seluruh status (`Terlambat`, `Izin`, `Pending`, `Success`, `Failed`, `Accept`, `Deny`) memakai token soft (`successSoft`/`warningSoft`/`dangerSoft`/`neutralSoft`).
- [ ] Tidak ada warna hex hardcode baru di `src/features/` maupun `src/app/`.
- [ ] `FloatingPillTabBar` memuat maksimal 5 tab per peran dengan `paddingBottom >= 96` dan touch target `>= 44×44` yang aman pada layar ponsel kecil (`360dp`).

---

## 5. Lembar Verifikasi Hasil Pengujian (Sign-Off Sheet)

| Butir Evaluasi | Kriteria Kelulusan Utama | Bukti Pengujian Aktual | Status Akhir |
| --- | --- | --- | --- |
| **Manajemen Lab & 3 Bulk Insert (Aslab)** | 3 bulk terpisah ber-template CSV, editor `ScrollView` (accept/deny/edit/isi kosong), & transfer anggota berjalan | Belum dieksekusi | Belum Terverifikasi |
| **Dashboard Lab & Keuangan (Aslab)** | Menampilkan kegiatan, riwayat, & keuangan denda dengan filter hari/minggu/bulan dari Firebase | Belum dieksekusi | Belum Terverifikasi |
| **Pengelolaan Sesi Terfokus (Asprak)** | Buka/tutup sesi real-time berjalan; akses dibatasi hanya pada kelas/lab tanggung jawabnya | Belum dieksekusi | Belum Terverifikasi |
| **Grace Period, Denda & Izin** | Keterlambatan menghasilkan 1 tagihan tetap, bayar tidak ubah hadir, izin `approved` = *excused absence* bebas denda | Belum dieksekusi | Belum Terverifikasi |
| **Midtrans Sandbox & Webhook** | Alur client–backend–Midtrans Sandbox berjalan; status lunas diverifikasi webhook bertanda tangan valid | Belum dieksekusi | Belum Terverifikasi |
| **Notifikasi & Riwayat Pembayaran** | Notifikasi terbit untuk denda baru/sukses/gagal; halaman riwayat persisten setelah aplikasi ditutup-buka | Belum dieksekusi | Belum Terverifikasi |
| **Finalisasi UI & Kualitas Kode** | UI konsisten di 3 peran, `npx expo lint` & `npx tsc --noEmit` lulus 0 error | Belum dieksekusi | Belum Terverifikasi |
