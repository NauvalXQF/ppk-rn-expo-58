# Sprint 2 — Data Dinamis dengan Firebase

Dokumen ini adalah acuan kerja Sprint 2 untuk aplikasi presensi praktikum lanjutan Sprint 1. Fokus sprint: menghubungkan identitas pengguna, data praktikum, presensi, dan pengajuan izin ke layanan persisten serta menyinkronkannya antarperangkat.

> Stack yang ditemukan: Expo SDK 58 (`~58.0.16`), React Native 0.88, TypeScript strict, Expo Router.
> Status dokumen: rancangan untuk implementasi. Seluruh SRS **Belum Terverifikasi**; seluruh checklist fitur/pengujian **belum dijalankan**.
> Aturan mutlak: AI hanya memberikan klasifikasi pendukung. Keputusan menerima/menolak izin hanya oleh asisten.

---

## 1. Tujuan Sprint

1. Mengganti pemilihan identitas dummy pada alur daring dengan Firebase Authentication dan role terpercaya.
2. Mengelola kelas, peserta, jadwal, sesi, dan presensi melalui Cloud Firestore.
3. Menjaga satu presensi per UID per sesi serta memperbarui status dan rekap secara real-time.
4. Menyediakan pengajuan izin, klasifikasi AI pengajar, dan pemeriksaan manual oleh asisten.
5. Memvalidasi kewenangan di UI dan database, dengan umpan balik kegagalan yang jelas.

---

## 2. Ruang Lingkup dan Kebutuhan Wajib

| ID | Kebutuhan | PIC utama |
| --- | --- | --- |
| SRS-01 | Registrasi, login, logout, identitas UID, role praktikan/asisten | P1 |
| SRS-02 | CRUD kelas, peserta, jadwal, dan sesi melalui Firestore | P2 |
| SRS-03 | Presensi saat sesi terbuka, maksimal sekali per praktikan per sesi | P2 |
| SRS-04 | Status sesi, presensi, rekap real-time; data bertahan setelah aplikasi ditutup | P2, didukung P1/P3 |
| SRS-05 | Pengajuan izin untuk sesi tertentu, alasan, pemantauan status | P3 |
| SRS-06 | Klasifikasi alasan oleh API AI pengajar dan penyimpanan hasil pendukung | P3 |
| SRS-07 | Asisten menerima/menolak izin; praktikan melihat keputusan tersimpan | P3 |
| SRS-08 | Validasi, error handling, akses role, Firebase Security Rules | P1, didukung P2/P3 |

Rincian SRS yang menjadi acuan tunggal ada di [prd.md](./prd.md). QR/GPS, pengenalan wajah, notifikasi, ekspor laporan, serta dashboard admin baru tidak termasuk sprint. Pekerjaan saat penyusunan dokumen ini hanya Markdown; semua implementasi di bawah adalah tugas mendatang.

---

## 3. Peta Dokumen

| Dokumen | Isi | Pembaca utama |
| --- | --- | --- |
| [README.md](./README.md) | Tujuan, scope, tim, milestone, definition of done | Semua |
| [prd.md](./prd.md) | SRS-01–SRS-08, input/output, PIC, dependensi, pertanyaan terbuka | PM dan programmer |
| [arsitektur.md](./arsitektur.md) | Temuan codebase, layer integrasi, autentikasi, listener, API AI | Programmer |
| [data-model.md](./data-model.md) | Usulan koleksi, relasi, status, kontrak data dan Security Rules | Programmer |
| [navigasi-ui.md](./navigasi-ui.md) | Route existing/usulan, spesifikasi layar dan state UI | Programmer dan PM |
| [pembagian-tugas.md](./pembagian-tugas.md) | Scope, ownership file, dependensi, timeline 90 menit, Git | Semua |
| [acceptance-criteria.md](./acceptance-criteria.md) | Given/When/Then, test matrix, dua skrip demo, sign-off | PM dan programmer |

Referensi format: seluruh tujuh Markdown di [Sprint 1](../sprint-1/README.md) telah dibaca. Nama file, heading bernomor, pemisah `---`, tabel, checklist, diagram, serta pemisahan spesifikasi/teknis/QA dipertahankan. `prd.md` menampung SRS agar tidak membuat dokumen kebutuhan duplikat. Dokumentasi ditempatkan di `docs/sprint-2/`, sejajar dengan `docs/sprint-1/`.

---

## 4. Peran Tim

| Peran | Branch | Fokus |
| --- | --- | --- |
| PM | `main` | SRS, pembagian kerja, koordinasi kontrak, review, konflik, merge, demo, form |
| P1 — Firebase Authentication & Security | `feature/firebase-auth` | Seluruh setup Firebase, SDK, Auth, UID/role, provider/guard, Security Rules |
| P2 — Data Praktikum & Presensi | `feature/practicum-attendance` | CRUD, kontrol sesi, presensi, rekap, listener domain |
| P3 — Pengajuan Izin & Integrasi AI | `feature/permission-ai` | Pengajuan, klasifikasi, kegagalan API, pemeriksaan, sinkronisasi status |

