# PRD dan SRS — Sprint 2: Data Dinamis dengan Firebase

## 1. Informasi Dokumen

| Item | Isi |
| --- | --- |
| Produk | Aplikasi Presensi Praktikum, lanjutan Sprint 1 |
| Sprint | Sprint 2 — Data Dinamis dengan Firebase |
| Versi dokumen | 1.0 |
| Status | Rancangan; seluruh SRS Belum Terverifikasi |
| Pemilik | PM |
| Tanggal penyusunan | 11 November 2026 |
| Platform | Android dan iOS; web untuk pemeriksaan tambahan bila tersedia |
| Data yang ditargetkan | Firebase Authentication, Cloud Firestore, API AI pengajar |

Dokumen ini menetapkan kebutuhan. Model data ada di [data-model.md](./data-model.md), implementasi integrasi yang diusulkan di [arsitektur.md](./arsitektur.md), dan prosedur verifikasi di [acceptance-criteria.md](./acceptance-criteria.md).

---

## 2. Latar Belakang dan Problem Statement

Codebase Sprint 1 menyimpan pengguna, kelas, sesi, dan presensi dalam Context/reducer yang diinisialisasi dari data dummy. Pemilihan identitas bukan autentikasi; perubahan belum terhubung ke database bersama. Sprint 2 menargetkan identitas berbasis UID, data persisten, sinkronisasi antarperangkat, serta alur izin yang tetap diputuskan manusia.

Masalah utama: identitas tidak terverifikasi, data lokal tidak menjadi sumber bersama, pencegahan duplikasi belum berada di database, dan pengajuan izin beserta pemeriksaannya belum tersedia pada struktur aplikasi yang diinspeksi.

---

## 3. Target Pengguna dan User Stories

| Pengguna | Kebutuhan | SRS |
| --- | --- | --- |
| Praktikan | Mendaftar/masuk, membaca jadwal kelas, presensi sekali, mengajukan izin, memantau keputusan sendiri | 01, 02, 03, 04, 05, 07, 08 |
| Asisten | Masuk dengan role terpercaya, mengelola data, membuka/menutup sesi, memantau rekap, menilai izin | 01, 02, 04, 06, 07, 08 |
| PM (peran tim, bukan role aplikasi) | Membagi kerja, menyepakati kontrak, meninjau integrasi dan bukti hasil | Seluruh SRS |

Seluruh delapan SRS berprioritas **Must**. Risiko waktu tidak mengubah kebutuhan menjadi opsional; bagian yang tidak selesai harus dicatat sebagai belum terpenuhi.

---

## 4. Software Requirements Specification

### SRS-01 — Authentication dan Identitas

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Registrasi, login, logout melalui Firebase Authentication; profil terikat UID; role praktikan/asisten berasal dari data terpercaya |
| Input | Usulan email/password, nama dan NIM untuk registrasi praktikan; kredensial akun asisten yang diprovisikan P1 |
| Output | Sesi Auth, profil `users/{uid}`, identitas dan navigasi sesuai role; pesan error saat gagal |
| Acceptance criteria | Registrasi valid menghasilkan UID dan profil praktikan; email duplikat/password invalid tidak masuk; login valid membaca profil UID yang sama; kredensial salah gagal; logout menutup akses layar/data lama; akun tidak dapat memilih atau menaikkan role sendiri |
| Dependensi | Akses Firebase dan provider Auth oleh P1; kebijakan provisioning asisten; SRS-08 |
| PIC | P1 |
| Status | Belum Terverifikasi |

