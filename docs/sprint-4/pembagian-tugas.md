# Pembagian Tugas dan Alur Kerja Tim — Sprint 4

Dokumen ini adalah kontrak pembagian kerja tim **1 Project Manager (PM) + 3 Programmer (P1, P2, P3)** untuk mengimplementasikan seluruh fitur yang belum tersedia pada **Sprint 4**.

---

## 1. Struktur Tim dan Branch Kerja

| Kode | Peran | Branch Git | Fokus Tanggung Jawab Utama |
| --- | --- | --- | --- |
| **PM** | Project Manager | `main` | Penyelarasan kontrak skema 3-peran & pembayaran, setup akun Midtrans Sandbox & env backend, finalisasi navigasi `_layout.tsx` & konsistensi UI lintas peran, review PR, integrasi, dan demo |
| **P1** | Aslab Management, Bulk Engine & Dashboard | `feature/aslab-lab-dashboard` | Role `aslab`, manajemen lab per mata kuliah (radius + batas telat + denda), 3 fitur Bulk Insert terpisah + template CSV + `ScrollView` editor, pindah praktikan/asprak antar lab, dan Dashboard Aslab (filter hari/minggu/bulan + riwayat keuangan) |
| **P2** | Asprak Session Scope, Grace Period & Fines | `feature/asprak-grace-fines` | Isolasi akses `asprak` pada lab/kelas tanggung jawabnya, pengelolaan sesi real-time Asprak, mesin hitung *grace period* keterlambatan, penerbitan 1 tagihan denda (`fines`), dan integrasi *excused absence* pada izin yang disetujui |
| **P3** | Backend Midtrans Sandbox, Payments & Notif | `feature/midtrans-payment-notif` | Layanan Backend (buat transaksi Snap Midtrans + webhook verifikasi SHA-512 + endpoint admin helper), layar Tagihan & WebView Midtrans, halaman Riwayat Pembayaran persisten, serta 3 trigger push notification pembayaran |

---

## 2. Urutan Ketergantungan Antarmodul (Contract-First)

```text
Fase 0 (Kontrak Bersama — dipimpin PM):
  Menyepakati tipe Role ('praktikan' | 'asprak' | 'aslab'), FineRecord, dan PaymentTransaction
  │
  ├── P1 menghasilkan: dokumen `laboratories` (dengan gracePeriodMinutes & lateFineAmount) + `labAssignments`
  │     └── dipakai P2 untuk membaca batas toleransi keterlambatan sesi & memfilter kelas milik Asprak
  │
  ├── P2 menghasilkan: dokumen tagihan `fines/{sessionId}_{uid}` berstatus 'unpaid' saat presensi terlambat
  │     ├── dipakai P3 untuk ditampilkan di daftar tagihan & diproses pembayarannya ke Midtrans Sandbox
  │     └── dipakai P1 untuk menghitung piutang/tunggakan denda di Dashboard Keuangan Aslab
  │
  └── P3 menghasilkan: backend webhook yang menulis `payments/{orderId}` & melunasi `fines/{fineId}` + trigger notifikasi
        └── dipakai P1 untuk menampilkan pemasukan denda lunas di Dashboard Keuangan Aslab
```

---

## 3. Peta Kepemilikan File Sprint 4 (Pencegahan Merge Conflict)

