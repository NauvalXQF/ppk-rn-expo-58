# Acceptance Criteria, Test Matrix, dan Skrip Demo — Sprint 3

Dokumen ini adalah pedoman pengujian resmi bagi **Project Manager (PM)** dan seluruh tim untuk memverifikasi fungsionalitas **Sprint 3**. Seluruh checklist, test matrix, dan skrip demo pada dokumen ini berstatus **Belum Dijalankan** sampai implementasi selesai diuji.

---

## 1. Traceability Kebutuhan

| Kebutuhan | Area Fungsional | Acceptance Criteria | Test ID | Status SRS |
| --- | --- | --- | --- | --- |
| **SRS-01** | Halaman Presensi Khusus | AC-01 | T-01 s/d T-04 | Belum Terverifikasi |
| **SRS-02** | Validasi Geofence & Radius | AC-02 | T-05 s/d T-09 | Belum Terverifikasi |
| **SRS-03** | Pengelolaan Data Lab | AC-03 | T-10 s/d T-13 | Belum Terverifikasi |
| **SRS-04** | Peta Interaktif & Live Tracking | AC-04 | T-14 s/d T-17 | Belum Terverifikasi |
| **SRS-05** | Informasi Aktivitas Lab Real-time | AC-05 | T-18 s/d T-21 | Belum Terverifikasi |
| **SRS-06** | Push Notification Berbasis Event | AC-06 | T-22 s/d T-25 | Belum Terverifikasi |
| **SRS-07** | Manajemen Token Perangkat | AC-07 | T-26 s/d T-28 | Belum Terverifikasi |
| **SRS-08** | Izin Perangkat & Security Rules | AC-08 | T-29 s/d T-32 | Belum Terverifikasi |

---

## 2. Kriteria Penerimaan (Given — When — Then)

### AC-01 — Halaman Presensi Khusus
- **Given** Praktikan terdaftar pada kelas praktikum yang memiliki sesi aktif.
- **When** Praktikan membuka halaman presensi khusus (`/presensi/[sesiId]`).
- **Then** Informasi sesi (mata kuliah, kelas, topik, lab, status sesi) tampil lengkap, tombol presensi aktif jika sesi berstatus `open`, dan tombol dinonaktifkan jika sesi `closed` atau `dijadwalkan`.

### AC-02 — Validasi Geofence & Radius Laboratorium
- **Given** Praktikan berada di dalam radius toleransi laboratorium sesi ($\text{jarak} \le \text{radiusLab}$) dan sesi sedang `open`.
- **When** Praktikan mengonfirmasi presensi kehadiran.
- **Then** Presensi berhasil dicatat ke Firestore beserta koordinat GPS dan jarak terhitung; rekap kehadiran asisten bertambah seketika.
- **Given** Praktikan berada di luar radius laboratorium ($\text{jarak} > \text{radiusLab}$).
- **When** Praktikan mencoba menekan tombol presensi.
- **Then** Tombol dinonaktifkan atau presensi ditolak dengan pesan visual: *"Anda berada di luar radius laboratorium (jarak: X meter, batas: Y meter)"*; tidak ada dokumen presensi baru di Firestore.

### AC-03 — Pengelolaan Data Laboratorium oleh Asisten
- **Given** Asisten yang terautentikasi membuka modal/form kelola lab.
- **When** Asisten memasukkan nama lab, gedung, koordinat latitude/longitude valid, dan radius toleransi (10–500 meter).
- **Then** Data laboratorium tersimpan di Firestore koleksi `laboratories`, tampil pada daftar lab, dan titik geofence langsung aktif.
- **When** Pengguna praktikan mencoba mengubah atau menghapus data laboratorium.
- **Then** Operasi ditolak oleh antarmuka dan ditolak oleh Cloud Firestore Security Rules.

### AC-04 — Peta Laboratorium Interaktif & Live Tracking
- **Given** Pengguna membuka tab Peta (`/(tabs)/peta`) dan mengizinkan akses lokasi.
- **When** Peta dimuat dan pengguna bergerak di sekitar lingkungan kampus.
- **Then** Peta menampilkan marker seluruh laboratorium aktif, visualisasi lingkaran radius geofence (*Circle overlay*), dan marker posisi pengguna yang berpindah secara mulus mengikuti pergerakan perangkat.

