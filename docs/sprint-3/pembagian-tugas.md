# Pembagian Tugas dan Alur Kerja Tim — Sprint 3

Dokumen ini adalah kontrak resmi pembagian kerja tim **1 Project Manager (PM) + 3 Programmer (P1, P2, P3)** untuk pelaksanaan Praktikum Sprint 3.

---

## 1. Struktur Tim dan Branch Kerja

| Kode | Peran | Branch Git | Tanggung Jawab Utama |
| --- | --- | --- | --- |
| **PM** | Project Manager | `main` | Planning, penyusunan SRS, fasilitasi kontrak data koordinat & notifikasi, review PR, integrasi bertahap, demo pengujian, dan pelaporan |
| **P1** | Push Notification & Device Permissions | `feature/push-notification` | Setup layanan Push Notification (`expo-notifications` / FCM), registry token perangkat di Firestore, pemicuan notifikasi terarah (sesi dibuka, jadwal berubah, keputusan izin), dan penanganan izin notifikasi |
| **P2** | Geolocation, Geofence & Halaman Presensi | `feature/geo-attendance` | Halaman presensi khusus (`/presensi/[sesiId]`), integrasi GPS (`expo-location`), kalkulasi jarak Haversine, validasi radius geofence, pencatatan presensi berkoordinat ke Firestore, dan proteksi duplikasi |
| **P3** | Interactive Maps & Informasi Aktivitas Lab | `feature/maps-laboratory` | Halaman peta interaktif (`/(tabs)/peta`), integrasi `react-native-maps`, custom marker lab & live tracking pengguna, bottom sheet aktivitas lab real-time (ongoing & upcoming), dan CRUD data master laboratorium |

---

## 2. Aturan Contract-First dan Ketergantungan Antarmodul

```text
M0: PM + Tim menyepakati kontrak data-model.md & koordinat lab
  │
  ├── P3: Menyiapkan interface laboratorium (lat, lng, radius) & mock koordinat lab
  │     └── P2: Menggunakan koordinat lab tersebut untuk formula Haversine & presensi
  │
  ├── P1: Menyiapkan service pendaftaran token perangkat (users/{uid}/devices)
  │     ├── P2: Memberikan event "presensi sukses" (bila diperlukan)
  │     └── P3 & PM: Menghubungkan trigger buka sesi, ubah jadwal, dan putus izin ke dispatcher notifikasi P1
  │
  └── PM: Mereview PR dan melakukan merge bertahap: P3 (Peta/Lab) → P2 (Presensi Geofence) → P1 (Notifikasi)
```

1. **Koordinat Laboratorium**: P3 mendefinisikan tipe dan struktur data laboratorium (`lat`, `lng`, `radiusMeters`) di awal. P2 menggunakan struktur tersebut untuk validasi jarak tanpa membuat tipe koordinat versi sendiri.
2. **Payload Notifikasi**: P1 mendefinisikan format payload notifikasi (`title`, `body`, `data: { screen, sessionId }`). Modul sesi (P2/Sprint 2) dan modul izin (P3/Sprint 2) memicu fungsi dispatcher P1 saat status berubah.
3. **Pemisahan File Shared**: Komponen global (`_layout.tsx`, `app-context.tsx`, `firestore.rules`) dikoordinasikan melalui PM dan tidak diubah bersamaan untuk mencegah konflik merge.

---

## 3. Peta Kepemilikan File Sprint 3

| Area / File Path | Status | Penulis Tunggal | Batas Koordinasi |
| --- | --- | --- | --- |
| `src/app/(tabs)/_layout.tsx` | Existing | PM / P3 | P3 menambahkan Tab Peta; dikoordinasikan dengan PM |
| `src/app/(tabs)/peta.tsx` | Baru | **P3** | Rute tampilan peta interaktif |
| `src/app/presensi/[sesiId].tsx` | Baru | **P2** | Rute halaman presensi khusus geofence |
| `src/features/maps/**` | Baru | **P3** | Seluruh komponen peta, marker lab, live tracking, dan sheet aktivitas lab |
| `src/features/presensi/**` | Baru | **P2** | Seluruh komponen kartu status lokasi, radar geofence, dan form presensi |
| `src/features/notifications/**` | Baru | **P1** | Komponen UI banner prompt notifikasi dan badge lonceng |
| `src/services/location/**` | Baru | **P2** | Service izin GPS, get position, dan kalkulasi Haversine geofence |
| `src/services/maps/**` | Baru | **P3** | Service CRUD data lab dan query aktivitas lab (ongoing & upcoming) |
| `src/services/notifications/**` | Baru | **P1** | Service expo-notifications, device token registry, dan event dispatcher |
| `src/types/laboratory.ts` | Baru | **P3** | Definisi tipe laboratorium dan koordinat acuan |
| `src/types/geoAttendance.ts` | Baru | **P2** | Definisi tipe presensi berbasis lokasi dan status geofence |
| `src/types/notification.ts` | Baru | **P1** | Definisi tipe payload push notification dan device token |
| `firestore.rules` | Existing | **P1** / PM | Penambahan rules untuk `laboratories`, token device, dan presensi geofence |
| `src/services/aiService.ts` | Existing | **Read-Only** | Model sentimen AI lokal dari Sprint 2 dipertahankan tanpa perubahan |
| `tests/geoAttendance.test.cjs` | Baru | **P2** | Unit test kalkulasi Haversine, evaluasi radius geofence, dan penolakan luar radius |
| `tests/notifications.test.cjs` | Baru | **P1** | Unit test pendaftaran token, pembuatan payload notifikasi, dan deep link |
| `tests/laboratories.test.cjs` | Baru | **P3** | Unit test validasi koordinat lab, filter aktivitas lab ongoing & upcoming |