### SRS-02 — Data Praktikum melalui Firestore

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Asisten melakukan create/read/update/delete kelas, keanggotaan peserta, jadwal dan sesi; praktikan membaca data kelasnya |
| Input | Nama kelas/praktikum, UID peserta terdaftar, jadwal mulai/selesai, ruang, topik, relasi kelas/sesi |
| Output | Dokumen Firestore valid dan tampilan yang sesuai role; kegagalan referensi atau akses ditampilkan |
| Acceptance criteria | Keempat entitas dapat dibuat, dibaca, diperbarui, dan dihapus memakai data uji tanpa relasi; perubahan terbaca setelah aplikasi dibuka ulang; UID/kelas yang tidak ada dan waktu selesai sebelum mulai ditolak; penghapusan data berelasi mengikuti kebijakan arsip; praktikan tidak dapat menulis data master |
| Dependensi | SRS-01, koneksi/Rules P1, kesepakatan skema dan kebijakan hapus |
| PIC | P2; P1 menyediakan akses dan Rules |
| Status | Belum Terverifikasi |

CRUD peserta berarti pengelolaan keanggotaan kelas dan identitas akademik peserta, bukan penghapusan akun Firebase Authentication oleh P2. Usulan identitas akademik pada keanggotaan dijelaskan di [data-model.md](./data-model.md).

### SRS-03 — Presensi Tunggal per Sesi

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Praktikan anggota kelas mencatat presensi hanya saat sesi `open`; identitas berasal dari Auth |
| Input | `sessionId`, UID aktif, konfirmasi hadir, catatan opsional |
| Output | Satu dokumen `sessions/{sessionId}/attendances/{uid}`, waktu server, umpan balik penyimpanan |
| Acceptance criteria | Anggota dapat presensi pada sesi terbuka; sesi tertutup dan nonanggota ditolak; dua permintaan bersamaan dengan UID/sesi sama menyisakan tepat satu dokumen; update/delete presensi oleh klien ditolak; rekap bertambah sekali |
| Dependensi | SRS-01, SRS-02, SRS-08 |
| PIC | P2; P1 memvalidasi Rules |
| Status | Belum Terverifikasi |

### SRS-04 — Real-time dan Persistensi

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Status sesi, presensi, dan rekap diperbarui tanpa restart; penyimpanan server bertahan setelah aplikasi ditutup |
| Input | Snapshot sesi/presensi/keanggotaan, perubahan akun/scope, kondisi jaringan |
| Output | Jadwal/detail/rekap konsisten, indikator loading/error/belum tersinkron bila perlu |
| Acceptance criteria | Dua perangkat online menampilkan buka/tutup sesi dan presensi baru tanpa refresh; jumlah hadir sama di detail dan rekap; setelah write dikonfirmasi server lalu aplikasi ditutup/dibuka, data sama; logout/pergantian akun tidak menampilkan snapshot lama atau menggandakan listener |
| Dependensi | SRS-01–SRS-03, listener sesuai Rules, jaringan tersedia |
| PIC | P2 untuk domain; P1 untuk lifecycle Auth; P3 untuk listener izin |
| Status | Belum Terverifikasi |

Persistensi data server wajib; login ulang setelah aplikasi dibuka boleh diperlukan sesuai konfigurasi Auth. Kemampuan penuh bekerja offline bukan janji sprint.

### SRS-05 — Pengajuan Izin

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Praktikan mengirim alasan izin untuk sesi kelasnya dan memantau status pengajuan sendiri |
| Input | `sessionId`, UID aktif, alasan yang di-trim dan divalidasi |
| Output | Dokumen izin berstatus awal `pending` dengan alasan dan timestamp |
| Acceptance criteria | Alasan valid tersimpan dan tampil pada riwayat sendiri setelah buka ulang; alasan kosong/terlalu panjang atau sesi di luar kelas ditolak; pengajuan pengguna lain tidak dapat dibaca/diubah; kegagalan AI tidak menghapus izin yang sudah tersimpan |
| Dependensi | SRS-01, SRS-02, SRS-08; kebijakan waktu/duplikasi izin |
| PIC | P3 |
| Status | Belum Terverifikasi |

