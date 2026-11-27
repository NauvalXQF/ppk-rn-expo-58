# Praktikum Pengembangan Platform Khusus — Aplikasi Manajemen & Presensi Lab

Aplikasi mobile lintas platform berbasis **React Native (Expo SDK 58)** untuk mengelola kegiatan praktikum, laboratorium, presensi berbasis lokasi (*geofencing*), pengajuan izin berbantuan AI lokal, serta sistem denda & pembayaran **Midtrans Sandbox**.

---

## Tim Pengembang

| Nama | Peran / Kontribusi | NIM |
| :--- | :--- | :--- |
| **Reynaldi Bertinus** | Mobile Developer | `<isi-nim>` |
| **Muhammad Nauval Fadli** | Mobile Developer | `<isi-nim>` |
| **Raffie Aditya** | Mobile Developer | `<isi-nim>` |
| **M. Banyuputra Eka P.** | Mobile Developer | `<isi-nim>` |

---

## Fitur Utama (Sprint 1 – Sprint 4)

### 1. Autentikasi & Hak Akses 3 Peran (RBAC)
- **Asisten Laboratorium (`aslab`)**: Mengelola master laboratorium, aturan *grace period* & tarif denda, impor massal CSV (Lab, Praktikan, Asprak), transfer anggota antar-lab, serta memantau **Dashboard Operasional & Arus Kas**.
- **Asisten Praktikum (`asprak`)**: Mengelola sesi praktikum pada lab yang ditugaskan (`labAssignments`), membuka/menutup sesi real-time, memantau presensi (tepat waktu/terlambat/izin), dan memutus pengajuan izin.
- **Praktikan (`praktikan`)**: Melihat jadwal, melakukan presensi berbasis lokasi, mengajukan izin, serta membayar tagihan denda keterlambatan.

### 2. Manajemen Laboratorium, Bulk CSV, & Peta Interaktif
- **Peta Laboratorium (`Leaflet` WebView + `expo-location`)**: Menampilkan marker laboratorium, posisi pengguna real-time, dan status aktivitas lab (*ongoing* / *upcoming*).
- **3 Fitur Bulk Insert Terpisah**: Impor Laboratorium, Praktikan, dan Asprak menggunakan template `.csv` yang dapat diunduh langsung, lengkap dengan pratinjau `ScrollView` interaktif (*accept/deny* & *inline edit*) dan integrasi provisioning backend.
- **Transfer Anggota Antar-Lab**: Memindahkan praktikan maupun asprak secara atomik tanpa mengubah jadwal yang sudah berjalan.

### 3. Presensi Geofencing, Grace Period, & Denda Otomatis
- Validasi radius lokasi (Haversine) dan opsi QR *bypass*.
- Perhitungan *grace period* otomatis (`effectiveStart + gracePeriodMinutes`); keterlambatan menerbitkan 1 tagihan denda deterministik (`{sessionId}_{uid}`).
- **Izin & AI Lokal**: Klasifikasi alasan izin secara offline di perangkat; izin yang disetujui mencatat status `izin` (*excused absence*) dan membebaskan tagihan denda (`waived`).

### 4. Pembayaran Midtrans Sandbox & Push Notification
- **Alur Client – Server – Payment Gateway**: Backend Express + Firebase Admin (`backend/`) membuat transaksi Midtrans Snap Sandbox dan memverifikasi *webhook* SHA-512 sebelum melunasi tagihan dan menyimpan riwayat pembayaran persisten.
- **Push Notification (`expo-notifications`)**: Notifikasi pembukaan sesi, perubahan jadwal, keputusan izin, tagihan denda baru, serta status pembayaran berhasil/gagal.

---

## Tech Stack

`React Native` · `Expo SDK 58` · `Expo Router` · `TypeScript` · `Cloud Firestore` · `Firebase Auth` · `Express + Firebase Admin` · `Midtrans Sandbox` · `Leaflet Maps`

---

## Menjalankan Proyek

### 1. Aplikasi Mobile (Expo)
```bash
npm install
copy .env.example .env
npx expo start
```

### 2. Backend Midtrans & Provisioning (`backend/`)
```powershell
./start-backend.ps1
```
Atau manual:
```bash
cd backend
npm install
npm run dev
```

### 3. Pengujian & Verifikasi
```bash
node --test tests/*.test.cjs
npx tsc --noEmit
npx expo lint
```

---

## Dokumentasi Terkait
- [Panduan Setup Firebase](docs/FIREBASE-SETUP.md)
- [Dokumentasi Sprint 4 (PRD, Arsitektur, Data Model)](docs/sprint-4/README.md)
- [Panduan Style UI](docs/ui-style-guide.md)