---

## 4. Detail Tugas Programmer 1 (P1) — Push Notification & Device Permissions

**Branch**: `feature/push-notification`  
**SRS**: SRS-06, SRS-07, dan bagian notifikasi SRS-08.

### Rincian Tugas:
1. **Setup Layanan Notifikasi**:
   - Mengonfigurasi modul `expo-notifications` (channel Android, ikon, bunyi, dan izin getaran).
   - Mengonfigurasi `setNotificationHandler` agar notifikasi tetap tampil saat aplikasi di foreground.
2. **Device Token Registry**:
   - Meminta izin runtime notifikasi (`requestPermissionsAsync`).
   - Mengambil Expo Push Token / FCM Device Token saat pengguna login.
   - Menyimpan token ke Firestore pada path `users/{uid}/devices/{token}`.
   - Menghapus token dari Firestore saat pengguna logout di `AuthContext`.
3. **Pemicu Notifikasi Berbasis Peristiwa**:
   - **Sesi Dibuka**: Membuat fungsi pemicu notifikasi ke seluruh praktikan anggota kelas saat sesi dibuka.
   - **Jadwal Berubah**: Memicu notifikasi ke praktikan kelas saat tanggal/jam/ruang lab diperbarui.
   - **Izin Diputuskan**: Memicu notifikasi ke praktikan pemohon saat asisten menyetujui atau menolak izin.
4. **Deep Linking Navigasi**:
   - Menambahkan metadata navigasi pada payload (`screen: 'presensi'`, `sessionId: '...'`).
   - Menangani event saat notifikasi diketuk oleh pengguna (`addNotificationResponseReceivedListener`) untuk berpindah layar secara otomatis.
5. **Unit Testing**:
   - Menulis pengujian pada `tests/notifications.test.cjs` untuk validasi format payload dan lifecycle token.

---

## 5. Detail Tugas Programmer 2 (P2) — Geolocation, Geofence & Halaman Presensi

**Branch**: `feature/geo-attendance`  
**SRS**: SRS-01, SRS-02, dan bagian geolokasi SRS-08.

### Rincian Tugas:
1. **Layanan Geolocation & Geofencing**:
   - Meminta izin runtime lokasi perangkat (`requestForegroundPermissionsAsync`).
   - Mengambil koordinat GPS terkini pengguna (`getCurrentPositionAsync`).
   - Mengimplementasikan formula Haversine untuk menghitung jarak akurat dalam satuan meter.
   - Mengimplementasikan fungsi evaluasi: apakah `jarak <= radiusMeters` lab sesi.
2. **Halaman Presensi Khusus (`/presensi/[sesiId]`)**:
   - Menampilkan ringkasan informasi sesi (topik, kelas, lab, waktu).
   - Menampilkan kartu status lokasi: jarak terhitung, batas maksimal, dan status geofence.
   - Menyediakan tombol segarkan koordinat GPS.
   - Menyediakan form catatan presensi (maks 120 karakter).
3. **Validasi & Eksekusi Presensi**:
   - Tombol presensi hanya aktif jika sesi berstatus `open` DAN lokasi `DALAM_RADIUS`.
   - Mengirim data presensi ke Firestore dengan field `latitude`, `longitude`, `distanceMeters`, `accuracy`, dan `status: 'hadir'`.
   - Menangani error: di luar radius, sesi ditutup, GPS mati, izin ditolak, dan presensi duplikat.
4. **(Opsional) Mode Pemindaian QR Code**:
   - Menyediakan opsi fallback pemindaian QR Code sesi jika GPS bermasalah di dalam ruangan lab.
5. **Unit Testing**:
   - Menulis pengujian pada `tests/geoAttendance.test.cjs` untuk formula Haversine, validasi batas radius, dan penolakan presensi di luar radius.