| Area / File Path | Status | Pemilik Tunggal | Batas Koordinasi |
| --- | --- | --- | --- |
| `src/types/models.ts` & `src/services/authService.ts` | Eksisting | **P1** (dikunci di M1) | Penambahan peran `aslab` & alias `asprak`; segera di-merge awal oleh PM |
| `src/app/(tabs)/_layout.tsx` | Eksisting | **PM** | Mengatur visibilitas 5 tab dinamis untuk `praktikan`, `asprak`, dan `aslab` |
| `src/app/(tabs)/dashboard.tsx` | Baru | **P1** | Rute Dashboard Keberlangsungan & Keuangan Lab (Aslab) |
| `src/app/(tabs)/kelola-lab.tsx` | Baru | **P1** | Rute Manajemen Lab, 3 Bulk Insert, & Transfer Anggota (Aslab) |
| `src/features/aslab/**` & `src/services/aslab/**` | Baru | **P1** | Komponen `ScrollView` bulk editor, parser/template CSV, transfer, & agregator dashboard |
| `src/features/maps/MapsScreen.tsx` & `LabManagementModal.tsx` | Eksisting | **P1** | Mengunci tombol kelola lab hanya untuk `aslab` + input batas telat & nominal denda |
| `src/services/practicumService.ts` & `src/store/selectors.ts` | Eksisting | **P2** | Scoping daftar kelas/sesi khusus `asprak` bertugas + status `izin` (*excused absence*) |
| `src/services/attendanceService.ts` & `src/services/fines/**` | Eksisting / Baru | **P2** | Evaluasi *grace period* saat presensi & transaksi pembuatan `fines/{sessionId}_{uid}` |
| `src/features/kehadiran/**` & `src/features/presensi/**` | Eksisting | **P2** | Badge tepat waktu/terlambat/`izin` (excused absence) & info batas toleransi di layar presensi |
| `src/types/fine.ts` | Baru | **P2** | Kontrak tipe tagihan denda yang dipakai bersama P1 dan P3 |
| `backend/**` | Baru | **P3** | Seluruh kode server Midtrans Snap, verifikasi webhook SHA-512, & admin user provisioning |
| `src/app/(tabs)/denda.tsx` & `src/app/pembayaran/[fineId].tsx` | Baru | **P3** | Rute daftar tagihan, checkout Snap WebView, & halaman riwayat pembayaran |
| `src/features/payments/**` & `src/services/payments/**` | Baru | **P3** | UI dan client service pembayaran & riwayat transaksi |
| `src/services/notifications/notificationDispatcher.ts` & `src/types/notification.ts` | Eksisting | **P3** | Penambahan 3 tipe notifikasi (`fine_created`, `payment_success`, `payment_failed`) & deep link |
| `firestore.rules` | Eksisting | **PM** (kontribusi P1, P2, P3) | Penggabungan aturan RBAC 3-peran, `labAssignments`, `fines`, dan proteksi tulis `payments` |
| `tests/bulkAndDashboard.test.cjs` | Baru | **P1** | Unit test CSV parser/template, state `ScrollView` accept/deny, & filter hari/minggu/bulan |
| `tests/graceAndFines.test.cjs` | Baru | **P2** | Unit test kalkulasi *grace period*, idempotensi 1 denda, & pembebasan denda saat izin disetujui |
| `tests/midtransAndPaymentNotif.test.cjs` | Baru | **P3** | Unit test verifikasi SHA-512 signature webhook, pemetaan status Midtrans, & payload notifikasi bayar |

---

## 4. Rincian Tugas Programmer 1 (P1) — Aslab Management, Bulk Engine & Dashboard

**Branch**: `feature/aslab-lab-dashboard`  
**SRS**: SRS-01, SRS-02, serta porsi Aslab pada SRS-07 & SRS-08.

1. **Role `aslab` & Pengelolaan Laboratorium per Mata Kuliah**:
   - Memperbarui normalisasi profil pengguna agar mengenali `'aslab'`, `'asprak'` (kompatibel `'asisten'`), dan `'praktikan'`.
   - Menambahkan pengelolaan parameter `gracePeriodMinutes` dan `lateFineAmount` berdampingan dengan `radiusMeters` dan koordinat pada laboratorium.
2. **Tiga Fitur Bulk Insert Terpisah + Downloadable Template**:
   - Menyediakan generator unduhan file `.csv` terpisah untuk: (1) Bulk Lab per Mata Kuliah, (2) Bulk Praktikan ke Lab, (3) Bulk Asprak ke Lab.
   - Membangun `BulkPreviewScrollList` berbasis `ScrollView` yang memungkinkan Aslab melakukan *accept/deny* per baris, mengedit teks secara langsung, dan mengisi kolom kosong sebelum eksekusi simpan batch.
3. **Distribusi Single & Perpindahan Anggota Antar Lab**:
   - Menyediakan aksi pindah praktikan dari Lab A ke Lab B dan pindah asprak antar lab secara atomik (tanpa mengubah jadwal praktikum).
4. **Dashboard Keberlangsungan & Keuangan Laboratorium**:
   - Menampilkan metrik jumlah lab & praktikan, status per lab, lokasi & waktu, jadwal aktif/mendatang, riwayat kegiatan, dan riwayat keuangan hasil denda dengan filter **Hari**, **Minggu**, dan **Bulan**.

---

## 5. Rincian Tugas Programmer 2 (P2) — Asprak Scope, Grace Period & Pengelolaan Denda