### AC-05 — Informasi Aktivitas Laboratorium Real-time
- **Given** Pengguna berada di layar Peta.
- **When** Pengguna mengetuk salah satu marker laboratorium.
- **Then** Tampil bottom sheet berisi detail lab, praktikum yang sedang berlangsung (*ongoing session* dengan badge hijau), dan 1–3 jadwal praktikum berikutnya (*upcoming sessions*).
- **When** Asisten membuka sesi praktikum baru pada lab tersebut.
- **Then** Status pada bottom sheet otomatis berubah menjadi *"Sedang Berlangsung"* tanpa perlu memuat ulang (*refresh*) peta.

### AC-06 — Push Notification Berbasis Peristiwa
- **Given** Perangkat praktikan telah mendaftarkan token notifikasi.
- **When** Asisten membuka sesi praktikum kelas terkait.
- **Then** Perangkat praktikan menerima push notification: *"Sesi Praktikum Dibuka: [Topik]"*.
- **When** Asisten mengubah jadwal atau ruang lab.
- **Then** Praktikan kelas terkait menerima notifikasi perubahan jadwal.
- **When** Asisten menyetujui atau menolak pengajuan izin praktikan.
- **Then** Praktikan pemohon menerima notifikasi keputusan izin beserta catatan asisten.
- **When** Notifikasi diketuk oleh pengguna.
- **Then** Aplikasi terbuka dan mengarahkan pengguna langsung ke layar terkait (*deep linking*).

### AC-07 — Manajemen Token Perangkat & Penargetan Notifikasi
- **Given** Pengguna melakukan login ke dalam aplikasi.
- **When** Izin notifikasi diberikan.
- **Then** Token perangkat tersimpan pada Firestore di bawah dokumen UID pengguna aktif (`users/{uid}/devices/{token}`).
- **When** Pengguna melakukan logout.
- **Then** Token perangkat dihapus dari Firestore agar perangkat tidak lagi menerima notifikasi milik akun tersebut.

### AC-08 — Penanganan Izin Perangkat, Error, dan Keamanan
- **Given** Izin lokasi atau notifikasi ditolak oleh pengguna, atau layanan GPS mati.
- **When** Pengguna membuka halaman presensi atau peta.
- **Then** Aplikasi menampilkan instruksi penanganan yang jelas (banner bantuan untuk mengaktifkan izin/GPS) tanpa mengalami crash atau freeze.
- **When** Permintaan presensi dikirim dengan koordinat palsu di luar radius atau manipulasi UID.
- **Then** Firestore Security Rules menggagalkan transaksi penulisan tersebut.

---

## 3. Prasyarat Pengujian dan Data Uji

1. **Perangkat Pengujian**:
   - Disarankan menggunakan minimal **2 perangkat fisik** atau 1 perangkat fisik + 1 emulator/simulator dengan fitur *Location Mocking* (GPX playback / set location).
   - Perangkat A: Akun Asisten (`asisten@test.com`).
   - Perangkat B: Akun Praktikan Kelas A (`praktikanA@test.com`).
   - Perangkat C (opsional): Akun Praktikan Kelas B (`praktikanB@test.com`) untuk uji isolasi notifikasi.
2. **Titik Koordinat Data Uji Laboratorium Informatika**:
   - **Lab AI & Robotika**: `lat: -6.175392`, `lng: 106.827153`, `radius: 30 meter` (Gedung Informatika Lt. 3).
   - **Lab Rekayasa Perangkat Lunak**: `lat: -6.175850`, `lng: 106.827400`, `radius: 25 meter` (Gedung Informatika Lt. 2).
   - **Lab Jaringan & Keamanan Siber**: `lat: -6.176200`, `lng: 106.826900`, `radius: 35 meter` (Gedung Informatika Lt. 1).
3. **Simulasi Titik Praktikan**:
   - **Uji Dalam Radius (Valid)**: Praktikan berada pada jarak $\approx 8$ meter dari titik Lab AI (`lat: -6.175440`, `lng: 106.827180`).
   - **Uji Luar Radius (Invalid)**: Praktikan berada pada jarak $\approx 150$ meter di luar gedung (`lat: -6.176500`, `lng: 106.828000`).

---

## 4. Test Matrix Komprehensif