**Seluruh setup Firebase milik P1, bukan PM.** PM tidak mengambil alih implementasi programmer. Peta file lengkap hanya di [pembagian-tugas.md](./pembagian-tugas.md).

---

## 5. Milestone, Dependensi, dan Waktu

| Waktu | Milestone | Hasil yang ditargetkan |
| --- | --- | --- |
| 00–15 | M0 — Planning | PM menyusun SRS, membagi tugas, mengisi form awal; tim menyepakati kontrak dan mengidentifikasi akses yang belum tersedia |
| 15–30 | M1 — Fondasi | P1 setup Firebase dan kontrak Auth; P2/P3 menyusun UI/adaptor sesuai kontrak tanpa mengklaim integrasi telah berjalan |
| 30–55 | M1 — Fitur paralel | P2 menghubungkan CRUD/presensi; P3 izin/AI; P1 Auth/Rules; PM mereview perubahan kecil |
| 55–65 | M2 — Integrasi | PM mengoordinasikan review dan merge fondasi → data/presensi → izin/AI setelah terverifikasi |
| 65–75 | M3 — QA | PM menjalankan dua demo dan pemeriksaan prioritas; programmer memperbaiki modul masing-masing |
| 75–90 | Penutupan | PM mencatat kondisi sebenarnya dan form akhir; programmer menulis flow kode di kertas dan menyerahkannya kepada asisten praktikum |

P1 menyediakan koneksi, UID, dan role sebelum P2/P3 menguji akses database. P2 menyediakan `classId`/`sessionId` serta pemeriksaan keanggotaan bagi P3. Kontrak API dari pengajar diperlukan P3 sebelum integrasi AI nyata. Detail pembagian menit dan penanganan blocker ada di [pembagian-tugas.md](./pembagian-tugas.md).

---

## 6. Git Workflow Singkat

Gunakan feature branching. Programmer commit dengan header dan body, hanya push ke branch sendiri. PM mereview bukti uji dan menyelesaikan konflik bersama pemilik file sebelum merge ke `main`. Sinkronisasi menggunakan merge `origin/main` ke feature branch agar tidak memerlukan penulisan ulang history. Contoh perintah dan commit masing-masing programmer ada di [pembagian-tugas.md](./pembagian-tugas.md).

Perintah Git di dokumen adalah panduan pelaksanaan praktikum mendatang. Penyusunan dokumentasi ini tidak melakukan commit, push, merge, atau perubahan branch.

---

## 7. Hasil Akhir dan Alur Demo yang Ditargetkan

**Demo 1 — Presensi:** asisten login → membuka sesi → praktikan login pada perangkat lain → melakukan presensi → Firestore mengonfirmasi penyimpanan → rekap asisten berubah real-time → asisten menutup sesi. Setelah aplikasi ditutup dan dibuka kembali, data server tetap dapat dibaca.

**Demo 2 — Izin:** praktikan login → mengirim alasan izin untuk sesi → API AI pengajar mengklasifikasikan → hasil pendukung disimpan → asisten membaca alasan/hasil lalu menerima atau menolak → praktikan melihat status terbaru. AI gagal tetap tidak boleh menentukan keputusan.

Langkah dan bukti per tahap ada di [acceptance-criteria.md](./acceptance-criteria.md). Hasil di atas adalah target, bukan laporan keberhasilan.

---

## 8. Definition of Done

Seluruh item berikut belum dijalankan.

- [ ] SRS-01–SRS-08 memenuhi acceptance criteria dan memiliki bukti.
- [ ] Presensi ganda serta eskalasi role ditolak di database, bukan hanya tombol UI.
- [ ] Listener dibersihkan saat logout, pergantian akun, dan perubahan scope.
- [ ] Data tetap tersedia setelah aplikasi ditutup; kedua demo diuji antarperangkat.
- [ ] Hasil AI terpisah dari keputusan manual dan kegagalan AI ditangani.
- [ ] `npx expo lint` dan `npx tsc --noEmit` selesai tanpa error pada integrasi fitur.
- [ ] PM mencatat status nyata, blocker, bukti demo, dan form akhir.

---

## 9. Ketentuan, Asumsi, dan Keputusan

**Ketentuan studi kasus:** delapan kebutuhan wajib, empat anggota, pembagian setup ke P1, branch yang ditentukan, durasi 90 menit, dan larangan keputusan izin otomatis.

**Usulan desain:** skema Firestore, pemetaan status sesi, seluruh asisten dapat mengelola semua kelas praktikum, batas alasan, serta kebijakan penghapusan di [data-model.md](./data-model.md). Semua perlu disepakati tim sebelum implementasi.

**Rekomendasi teknis:** adaptor agar UI Sprint 1 dapat digunakan kembali; pemisahan Auth/data/AI; query sesuai Rules; konfirmasi server sebelum menyatakan penyimpanan selesai. Daftar informasi yang perlu keputusan PM/pengajar ada di [prd.md](./prd.md).
