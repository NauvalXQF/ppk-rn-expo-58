# PRD dan SRS — Sprint 3: Lokasi, Peta Interaktif, dan Push Notification

## 1. Informasi Dokumen

| Item | Isi |
| --- | --- |
| Produk | Aplikasi Pengelolaan dan Presensi Praktikum, Lanjutan Sprint 2 |
| Sprint | Sprint 3 — Lokasi, Peta Interaktif, dan Push Notification |
| Versi Dokumen | 1.0 |
| Status | Rancangan Resmi; Seluruh SRS **Belum Terverifikasi** |
| Pemilik | Project Manager (PM) |
| Tanggal Penyusunan | 19 November 2026 |
| Target Platform | Android dan iOS (Expo Development Client / EAS Build) |
| Layanan Terintegrasi | Firebase Auth, Cloud Firestore, Geolocation (`expo-location`), Maps (`react-native-maps`), Push Notification (`expo-notifications` / FCM) |

Dokumen ini mendefinisikan seluruh kebutuhan fungsional dan non-fungsional Sprint 3. Detail arsitektur teknis dibahas pada [arsitektur.md](./arsitektur.md), skema data pada [data-model.md](./data-model.md), antarmuka pada [navigasi-ui.md](./navigasi-ui.md), dan kriteria pengujian pada [acceptance-criteria.md](./acceptance-criteria.md).

---

## 2. Latar Belakang dan Problem Statement

Pada Sprint 2, aplikasi telah berhasil mengintegrasikan autentikasi multi-peran dan persistensi Cloud Firestore. Pengelolaan sesi, pencatatan presensi dasar, serta alur pengajuan dan pemeriksaan izin (dengan dukungan klasifikasi AI lokal) telah berjalan secara real-time.

Namun, terdapat dua celah kritis operasional:
1. **Presensi Belum Terikat Lokasi Fisik**: Praktikan dapat melakukan presensi dari mana saja di luar laboratorium selama asisten membuka sesi. Hal ini membuka risiko kecurangan absensi tanpa kehadiran fisik di laboratorium praktikum.
2. **Ketergantungan pada Pengecekan Manual di Aplikasi**: Pengguna harus membuka aplikasi secara berkala untuk mengetahui apakah sesi praktikum telah dibuka oleh asisten, apakah jadwal praktikum berpindah waktu/ruang, atau apakah pengajuan izin ketidakhadiran telah disetujui atau ditolak oleh asisten.

**Solusi Sprint 3**: Mengimplementasikan validasi lokasi presensi berbasis geofencing radius laboratorium, peta persebaran laboratorium Informatika yang interaktif dengan informasi aktivitas praktikum real-time, serta sistem push notification otomatis berbasis peristiwa kegiatan.

---

## 3. Target Pengguna dan User Stories

| Pengguna | Kebutuhan Utama | SRS Terkait |
| --- | --- | --- |
| **Praktikan** | Membuka halaman presensi khusus, memverifikasi lokasi di dalam radius lab, presensi sekali saat sesi open, memantau posisi di peta lab, dan menerima notifikasi saat sesi dibuka/jadwal berubah/izin diputuskan | SRS-01, SRS-02, SRS-04, SRS-05, SRS-06, SRS-07, SRS-08 |
| **Asisten** | Mengelola titik koordinat dan radius lab, membuka sesi, memantau rekap kehadiran berbasis lokasi, melihat aktivitas lab di peta, serta memicu notifikasi otomatis ke praktikan saat membuka sesi/mengubah jadwal/memutus izin | SRS-01, SRS-03, SRS-04, SRS-05, SRS-06, SRS-07, SRS-08 |
| **Project Manager** | Mengatur pembagian kerja, menyelaraskan kontrak data lokasi & payload notifikasi, mereview integrasi kode, dan memverifikasi tiga alur demo | Seluruh SRS |