| Test ID | Kategori | Skenario Pengujian | Langkah Konkret | Hasil yang Diharapkan | PIC | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **T-01** | Presensi UI | Buka halaman presensi khusus | Praktikan buka rute `/presensi/[sesiId]` dari sesi kelasnya | Info sesi, status sesi, dan kartu lokasi tampil | P2 | Belum Dijalankan |
| **T-02** | Presensi UI | Sesi berstatus `closed` | Praktikan buka halaman presensi pada sesi yang belum dibuka/ditutup | Tombol presensi dinonaktifkan, badge status `Ditutup` | P2 | Belum Dijalankan |
| **T-03** | Presensi UI | Sudah pernah presensi | Praktikan buka halaman presensi yang sudah ia hadiri | Menampilkan status "Anda Sudah Hadir", tombol terkunci | P2 | Belum Dijalankan |
| **T-04** | Presensi QR | Mode fallback QR Code | Asisten buka QR, praktikan scan QR sesi pada halaman presensi | Token QR tervalidasi, presensi berhasil tercatat | P2 | Belum Dijalankan |
| **T-05** | Geofence | Presensi dalam radius sah | Praktikan dalam radius lab ($\le 30\text{m}$) menekan tombol presensi | Presensi berhasil, waktu server & koordinat tersimpan | P2 | Belum Dijalankan |
| **T-06** | Geofence | Presensi luar radius | Praktikan di luar radius lab ($> 30\text{m}$) mencoba presensi | Ditolak; tampil pesan jarak aktual & batas maksimal | P2 | Belum Dijalankan |
| **T-07** | Geofence | GPS mati saat presensi | Nonaktifkan layanan GPS perangkat, tekan tombol presensi | Muncul banner instruksi untuk menyalakan GPS | P2 | Belum Dijalankan |
| **T-08** | Geofence | Izin lokasi ditolak | Tolak izin lokasi saat diminta, buka halaman presensi | Tampil empty state izin lokasi ditolak & tombol setting | P2 | Belum Dijalankan |
| **T-09** | Geofence | Presensi ganda bersamaan | Dua request presensi bersamaan dari akun UID yang sama | Tepat satu dokumen yang tersimpan, tidak ada duplikasi | P2/P1 | Belum Dijalankan |
| **T-10** | Lab CRUD | Tambah laboratorium baru | Asisten input data lab, koordinat lat/lng, dan radius 30m | Lab tersimpan di Firestore dan muncul di daftar lab | P3 | Belum Dijalankan |
| **T-11** | Lab CRUD | Validasi batas koordinat | Input latitude $95.0$ atau longitude $-190.0$ | Input ditolak dengan validasi pesan error | P3 | Belum Dijalankan |
| **T-12** | Lab CRUD | Validasi batas radius | Input radius 5 meter ($<10$) atau 600 meter ($>500$) | Ditolak; batas radius wajib antara 10 s/d 500 meter | P3 | Belum Dijalankan |
| **T-13** | Lab CRUD | Hak akses praktikan | Akun praktikan mencoba akses endpoint/form kelola lab | Akses ditolak oleh antarmuka dan Firestore Security Rules | P3/P1 | Belum Dijalankan |
| **T-14** | Peta UI | Render peta interaktif | Buka tab Peta `/(tabs)/peta` dengan izin lokasi aktif | Peta tampil lancar, kontrol pan/zoom responsif | P3 | Belum Dijalankan |
| **T-15** | Peta UI | Marker lab & circle overlay | Amati titik-titik lab di peta Informatika | Marker lab tampil jelas disertai lingkaran radius transparan | P3 | Belum Dijalankan |
| **T-16** | Peta UI | Live tracking pengguna | Pengguna berjalan berpindah posisi saat membuka tab Peta | Titik biru posisi pengguna berpindah mengikuti lokasi fisik | P3 | Belum Dijalankan |
| **T-17** | Peta UI | Tombol recenter kamera | Geser peta menjauhi posisi, tekan tombol recenter | Kamera peta otomatis menganimasikan fokus ke posisi user | P3 | Belum Dijalankan |
| **T-18** | Aktivitas Lab | Ketuk marker lab aktif | Ketuk marker lab yang memiliki sesi praktikum `open` | Bottom sheet tampil; sesi berbadge hijau "Sedang Berlangsung" | P3 | Belum Dijalankan |
| **T-19** | Aktivitas Lab | Ketuk marker lab kosong | Ketuk marker lab yang tidak ada praktikum aktif | Keterangan "Tidak ada praktikum aktif", jadwal berikutnya tampil | P3 | Belum Dijalankan |
| **T-20** | Aktivitas Lab | Perubahan status sesi real-time | Asisten buka sesi di lab X saat praktikan melihat sheet lab X | Status di sheet otomatis berubah jadi "Dibuka" tanpa refresh | P3 | Belum Dijalankan |
| **T-21** | Aktivitas Lab | Tombol cepat ke presensi | Praktikan kelas terkait tekan "Masuk Presensi" di sheet | Navigasi langsung menuju rute `/presensi/[sesiId]` | P3/P2 | Belum Dijalankan |
| **T-22** | Notifikasi | Event sesi dibuka | Asisten membuka sesi kelas A pada perangkat 1 | Perangkat praktikan kelas A menerima push notifikasi | P1 | Belum Dijalankan |
| **T-23** | Notifikasi | Isolasi kelas notifikasi | Asisten buka sesi kelas A; cek perangkat praktikan kelas B | Praktikan kelas B **tidak** menerima notifikasi kelas A | P1 | Belum Dijalankan |
| **T-24** | Notifikasi | Event jadwal berubah | Asisten ubah ruang/waktu sesi pada jadwal | Seluruh praktikan kelas terkait menerima notifikasi perubahan | P1 | Belum Dijalankan |
| **T-25** | Notifikasi | Event keputusan izin | Asisten menerima/menolak pengajuan izin praktikan U | Perangkat praktikan U menerima notifikasi hasil keputusan | P1 | Belum Dijalankan |
| **T-26** | Notifikasi | Deep linking interaktif | Praktikan mengetuk notifikasi "Sesi Dibuka" di OS tray | Aplikasi terbuka dan langsung menuju halaman presensi sesi | P1 | Belum Dijalankan |
| **T-27** | Device Token | Pendaftaran token login | Praktikan login ke aplikasi dan setujui izin notifikasi | Token perangkat tercatat di `users/{uid}/devices` | P1 | Belum Dijalankan |
| **T-28** | Device Token | Pembersihan token logout | Praktikan melakukan logout dari aplikasi | Token perangkat dihapus dari Firestore `users/{uid}/devices` | P1 | Belum Dijalankan |
| **T-29** | Error State | Sinyal GPS lemah ($>50\text{m}$) | Simulasikan akurasi GPS buruk pada perangkat | Muncul indikator kuning memperingatkan akurasi rendah | P2 | Belum Dijalankan |
| **T-30** | Lifecycle | Cleanup location watcher | Pengguna keluar dari tab Peta ke tab lain | Background GPS watcher langsung dinonaktifkan (hemat baterai) | P3 | Belum Dijalankan |
| **T-31** | Regresi | Integritas data Sprint 2 | Uji login, CRUD sesi, rekap asisten, dan model AI lokal | Seluruh fitur Sprint 2 berjalan normal tanpa error | Semua | Belum Dijalankan |
| **T-32** | Kode | Lint dan Typecheck | Jalankan `tsc --noEmit` dan `eslint src` | 0 error TypeScript, 0 error ESLint | Semua | Belum Dijalankan |