**Branch**: `feature/asprak-grace-fines`  
**SRS**: SRS-03, SRS-04, serta porsi Asprak/Kehadiran pada SRS-07 & SRS-08.

1. **Pembatasan Wewenang & Scoping Asprak**:
   - Memfilter daftar kelas, jadwal, sesi, dan antrean izin yang tampil pada akun `asprak` agar hanya memuat laboratorium/kelas tempat ia ditugaskan (`labAssignments`).
   - Menyembunyikan fitur distribusi peserta dan manajemen lab global dari antarmuka `asprak`.
2. **Mesin Perhitungan Keterlambatan (*Grace Period*)**:
   - Memperluas transaksi `submitAttendanceToFirestore` untuk mengevaluasi waktu presensi terhadap waktu mulai sesi + `gracePeriodMinutes`.
   - Menyimpan status tepat waktu (`on_time`) vs terlambat (`late` beserta `lateMinutes`).
3. **Penerbitan Tagihan Tunggal & *Excused Absence***:
   - Membuat tepat 1 dokumen tagihan `fines/{sessionId}_{uid}` dengan nominal tetap saat presensi terlambat, terhubung ke `uid`, `sessionId`, dan `attendanceId`, lalu memicu dispatcher `notifyFineCreated`.
   - Memastikan pembayaran denda tidak mengubah status kehadiran praktikan.
   - Memperbarui perhitungan riwayat kehadiran & rekap agar izin berstatus `approved` tampil sebagai **`izin` (*excused absence*)**, tidak menjadi hadir, dan bebas dari tagihan denda.

---

## 6. Rincian Tugas Programmer 3 (P3) — Backend Midtrans Sandbox, Pembayaran & Notifikasi

**Branch**: `feature/midtrans-payment-notif`  
**SRS**: SRS-05, SRS-06, serta porsi Pembayaran/Backend pada SRS-07 & SRS-08.

1. **Layanan Backend Transaksi & Webhook Midtrans Sandbox**:
   - Membangun server/fungsi backend yang menyimpan `MIDTRANS_SERVER_KEY` di environment server.
   - Menyediakan endpoint `POST /api/payments/create` (terproteksi Firebase ID Token) untuk membuat transaksi Snap Midtrans Sandbox dan menulis dokumen `payments/{orderId}` berstatus `pending`.
   - Menyediakan endpoint `POST /api/payments/webhook` yang memvalidasi `signature_key` SHA-512 dari Midtrans, memperbarui status `payments` (`pending`, `success`, `failed`), dan melunasi `fines` (`paid`) secara idempoten.
   - Menyediakan endpoint bantu admin provisioning (`firebase-admin`) untuk mendukung pembuatan/pencarian akun saat P1 mengeksekusi bulk insert praktikan/asprak.
2. **Antarmuka Tagihan, Checkout Midtrans, & Riwayat Pembayaran**:
   - Membangun layar daftar tagihan denda praktikan dan layar pembayaran Snap menggunakan `react-native-webview`.
   - Membangun halaman **Riwayat Pembayaran** persisten (sesi, tanggal tagihan, nominal, waktu transaksi, status pembayaran) yang tetap tersimpan walau aplikasi ditutup dan dibuka kembali.
3. **Integrasi 3 Event Push Notification Pembayaran**:
   - Menambahkan payload builder, audit log, dan deep link untuk: (1) tagihan denda baru dibuat, (2) pembayaran berhasil, dan (3) pembayaran gagal / butuh penyelesaian lanjut.

---

## 7. Standar Verifikasi Sebelum Merge ke `main`

Setiap programmer wajib menjalankan pemeriksaan berikut sebelum mengajukan Pull Request:
```bash
npx expo lint          # wajib 0 error
npx tsc --noEmit       # wajib 0 error TypeScript
node --test tests/*.test.cjs
```
PM melakukan review kode (terutama memastikan tidak ada secret key Midtrans di `src/` atau `.env` klien), menguji alur webhook di lingkungan Sandbox, dan melakukan merge bertahap: **Fondasi Role & Kontrak $\rightarrow$ P2 (Sesi & Denda) $\rightarrow$ P3 (Midtrans & Notifikasi) $\rightarrow$ P1 (Bulk & Dashboard Aslab) $\rightarrow$ Finalisasi UI & Security Rules**.