### User Stories
- *Sebagai praktikan*, saya ingin melakukan presensi di halaman khusus yang memeriksa koordinat GPS saya terhadap laboratorium, agar kehadiran saya tercatat secara sah dan transparan.
- *Sebagai praktikan*, saya ingin melihat peta persebaran laboratorium beserta informasi praktikum yang sedang berlangsung dan yang berikutnya, agar saya mengetahui lokasi dan jadwal sesi praktikum di lingkungan Informatika.
- *Sebagai praktikan*, saya ingin menerima push notification langsung di ponsel ketika sesi dibuka oleh asisten atau ketika pengajuan izin saya telah diputuskan, agar saya tidak perlu terus-menerus membuka aplikasi secara manual.
- *Sebagai asisten*, saya ingin menentukan titik koordinat laboratorium dan radius toleransi presensi, agar hanya praktikan yang benar-benar hadir di dalam ruangan lab yang dapat mencatatkan kehadiran.
- *Sebagai asisten*, saya ingin sistem secara otomatis mengirimkan pemberitahuan push ke seluruh praktikan kelas ketika saya membuka sesi atau memperbarui jadwal, agar informasi tersampaikan seketika.

---

## 4. Software Requirements Specification (SRS)

### SRS-01 — Halaman Presensi Khusus & Integrasi Sesi

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menyediakan halaman presensi khusus yang terpisah dari halaman detail sesi. Praktikan dapat melihat ringkasan sesi yang diikuti, status sesi saat ini, status verifikasi lokasi, dan tombol konfirmasi presensi. (Fitur opsional: pemindaian QR Code sesi). |
| **Input** | `sessionId`, identitas praktikan dari Firebase Auth, pilihan sesi aktif dari kelas praktikan. |
| **Output** | Tampilan kartu informasi sesi (topik, kelas, ruang lab, jadwal, status sesi), status kesiapan lokasi, tombol presensi, dan status kehadiran. |
| **Acceptance Criteria** | 1. Halaman presensi dapat dibuka melalui navigasi atau tautan dari jadwal/detail sesi.<br>2. Menampilkan informasi sesi praktikum dan status sesi secara real-time (`dijadwalkan`, `dibuka`, `ditutup`).<br>3. Tombol presensi hanya aktif jika sesi berstatus `dibuka` dan praktikan belum tercatat presensi pada sesi tersebut.<br>4. Menolak presensi jika sesi berstatus `dijadwalkan` atau `ditutup`.<br>5. *(Opsional)* Jika mode QR Code diaktifkan, praktikan dapat memindai token QR yang ditampilkan asisten untuk validasi tambahan. |
| **Dependensi** | Kontrak sesi & kelas Sprint 2; SRS-02; SRS-08 |
| **PIC** | Programmer 2 (P2) |
| **Status** | Belum Terverifikasi |

---

### SRS-02 — Validasi Lokasi Presensi (Geofencing Radius Laboratorium)

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengambil koordinat GPS perangkat praktikan menggunakan layanan Geolocation, menghitung jarak garis lurus (*Haversine Formula*) terhadap koordinat laboratorium praktikum, dan memastikan praktikan berada di dalam radius toleransi yang diizinkan sebelum presensi dicatat. |
| **Input** | Koordinat perangkat praktikan (`latitude`, `longitude`, `accuracy`), koordinat laboratorium sesi (`latitude`, `longitude`), dan radius lab (`radiusMeters`). |
| **Output** | Status verifikasi geofence: jarak terhitung (meter), status `DALAM_RADIUS` atau `LUAR_RADIUS`, pesan visual yang jelas, dan koordinat tercatat pada dokumen presensi. |
| **Acceptance Criteria** | 1. Aplikasi meminta izin akses lokasi perangkat (`foreground location permission`).<br>2. Perhitungan jarak menggunakan formula Haversine yang konsisten antara klien dan validasi database.<br>3. Jika jarak praktikan $\le$ radius laboratorium dan sesi berstatus `open`, presensi berhasil dicatat ke Firestore beserta metadata lokasi (`latitude`, `longitude`, `distanceMeters`, `recordedAt`).<br>4. Jika jarak praktikan $>$ radius laboratorium, presensi ditolak dengan pesan: *"Anda berada di luar radius laboratorium (jarak: X meter, maksimal: Y meter)"*.<br>5. Mencegah presensi ganda pada sesi yang sama (tepat 1 presensi per UID per sesi). |
| **Dependensi** | SRS-01; SRS-03; Layanan `expo-location`; Firestore Security Rules |
| **PIC** | Programmer 2 (P2) |
| **Status** | Belum Terverifikasi |

---