### SRS-06 — Integrasi Klasifikasi AI Pengajar

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Mengirim alasan sesuai kontrak API pengajar, memvalidasi respons, menyimpan klasifikasi sebagai informasi pendukung |
| Input | Alasan dan data minimum yang diwajibkan kontrak pengajar; detail wire request belum tersedia |
| Output | Hasil klasifikasi terpisah, status proses AI, waktu hasil atau error aman |
| Acceptance criteria | Respons valid API nyata disimpan dan terbaca asisten; timeout, jaringan gagal, respons tidak valid dan HTTP gagal menampilkan status kegagalan serta retry terbatas; `pending` tidak berubah karena hasil AI; respons terlambat tidak menimpa keputusan asisten; simulasi tidak dinyatakan sebagai lulus integrasi API nyata |
| Dependensi | SRS-05; endpoint, autentikasi, request/response, kategori, limit dan akses API dari pengajar |
| PIC | P3; P1 membantu batas akses penyimpanan hasil |
| Status | Belum Terverifikasi |

### SRS-07 — Pemeriksaan dan Keputusan Asisten

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Asisten membaca alasan dan informasi AI kemudian secara manual menerima/menolak pengajuan |
| Input | `requestId`, pilihan asisten `approved`/`rejected`, UID pemeriksa, catatan keputusan opsional |
| Output | Status keputusan, `reviewedBy`, `reviewedAt`, terlihat real-time oleh pemohon |
| Acceptance criteria | Kedua pilihan terima/tolak dapat diuji pada dua pengajuan terpisah; hanya asisten dapat mengubah `pending` ke status akhir; pemohon melihat keputusan tanpa restart; dua asisten memutus bersamaan tidak menimpa keputusan pertama; AI tidak pernah mengubah status keputusan |
| Dependensi | SRS-01, SRS-05, SRS-08; hasil AI dapat belum tersedia/gagal |
| PIC | P3 |
| Status | Belum Terverifikasi |

### SRS-08 — Validasi, Error Handling, dan Keamanan

| Aspek | Spesifikasi |
| --- | --- |
| Deskripsi | Validasi input di klien dan Rules, akses berdasarkan role/UID/kelas, pembatasan field dan penanganan kegagalan |
| Input | Semua operasi baca/tulis, kredensial, parameter route, payload tidak sah |
| Output | Operasi sah diproses; operasi terlarang ditolak tanpa bocor data atau sukses palsu |
| Acceptance criteria | Emulator/Rules test membuktikan penolakan akses anonim, eskalasi role, CRUD master oleh praktikan, akses data orang lain, presensi tertutup/ganda dan keputusan oleh praktikan; whitelist field/status/tipe/batas panjang ditegakkan; UI menangani denied/not-found/unavailable tanpa crash; secret AI/admin tidak ada di bundle/repo |
| Dependensi | Kontrak seluruh koleksi, P1 memiliki akses deploy Rules; batas API pengajar |
| PIC | P1 untuk Rules/Auth; P2/P3 untuk validasi dan error modul masing-masing |
| Status | Belum Terverifikasi |

---

## 5. Non-Functional Requirements

| ID | Kategori | Target yang harus diverifikasi |
| --- | --- | --- |
| NFR-01 | Usability | Loading, empty, error, pending write dan sukses dibedakan; form mencegah submit berulang |
| NFR-02 | Mobile | Alur Android/iOS mempertahankan pola UI Sprint 1; aman dari keyboard dan overflow pada 320 px |
| NFR-03 | Konsistensi | Firestore sumber data daring; cache UI tidak menganggap write lokal sebagai bukti server |
| NFR-04 | Kinerja | Listener dibatasi scope aktif dan dilepas; daftar panjang tidak memuat seluruh database |
| NFR-05 | Maintainability | Route tipis, modul per domain, `npx expo lint` dan `npx tsc --noEmit` diperiksa |
| NFR-06 | Privasi | Alasan izin hanya untuk pemohon/asisten; kirim data minimum ke AI; tidak log password/token/alasan lengkap |

---

## 6. Asumsi Desain dan Batasan