---

## 5. Tiga Skrip Demo Pengujian Utama

### Demo 1 — Presensi Berbasis Lokasi & Geofence
*Tujuan: Membuktikan bahwa praktikan hanya dapat presensi jika sesi dibuka DAN berada di dalam radius laboratorium.*

1. **Persiapan Asisten (Perangkat A)**:
   - Asisten login, masuk ke Jadwal → Buka detail sesi Lab AI.
   - Tekan tombol **"Buka Sesi"** dan konfirmasi. Status sesi menjadi `Dibuka`.
2. **Uji Negatif Praktikan di Luar Radius (Perangkat B)**:
   - Praktikan login, buka halaman `/presensi/[sesiId]`.
   - Perangkat B berada di luar gedung lab (jarak $\approx 150$ meter).
   - Layar menampilkan: *"Status Lokasi: Di Luar Radius (150m / Batas 30m)"*.
   - Tombol *"Kirim Presensi Kehadiran"* terkunci (*disabled*). Upaya manipulasi request ditolak server.
3. **Uji Positif Praktikan di Dalam Radius (Perangkat B)**:
   - Praktikan bergerak mendekati ruangan lab hingga jarak terhitung $\le 30$ meter.
   - Status kartu lokasi berubah menjadi hijau: *"Status Lokasi: Di Dalam Radius (12m / Batas 30m)"*.
   - Tombol *"Kirim Presensi Kehadiran"* menjadi aktif. Praktikan menekan tombol.
4. **Verifikasi Server & Rekapitulasi**:
   - Sistem mencatat dokumen presensi ke Firestore beserta data `latitude`, `longitude`, `distanceMeters`, dan waktu server.
   - Pada layar Perangkat A (Asisten), baris kehadiran praktikan bertambah seketika secara real-time.
   - Praktikan mencoba menekan kembali: sistem menolak karena sudah presensi.

---

### Demo 2 — Peta Interaktif & Informasi Aktivitas Laboratorium
*Tujuan: Membuktikan eksplorasi peta, live user tracking, dan pembaruan aktivitas lab real-time.*