### SRS-03 — Pengelolaan Data & Titik Lokasi Laboratorium

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengelola data master laboratorium di Cloud Firestore (`laboratories/{labId}`), mencakup identitas laboratorium, nama gedung, lantai, koordinat geografis (`latitude`, `longitude`), radius default presensi (dalam meter), dan kapasitas. Asisten memiliki hak mengelola data ini. |
| **Input** | Form input data lab oleh asisten: nama lab, kode lab, gedung, koordinat latitude (-90 s/d 90), longitude (-180 s/d 180), dan radius toleransi (10 s/d 500 meter). |
| **Output** | Dokumen koleksi `laboratories` di Firestore; daftar laboratorium yang dapat diakses oleh fitur presensi dan peta. |
| **Acceptance Criteria** | 1. Asisten dapat menambah, membaca, mengubah, dan menghapus (soft-delete/arsip) data laboratorium.<br>2. Validasi koordinat memastikan latitude antara -90 dan 90 serta longitude antara -180 dan 180.<br>3. Validasi radius minimal 10 meter dan maksimal 500 meter (rekomendasi default: 25–50 meter untuk gedung lab).<br>4. Praktikan hanya memiliki hak baca (*read-only*) terhadap data laboratorium.<br>5. Perubahan data laboratorium langsung tersinkronisasi ke sesi praktikum yang merujuk lab tersebut. |
| **Dependensi** | Cloud Firestore; Auth & Role asisten Sprint 2; SRS-08 |
| **PIC** | Programmer 3 (P3) |
| **Status** | Belum Terverifikasi |

---

### SRS-04 — Peta Laboratorium Interaktif & Pelacakan Posisi Pengguna

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menyediakan layar peta interaktif (berbasis `react-native-maps` / Google Maps) yang menampilkan titik-titik laboratorium Informatika dengan custom marker, visualisasi lingkaran radius geofence (*Circle overlay*), serta marker posisi pengguna yang diperbarui secara langsung (*live location tracking*). |
| **Input** | Lokasi real-time perangkat pengguna (`watchPositionAsync`), data koleksi `laboratories` dari Firestore, interaksi geser/zoom peta. |
| **Output** | Tampilan peta interaktif, marker laboratorium kustom, marker posisi pengguna (berbeda visual praktikan/asisten), lingkaran radius lab, dan tombol pemusatan kembali (*recenter to user*). |
| **Acceptance Criteria** | 1. Peta memuat koordinat lingkungan Informatika dengan lancar tanpa freeze.<br>2. Menampilkan marker untuk setiap laboratorium aktif dengan ikon dan label yang jelas.<br>3. Menampilkan lingkaran (*Circle overlay*) transparan yang menunjukkan radius toleransi geofence masing-masing laboratorium.<br>4. Menampilkan marker posisi pengguna yang bergerak mengikuti perubahan lokasi fisik perangkat selama layar peta aktif.<br>5. Tombol *recenter* mengarahkan kamera peta kembali ke koordinat pengguna terkini.<br>6. Mengetuk marker laboratorium membuka lembar informasi (*callout* / *bottom sheet*) aktivitas laboratorium terkait. |
| **Dependensi** | Layanan Google Maps API Key; `react-native-maps`; `expo-location`; SRS-03 |
| **PIC** | Programmer 3 (P3) |
| **Status** | Belum Terverifikasi |

---

### SRS-05 — Informasi Aktivitas Laboratorium Real-time

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menampilkan informasi komprehensif mengenai kegiatan praktikum pada laboratorium yang dipilih di peta, mencakup praktikum yang sedang berlangsung (*ongoing session*) dan jadwal praktikum berikutnya (*upcoming sessions*) yang disinkronkan secara real-time dari Firestore. |
| **Input** | Pemilihan marker laboratorium di peta (`labId`), data koleksi `sessions`, `schedules`, dan `classes`. |
| **Output** | Panel/Bottom Sheet aktivitas lab: nama lab, gedung, praktikum sedang berjalan (nama praktikum, kelas, topik, jam mulai-selesai, asisten bertugas, status sesi `open`/`closed`), serta daftar 1–3 jadwal sesi berikutnya. |
| **Acceptance Criteria** | 1. Mengetuk marker laboratorium menampilkan detail aktivitas laboratorium secara responsif.<br>2. Jika terdapat sesi yang sedang berjalan (`status: 'open'` atau dalam rentang jam aktif hari ini), tampilkan badge hijau *"Sedang Berlangsung"* beserta rincian kelas dan asisten.<br>3. Jika tidak ada sesi aktif, tampilkan keterangan *"Tidak ada praktikum aktif saat ini"* dan tampilkan sesi berikutnya yang terjadwal.<br>4. Perubahan status sesi (misal: asisten membuka sesi) langsung ter-update di panel aktivitas tanpa perlu memuat ulang peta.<br>5. Menyediakan tombol pintasan untuk praktikan langsung menuju halaman presensi jika sesi lab tersebut merupakan kelasnya dan sedang dibuka. |
| **Dependensi** | SRS-01; SRS-03; SRS-04; Listener Firestore `sessions` |
| **PIC** | Programmer 3 (P3) |
| **Status** | Belum Terverifikasi |