Semua pilihan berikut merupakan usulan yang perlu persetujuan tim: email/password untuk Auth; seluruh asisten terpercaya dapat mengelola semua kelas praktikum; satu pengajuan izin per UID/sesi; tidak ada perubahan keputusan final; izin tidak otomatis menjadi presensi hadir. Kebijakan detail dan pemetaan tiga status lama ke dua status baru hanya didefinisikan di [data-model.md](./data-model.md).

Tidak ada migrasi UID dummy secara otomatis, tidak ada reset database dari tombol demo pengguna, dan tidak ada klaim offline persistence sebelum diuji pada SDK/perangkat yang dipilih. Kode dan data Sprint 1 dipertahankan sebagai baseline; tugas dokumentasi ini tidak mengubahnya.

---

## 7. Dependencies dan Risiko

| Risiko | Dampak | Penanganan oleh tim |
| --- | --- | --- |
| Akses Firebase terlambat | P2/P3 belum dapat menguji integrasi | P1 mengurus akses sejak awal eksekusi; programmer membangun terhadap kontrak; PM mencatat blocker |
| Kontrak API pengajar belum tersedia | SRS-06/demo izin belum dapat diverifikasi penuh | PM memperoleh kontrak; P3 siapkan adaptor dan failure state; jangan mengarang endpoint/kategori |
| File shared diedit bersamaan | Integrasi tertunda | Satu penulis per file, perubahan kecil dan review berurutan |
| Durasi 60 menit eksekusi tidak cukup | SRS belum selesai | Gunakan UI existing, integrasi lebih awal, catat hasil sebenarnya; jangan menonaktifkan Rules |
| Relasi lama/baru tidak cocok | Jadwal/detail gagal join | Adapter UID/status/tanggal disepakati sebelum menghubungkan layar |

---

## 8. Open Questions dan Pemilik Keputusan

Belum ada jawaban yang dianggap final pada saat penyusunan dokumen.

| Informasi/keputusan | Pemilik tindak lanjut | Waktu kebutuhan |
| --- | --- | --- |
| Nama anggota, PIC nyata dan akses collaborator | PM | 00–15 |
| Firebase Project, akses console, region, provider, akun asisten awal, lingkungan uji | P1 mengerjakan setup; PM mengoordinasikan akses | Awal eksekusi |
| Persetujuan skema, scope semua asisten, role bootstrap, batas alasan, hapus/arsip dan transisi sesi | PM bersama P1/P2/P3 | M0, sebelum Rules/query |
| Endpoint, metode, header/auth, request/response, kategori dan contoh respons API AI | Pengajar, ditindaklanjuti PM dan P3 | Sebelum uji AI nyata |
| Timeout, rate limit, biaya/kuota, kebijakan data dan retry API | Pengajar; P3 menerapkan | Sebelum koneksi API |
| Apakah API aman dipanggil mobile atau memerlukan perantara server dan siapa penyedianya | Pengajar/PM/P3; setup Firebase tetap P1 | Sebelum secret digunakan |
| URL/kolom form awal dan akhir, format bukti serta flow kertas | Pengajar/asisten praktikum melalui PM | Awal dan akhir praktikum |

---

## 9. Metrik Keberhasilan dan Glosarium

Sprint fitur dapat dinyatakan memenuhi target bila delapan SRS terbukti, dua demo nyata dijalankan, Rules menolak akses ilegal, dan pemeriksaan kualitas selesai. Dokumen ini belum menyatakan hasil tersebut tercapai.

| Istilah | Arti |
| --- | --- |
| UID | Identitas stabil pengguna dari Firebase Authentication |
| Keanggotaan | Hubungan UID praktikan dengan kelas; berbeda dari akun Auth |
| Real-time | Perubahan server diterima listener tanpa pengguna me-restart aplikasi |
| Klasifikasi AI | Informasi pendukung tentang alasan, bukan keputusan izin |
| Keputusan izin | `pending`, `approved`, `rejected`; status akhir hanya oleh asisten |