---

## 6. Detail Tugas Programmer 3 (P3) — Interactive Maps & Informasi Aktivitas Lab

**Branch**: `feature/maps-laboratory`  
**SRS**: SRS-03, SRS-04, SRS-05, dan bagian peta SRS-08.

### Rincian Tugas:
1. **Layar Peta Interaktif (`/(tabs)/peta`)**:
   - Mengonfigurasi `react-native-maps` (`MapView`) dengan koordinat wilayah kampus Informatika.
   - Menampilkan custom marker untuk seluruh laboratorium aktif.
   - Menampilkan *Circle overlay* radius geofence di sekeliling marker lab.
   - Mengimplementasikan live tracking posisi pengguna (`watchPositionAsync`) dengan auto-cleanup saat layar unmount.
   - Menyediakan tombol pemusatan kamera (*recenter*) ke lokasi pengguna terkini.
2. **Bottom Sheet Aktivitas Laboratorium Real-time**:
   - Menampilkan rincian lab saat marker diketuk.
   - Menampilkan praktikum yang sedang berjalan (*ongoing*): kelas, mata kuliah, topik, jam, asisten bertugas, dan status sesi.
   - Menampilkan 1–3 jadwal praktikum berikutnya (*upcoming*).
   - Menyediakan tombol pintas langsung menuju halaman presensi untuk praktikan kelas terkait.
3. **Pengelolaan Data Laboratorium (CRUD Asisten)**:
   - Form bagi asisten untuk menambah dan memperbarui data lab, koordinat lat/lng, dan radius geofence.
   - Validasi nilai koordinat (-90 s/d 90, -180 s/d 180) dan radius (10 s/d 500 meter).
4. **Unit Testing**:
   - Menulis pengujian pada `tests/laboratories.test.cjs` untuk validasi koordinat lab dan filtering sesi ongoing/upcoming.

---

## 7. Detail Tugas Project Manager (PM)

- **Fase Awal (Menit 00–15)**:
  - Menyusun dan menyelaraskan dokumen Sprint 3 (`README.md`, `prd.md`, `arsitektur.md`, `data-model.md`, `navigasi-ui.md`, `pembagian-tugas.md`, `acceptance-criteria.md`).
  - Menetapkan batas koordinat awal laboratorium Informatika dan struktur payload notifikasi bersama tim.
- **Fase Eksekusi (Menit 15–60)**:
  - Memantau perkembangan masing-masing programmer, mengatasi hambatan dependensi OS/native build.
  - Memastikan P2 dan P3 konsisten menggunakan formula dan koordinat yang sama.
- **Fase Integrasi & Review (Menit 60–75)**:
  - Mereview Pull Request dari ketiga programmer.
  - Menjalankan `tsc --noEmit`, `eslint`, dan seluruh unit test sebelum merge bertahap ke `main`.
- **Fase Demo & Penutupan (Menit 75–90)**:
  - Memimpin pelaksanaan 3 demo pengujian pada [acceptance-criteria.md](./acceptance-criteria.md).
  - Mengisi lembar verifikasi hasil aktual dan memastikan tidak ada klaim fiktif.

---

## 8. Timeline Pelaksanaan Praktikum — 90 Menit

| Rentang Waktu | PM | Programmer 1 (Notifikasi) | Programmer 2 (Presensi & Geofence) | Programmer 3 (Peta & Lab) |
| --- | --- | --- | --- | --- |
| **00–15 menit** | Finalisasi SRS, setup task board, fasilitasi kontrak koordinat & token | Membaca spesifikasi payload notifikasi & setup expo-notifications | Membaca spesifikasi Haversine & kontrak presensi | Menyiapkan data awal laboratorium & koordinat Informatika |
| **15–35 menit** | Monitoring fondasi modul & kesiapan dependensi Expo | Setup service notifikasi & listener pendaftaran device token | Implementasi formula Haversine & service geolocation | Implementasi dasar MapView, custom marker lab, & radius circle |
| **35–60 menit** | Review progres berkala & koordinasi integrasi intermodul | Implementasi event dispatcher (sesi dibuka, jadwal, izin) | Implementasi UI halaman presensi khusus & validasi geofence | Implementasi live tracking pengguna & bottom sheet aktivitas lab |
| **60–75 menit** | Review PR, resolve conflict bersama, merge ke `main` bertahap | Testing token lifecycle & perbaikan notifikasi | Testing presensi dalam/luar radius & perbaikan geofence | Testing interaksi peta & perbaikan filter aktivitas lab |
| **75–90 menit** | Eksekusi 3 skrip demo pengujian, dokumentasi bukti uji, sign-off | Pendampingan demo notifikasi & commit final branch | Pendampingan demo geofence & commit final branch | Pendampingan demo peta & commit final branch |