---

### SRS-06 — Push Notification Berbasis Peristiwa Kegiatan

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengintegrasikan push notification (FCM / Expo Notifications) untuk mengirimkan pemberitahuan otomatis ke perangkat pengguna terkait pada tiga peristiwa penting: (1) Sesi praktikum dibuka oleh asisten, (2) Jadwal praktikum mengalami perubahan waktu/ruang, dan (3) Pengajuan izin praktikan diputuskan (diterima/ditolak) oleh asisten. |
| **Input** | Pemicu peristiwa Firestore / klien: aksi `buka sesi`, pembaruan `schedules`/`sessions`, konfirmasi `decideLeaveRequest`. Payload notifikasi: judul, pesan ringkas (*body*), metadata (`sessionId`, `type`, rute navigasi). |
| **Output** | Push notification yang muncul di tray notifikasi sistem operasi perangkat pengguna yang berkepentingan, dilengkapi bunyi, badge, dan *rich notification action*. |
| **Acceptance Criteria** | 1. **Peristiwa Sesi Dibuka**: Ketika asisten membuka sesi kelas K, seluruh praktikan anggota aktif kelas K menerima notifikasi: *"Sesi Praktikum Dibuka: [Topik] - Silakan lakukan presensi di lab"*. Pengguna lain di luar kelas tidak menerima notifikasi ini.<br>2. **Peristiwa Jadwal Berubah**: Ketika jadwal/ruang sesi diperbarui oleh asisten, praktikan kelas terkait menerima notifikasi: *"Perubahan Jadwal Praktikum: [Mata Kuliah] dipindahkan ke [Ruang/Waktu]"*.<br>3. **Peristiwa Izin Diputuskan**: Ketika asisten menyetujui atau menolak izin praktikan U, perangkat praktikan U menerima notifikasi: *"Pengajuan Izin [Disetujui/Ditolak]: [Catatan asisten]"*.<br>4. Mengetuk notifikasi langsung mengarahkan pengguna ke layar terkait (*deep linking* rute Expo Router). |
| **Dependensi** | Layanan `expo-notifications` / Firebase Cloud Messaging; SRS-07 |
| **PIC** | Programmer 1 (P1) |
| **Status** | Belum Terverifikasi |

---

### SRS-07 — Manajemen Token Perangkat & Penargetan Notifikasi

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Mengelola pendaftaran token push notification perangkat (*Expo Push Token* atau *FCM Device Token*) ke profil pengguna di Firestore (`users/{uid}/devices/{deviceId}` atau field array `fcmTokens`). Memastikan notifikasi terkirim tepat sasaran dan melakukan pembersihan token saat pengguna logout. |
| **Input** | Permintaan token push notification dari sistem operasi, UID pengguna yang sedang login, status autentikasi. |
| **Output** | Penyimpanan token terdaftar di Firestore yang aman, asosiasi token dengan UID, dan pencabutan token saat pengguna keluar (*logout*). |
| **Acceptance Criteria** | 1. Saat pengguna login, aplikasi mendaftarkan token push perangkat ke Firestore di bawah UID pengguna aktif.<br>2. Satu pengguna yang memiliki lebih dari satu perangkat dapat menerima notifikasi di seluruh perangkat aktifnya.<br>3. Saat pengguna logout, token perangkat tersebut dihapus atau dinonaktifkan dari profil UID agar perangkat tidak lagi menerima notifikasi milik akun tersebut.<br>4. Token yang sudah kedaluwarsa (*invalid/unregistered token*) ditangani tanpa menyebabkan kegagalan sistem pengiriman. |
| **Dependensi** | Firebase Auth; Cloud Firestore; `expo-notifications`; SRS-06 |
| **PIC** | Programmer 1 (P1) |
| **Status** | Belum Terverifikasi |

---

### SRS-08 — Penanganan Izin Perangkat, Kondisi Offline, dan Keamanan