1. **Buka Tab Peta (Perangkat B)**:
   - Pengguna membuka tab **Peta** pada bilah navigasi bawah.
   - Peta interaktif memuat wilayah kampus dengan marker seluruh laboratorium aktif.
2. **Visualisasi Marker & Geofence**:
   - Tunjukkan marker kustom pada masing-masing laboratorium Informatika.
   - Tunjukkan lingkaran transparan (*Circle overlay*) yang memvisualisasikan radius toleransi geofence lab.
   - Tunjukkan titik biru posisi pengguna yang bergerak saat pengguna berjalan.
3. **Eksplorasi Aktivitas Laboratorium**:
   - Pengguna mengetuk marker *Laboratorium AI*.
   - Bottom sheet terbuka menampilkan: Nama Lab, Gedung Informatika Lt. 3, status *"Sedang Berlangsung"* (Sesi Praktikum Komponen & Layout), jam pelaksanaan, dan nama asisten.
   - Tunjukkan pula jadwal praktikum berikutnya pada lab tersebut.
4. **Sinkronisasi Real-time Tanpa Refresh**:
   - Asisten pada Perangkat A menutup sesi praktikum tersebut.
   - Seketika badge status sesi di bottom sheet Perangkat B berubah menjadi *"Selesai"* tanpa perlu menyegarkan layar peta.
   - Praktikan dapat menekan tombol pintas untuk langsung membuka layar presensi.

---

### Demo 3 — Push Notification Kegiatan Praktikum
*Tujuan: Membuktikan pengiriman push notification otomatis pada 3 peristiwa kegiatan.*

1. **Registrasi Perangkat**:
   - Praktikan login di Perangkat B, menyetujui izin notifikasi. Token perangkat tercatat di Firestore `users/{uid}/devices`.
   - Praktikan meminimalkan aplikasi ke latar belakang (*background*).
2. **Pengujian Notifikasi 1 — Sesi Dibuka**:
   - Asisten di Perangkat A membuka sesi praktikum baru.
   - Perangkat B menerima push notification: *"Sesi Praktikum Dibuka: Komponen & Layout — Silakan lakukan presensi di lab"*.
   - Praktikan mengetuk notifikasi: aplikasi terbuka langsung mengarahkan ke halaman presensi sesi tersebut.
3. **Pengujian Notifikasi 2 — Perubahan Jadwal**:
   - Asisten di Perangkat A memperbarui ruang atau jam sesi.
   - Perangkat B menerima push notification: *"Perubahan Jadwal: Praktikum dipindahkan ke Lab RPL"*.
4. **Pengujian Notifikasi 3 — Keputusan Izin**:
   - Praktikan mengajukan izin; asisten di Perangkat A mengonfirmasi **"Terima Izin"** dengan catatan *"Disetujui, semoga lekas sembuh"*.
   - Perangkat B menerima push notification: *"Pengajuan Izin Disetujui: Disetujui, semoga lekas sembuh"*.
   - Mengetuk notifikasi langsung membuka tab Izin riwayat permohonan.

---

## 6. Lembar Verifikasi Hasil Pengujian (Sign-Off Sheet)

| Butir Evaluasi | Kriteria Kelulusan | Bukti Pengujian Aktual | Status Akhir |
| --- | --- | --- | --- |
| **Validasi Geofence** | Presensi di luar radius tertolak; di dalam radius tersimpan dengan koordinat valid | Belum dieksekusi | Belum Terverifikasi |
| **Peta & Live Tracking** | Marker lab, radius circle, dan pergerakan posisi user tampil responsif | Belum dieksekusi | Belum Terverifikasi |
| **Aktivitas Lab** | Menampilkan sesi ongoing & upcoming yang tersinkronisasi real-time | Belum dieksekusi | Belum Terverifikasi |
| **Push Notification** | Notifikasi terkirim tepat sasaran pada event buka sesi, jadwal, dan izin | Belum dieksekusi | Belum Terverifikasi |
| **Penanganan Error** | GPS mati atau izin ditolak menampilkan panduan ramah tanpa crash | Belum dieksekusi | Belum Terverifikasi |
| **Kualitas Kode** | `tsc --noEmit` = 0 error, `eslint` = 0 error, unit test lulus 100% | Belum dieksekusi | Belum Terverifikasi |

*Catatan: Seluruh hasil aktual diisi secara objektif oleh Project Manager (PM) setelah fase eksekusi pengujian selesai.*