| Aspek | Spesifikasi |
| --- | --- |
| **Deskripsi** | Menangani seluruh perizinan runtime (*location permission* dan *notification permission*), error saat GPS mati atau lokasi belum akurat, mode koneksi offline/terputus, serta pembatasan akses data lokasi dan notifikasi melalui Firebase Security Rules. |
| **Input** | Status perizinan perangkat (`granted`, `denied`, `undetermined`), status GPS (*Location Services enabled/disabled*), status konektivitas jaringan, query Firestore. |
| **Output** | Penanganan UI defensif (banner peringatan, dialog instruksi mengaktifkan GPS/notifikasi), pencegahan crash aplikasi, dan penolakan database untuk operasi presensi yang tidak sah. |
| **Acceptance Criteria** | 1. Jika izin lokasi ditolak praktikan, tampilkan *empty state* / petunjuk bahwa presensi membutuhkan izin lokasi untuk validasi kehadiran.<br>2. Jika GPS perangkat mati, tampilkan dialog pengingat untuk menyalakan GPS.<br>3. Jika sinyal GPS lemah/akurasi buruk, berikan indikator memuat hingga koordinat akurat diperoleh.<br>4. Firestore Security Rules memastikan hanya asisten yang dapat mengubah data master lab, dan data presensi wajib menyertakan koordinat valid.<br>5. Aplikasi tidak mengalami crash atau unhandled rejection saat layanan lokasi atau notifikasi tidak tersedia. |
| **Dependensi** | Layanan sistem OS; Cloud Firestore Security Rules; seluruh SRS |
| **PIC** | Tanggung jawab bersama (P1: Notifikasi & Rules; P2: Geolocation & Presensi; P3: Maps & Lab) |
| **Status** | Belum Terverifikasi |

---

## 5. Kebutuhan Non-Fungsional (NFR)

1. **Akurasi Geolocation**: Batas toleransi radius laboratorium dihitung menggunakan formula jarak bola bumi geodesi (Haversine Formula) dengan ketelitian hingga rentang meter. Tingkat akurasi GPS yang diterima disarankan $< 30$ meter sebelum presensi diverifikasi.
2. **Efisiensi Baterai & Pelacakan Lokasi**: Pelacakan posisi pengguna (*location watcher*) hanya diaktifkan saat layar peta atau halaman presensi aktif di latar depan (*foreground*). Pelacakan wajib dihentikan (*cleanup subscription*) saat pengguna berpindah tab atau aplikasi berpindah ke latar belakang (*background*).
3. **Performa Rendering Peta**: Peta interaktif harus mampu merender marker laboratorium dan radius overlay tanpa frame drop di bawah 30 FPS pada perangkat seluler standar.
4. **Keandalan Push Notification**: Waktu jeda antara pemicuan peristiwa di aplikasi asisten (buka sesi, ubah jadwal, putus izin) hingga notifikasi diterima oleh perangkat praktikan ditargetkan $< 5$ detik pada jaringan stabil.
5. **Keamanan & Privasi**: Koordinat lokasi pengguna hanya digunakan untuk validasi geofence dan rendering visual di perangkat; riwayat pergerakan pengguna tidak direkam secara berkelanjutan di server, kecuali koordinat saat melakukan presensi untuk keperluan audit akademik.

---

## 6. Batasan Scope & Aspek Opsional

- **Dalam Scope**:
  - Validasi lokasi presensi berbasis radius lingkaran (*geofencing circular radius*).
  - Peta laboratorium Informatika dengan marker, radius, dan live tracking lokasi pengguna.
  - Penampil informasi praktikum ongoing & upcoming pada laboratorium yang dipilih.
  - Push notification terarah untuk 3 peristiwa kegiatan (sesi dibuka, jadwal berubah, keputusan izin).
  - Penanganan izin runtime perangkat dan penanganan error komprehensif.
- **Fitur Opsional (Nilai Tambah)**:
  - Pemindaian QR Code sesi: asisten menampilkan QR Code dinamis yang memuat token sesi + timestamp, praktikan memindai melalui kamera pada halaman presensi khusus.
  - Perutean arah jalan (*walking route polyline*) dari posisi pengguna ke laboratorium tujuan pada peta (mengacu referensi rute medium).
- **Di Luar Scope (Out of Scope)**:
  - Pelacakan latar belakang terus-menerus (*continuous background GPS tracking*).
  - Pemetaan denah indoor multilantai secara 3D (pemetaan menggunakan koordinat 2D gedung/lab).
  - SMS gateway atau integrasi email blast.
