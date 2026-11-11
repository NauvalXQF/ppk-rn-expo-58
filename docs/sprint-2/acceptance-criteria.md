# Acceptance Criteria dan Skrip Demo

Dokumen ini dipakai PM untuk memverifikasi implementasi Sprint 2 mendatang. **Seluruh checklist, test matrix, sign-off dan kedua demo belum dijalankan.** Tidak ada hasil fitur yang diklaim lulus. Status SRS awal tetap **Belum Terverifikasi** di [prd.md](./prd.md).

---

## 1. Traceability Kebutuhan

| Kebutuhan | Area | AC | Test | Status SRS |
| --- | --- | --- | --- | --- |
| SRS-01 | Auth, UID, role | AC-01 | T-01–T-05 | Belum Terverifikasi |
| SRS-02 | CRUD kelas/peserta/jadwal/sesi | AC-02 | T-06–T-09 | Belum Terverifikasi |
| SRS-03 | Presensi dan duplikasi | AC-03 | T-10–T-13 | Belum Terverifikasi |
| SRS-04 | Real-time dan persistensi | AC-04 | T-14–T-17 | Belum Terverifikasi |
| SRS-05 | Pengajuan izin | AC-05 | T-18–T-20 | Belum Terverifikasi |
| SRS-06 | AI sebagai pendukung | AC-06 | T-21–T-24 | Belum Terverifikasi |
| SRS-07 | Pemeriksaan asisten | AC-07 | T-25–T-27 | Belum Terverifikasi |
| SRS-08 | Validasi dan Security Rules | AC-08 | T-28–T-32 | Belum Terverifikasi |

---

## 2. Acceptance Criteria

### AC-01 — Authentication dan Role

**Given** Firebase uji dan akun dua role disiapkan P1
**When** pengguna mendaftar, login valid/invalid, logout, lalu berganti akun
**Then** UID/profil sesuai akun, registrasi publik selalu praktikan, error aman, akses lama tertutup dan tidak ada data akun lama tertinggal.

**When** klien mencoba membuat/mengubah role menjadi asisten
**Then** database menolak meskipun UI dilewati. Profil yang belum siap tidak memberikan akses fitur.

### AC-02 — CRUD Empat Entitas

**Given** asisten aktif dan data uji tanpa relasi telah disiapkan
**When** create/read/update/delete kelas, peserta, jadwal dan sesi dilakukan satu per satu
**Then** hasil server sesuai operasi, terbaca setelah buka ulang, relasi valid, dan praktikan tidak dapat mengerjakan operasi tulis tersebut.

**When** entitas mempunyai relasi historis atau input referensi/waktu invalid
**Then** mengikuti kebijakan aman yang disepakati; arsip diberi label arsip, tidak dianggap bukti delete fisik. Jika mekanisme delete belum tersedia, bagian delete SRS-02 belum terpenuhi.

### AC-03 — Presensi Terbuka dan Tunggal

**Given** UID praktikan adalah anggota aktif kelas sesi
**When** presensi dikirim saat sesi open
**Then** satu dokumen pada path UID tersimpan dengan waktu server dan rekap bertambah sekali.

**When** request diulang/bersamaan, UID dipalsukan, kelas berbeda, atau sesi sudah closed
**Then** tidak ada dokumen tambahan/penimpaan dan operasi ilegal ditolak di database. Menutup sesi sebelum server mengevaluasi write harus menggagalkan presensi tersebut.

### AC-04 — Real-time dan Persistensi

**Given** dua perangkat online login dengan akun berbeda
**When** asisten mengubah sesi atau praktikan mencatat presensi
**Then** layar perangkat lain memperbarui tanpa restart/refresh, jumlah hadir konsisten.

**When** write telah dikonfirmasi server lalu aplikasi ditutup dan dibuka kembali
**Then** dokumen tetap ada setelah login bila diperlukan. Logout/navigasi berulang tidak menggandakan listener atau membocorkan data lama. Jaringan gagal tidak ditampilkan sebagai empty/sukses server.

### AC-05 — Pengajuan Izin

**Given** praktikan anggota kelas sesi dan alasan valid
**When** pengajuan dikirim
**Then** UID/sesi/alasan tersimpan dengan status pending, pemohon dapat memantau dan membacanya kembali setelah restart.

**When** alasan kosong/terlalu panjang, sesi di luar kelas, atau submit diulang
**Then** validasi/Rules mencegah data tidak sah dan duplikasi menurut kontrak ID yang disepakati. Status awal tidak dapat dikirim sebagai approved/rejected.

### AC-06 — Klasifikasi AI Terpisah

**Given** kontrak dan akses API pengajar telah tersedia
**When** respons nyata valid diterima
**Then** klasifikasi disimpan pada field AI saja, sementara status keputusan tetap pending sampai asisten bertindak.

**When** timeout, HTTP gagal, jaringan terputus, respons invalid, retry atau respons terlambat terjadi
**Then** alasan tetap tersimpan, status AI/error ditampilkan, tidak ada pengajuan ganda dan tidak ada keputusan otomatis. Respons AI sesudah keputusan tidak menimpanya. Uji simulasi kegagalan tidak menggantikan bukti API nyata.

### AC-07 — Pemeriksaan Manual

**Given** asisten membuka pengajuan pending
**When** asisten secara eksplisit mengonfirmasi Terima atau Tolak
**Then** status final beserta UID/waktu pemeriksa tersimpan, pemohon menerima pembaruan real-time. Dua pilihan diuji menggunakan pengajuan berbeda.

**When** praktikan/AI mencoba memutuskan, atau dua asisten memutus pengajuan sama
**Then** perubahan ilegal ditolak dan keputusan final pertama dipertahankan. Asisten dapat menilai alasan saat AI gagal; ketidaktersediaan AI tidak memicu keputusan default.

### AC-08 — Keamanan dan Error Handling

**Given** Rules aktif di lingkungan uji
**When** operasi anonim, eskalasi role, manipulasi UID/field/status/timestamp, baca data pribadi pengguna lain, atau tulis lintas role dicoba melalui klien uji
**Then** operasi ditolak pada lapisan database. Kasus positif tetap diizinkan agar Rules tidak sekadar menolak semuanya.

**When** query/listener/write gagal atau route tidak valid
**Then** UI memberi error aman, tidak crash, tidak memberi sukses palsu dan tidak membocorkan secret. Secret API/admin tidak berada di repo/bundle/log.

---

## 3. Prasyarat dan Data Uji

Semua persiapan berikut belum dijalankan:

- [ ] P1 menyediakan lingkungan Firebase uji, Auth, Rules/indeks dan konfigurasi yang benar.
- [ ] P1 menyediakan asisten A; praktikan U/V di kelas K; praktikan W di kelas lain; akun tambahan asisten B untuk uji konflik.
- [ ] P2 menyediakan sesi S belum pernah dibuka, sesi lain untuk izin, roster valid, dan entitas disposable untuk CRUD/delete.
- [ ] P3 memperoleh kontrak API nyata, metode simulasi timeout/error dan data alasan tanpa informasi sensitif.
- [ ] PM menyiapkan dua perangkat/instance independen, jaringan aktif, pencatatan waktu dan bukti yang menyamarkan email/token.
- [ ] Rules negatif diuji di Emulator Suite/lingkungan terisolasi dengan identitas klien, bukan akses admin yang melewati Rules.

Jangan reset database bersama dari aplikasi. Gunakan ID sesi uji baru untuk demo ulang; reload tidak boleh menghapus data server. ID K/S/U di sini adalah label skenario, bukan nilai Firebase yang sudah tersedia.

---

## 4. Test Matrix

| ID | Skenario | Langkah konkret | Hasil yang diharapkan | PIC | Status |
| --- | --- | --- | --- | --- | --- |
| T-01 | Registrasi valid | Daftarkan akun baru; baca Auth dan profil UID | Satu akun/profil praktikan sesuai UID | P1 | Belum dijalankan |
| T-02 | Registrasi/login invalid | Email invalid/duplikat, password tidak sesuai kebijakan, password salah | Pesan aman, tidak masuk; tidak ada profil invalid | P1 | Belum dijalankan |
| T-03 | Login/logout/role | Login U, logout, login A; coba akses route role lain | Identitas/tab sesuai role; akses lama tertutup | P1 | Belum dijalankan |
| T-04 | Eskalasi role | Klien U create profil asisten/update role/delete lalu recreate | Semua eskalasi ditolak Rules | P1 | Belum dijalankan |
| T-05 | Profil gagal | Simulasikan Auth sukses tetapi write/read profil gagal; retry | Tidak mendapat akses default; pulih dengan UID sama | P1 | Belum dijalankan |
| T-06 | CRUD kelas | Asisten create, baca, edit nama, delete kelas disposable; buka ulang | Dokumen sesuai; delete benar-benar terhapus | P2 | Belum dijalankan |
| T-07 | CRUD peserta | Tambah UID valid, baca, edit nama/NIM/active, hapus keanggotaan uji | Roster sesuai; akun Auth tidak dihapus; UID invalid ditolak | P2 | Belum dijalankan |
| T-08 | CRUD jadwal | Create/read/update/delete jadwal disposable; kirim endAt sebelum startAt | CRUD sah bekerja; waktu invalid ditolak | P2 | Belum dijalankan |
| T-09 | CRUD sesi/relasi | Create/read/update/delete sesi disposable; salah classId/scheduleId; coba hapus master berelasi | Relasi invalid ditolak; sejarah tidak menjadi yatim; arsip dibedakan dari delete | P2/P1 | Belum dijalankan |
| T-10 | Presensi sah | A membuka S, U mengonfirmasi presensi | Satu attendance UID U dengan waktu server | P2 | Belum dijalankan |
| T-11 | Ganda bersamaan | Dua klien dengan UID U mengirim ke S bersamaan, lalu retry | Tepat satu dokumen, rekap bertambah satu, tidak tertimpa | P2/P1 | Belum dijalankan |
| T-12 | Sesi tertutup/race | A menutup sesi sebelum write U dievaluasi; coba lagi | Write ditolak, tidak ada sukses palsu | P2/P1 | Belum dijalankan |
| T-13 | Bukan anggota/UID palsu | W presensi di S; U memakai UID V; coba update/delete presensi | Semua operasi terlarang ditolak database | P2/P1 | Belum dijalankan |
| T-14 | Real-time sesi | Dua perangkat lihat S; A membuka/menutup S | Badge/form perangkat U berubah tanpa refresh | P2 | Belum dijalankan |
| T-15 | Real-time rekap | A tetap di rekap, U presensi dari perangkat lain | Baris dan jumlah hadir berubah sekali tanpa restart | P2 | Belum dijalankan |
| T-16 | Persistensi | Tunggu konfirmasi write; tutup paksa app; buka dan login kembali | Sesi/presensi/izin/keputusan sama dengan server | P1/P2/P3 | Belum dijalankan |
| T-17 | Lifecycle/jaringan | Navigasi sesi berulang, logout U lalu login V; putus/sambung jaringan | Listener lama berhenti, tidak bocor data U; error dan retry jelas | P1/P2/P3 | Belum dijalankan |
| T-18 | Izin valid | U pilih sesi kelas, kirim alasan valid, buka ulang | Satu izin pending, alasan/UID/sesi sama | P3 | Belum dijalankan |
| T-19 | Izin invalid | Kirim spasi, melebihi batas, sesi kelas lain, status awal approved | Ditolak UI dan/atau Rules; tidak ada data invalid | P3/P1 | Belum dijalankan |
| T-20 | Izin ganda/privasi | Submit dua kali; V membaca/mengedit alasan U | Satu izin sesuai kebijakan, akses orang lain ditolak | P3/P1 | Belum dijalankan |
| T-21 | AI nyata berhasil | Panggil API pengajar sesuai kontrak pada alasan tersimpan | Respons valid tersimpan, status keputusan tidak berubah | P3 | Belum dijalankan |
| T-22 | Timeout/HTTP/jaringan | Simulasikan masing-masing timeout, respons HTTP gagal, koneksi gagal | Pengajuan tetap ada; AI failed; retry tersedia tanpa keputusan otomatis | P3 | Belum dijalankan |
| T-23 | Respons invalid/retry | Simulasikan payload bukan schema/kategori valid; retry dua kali; respons pertama terlambat | Respons invalid ditolak, percobaan lama tidak menimpa terbaru, izin tidak ganda | P3 | Belum dijalankan |
| T-24 | AI bukan pemutus | Berikan hasil AI valid apa pun, lalu terlambatkan respons hingga setelah keputusan asisten | Sebelum review tetap pending; sesudah review status final tidak berubah | P3/P1 | Belum dijalankan |
| T-25 | Terima manual | A membaca pengajuan, konfirmasi Terima; U tetap di halaman status | Approved, UID/waktu A tersimpan, U melihat tanpa restart | P3 | Belum dijalankan |
| T-26 | Tolak manual/AI gagal | Pada pengajuan lain AI gagal, A baca alasan dan konfirmasi Tolak | Rejected oleh A; kegagalan AI bukan keputusan | P3 | Belum dijalankan |
| T-27 | Pemeriksa bersamaan | A/B mengirim keputusan berbeda pada pengajuan pending yang sama | Keputusan pertama final; kedua mendapat hasil terbaru/konflik | P3/P1 | Belum dijalankan |
| T-28 | Anonim dan master | Klien tanpa Auth baca/tulis; U CRUD master | Ditolak; kontrol positif asisten tetap diizinkan | P1 | Belum dijalankan |
| T-29 | Pembatasan query | U query semua users/izin/presensi lalu query yang dibatasi haknya | Query lintas hak ditolak; query scoped yang sah berhasil | P1/P2/P3 | Belum dijalankan |
| T-30 | Field dan keputusan palsu | U update reviewer/status final/UID; sisipkan field tambahan/tipe salah/waktu palsu | Ditolak Rules; update sah sesuai whitelist berhasil | P1/P3 | Belum dijalankan |
| T-31 | UI/regresi | Uji route invalid, daftar kosong, batal sheet, alasan panjang, keyboard, lebar 320 px; cek pola Sprint 1 | Tidak crash/overflow; batal tanpa write; jadwal/detail/rekap tetap dapat dipakai | Semua | Belum dijalankan |
| T-32 | Kualitas/secret | Jalankan lint/typecheck; review diff/config/log/bundle untuk secret | Hasil aktual dicatat; tidak ada secret AI/admin/password; perbaikan oleh pemilik | Semua | Belum dijalankan |

P1 menguji setiap path Rules dengan create/read/update/delete yang diizinkan maupun dilarang, termasuk keanggotaan nonaktif dan penulisan AI menurut jalur kepercayaan terpilih. Tabel adalah daftar minimum, bukan pengganti uji query dan field aktual.

---

## 5. Skrip Demo 1 — Presensi

**Status: Belum dijalankan.** Gunakan sesi uji baru yang belum mempunyai attendance UID U. Dua perangkat diperlukan untuk membuktikan pembaruan real-time saat asisten tetap di layar, bukan hanya login bergantian pada satu perangkat.

1. **Asisten login** di perangkat A dengan akun asisten terpercaya. Buka Jadwal → detail sesi S; tunjukkan kelas, waktu, roster dan kondisi belum dibuka.
2. **Buka sesi** melalui konfirmasi. Tunjukkan dokumen sesi berubah `open`, `openedAt` terisi, dan rekap awal.
3. **Praktikan login** di perangkat U dengan akun anggota kelas K. Buka sesi yang sama; tunjukkan status terbuka tanpa memuat ulang aplikasi.
4. **Presensi:** isi catatan opsional, konfirmasi hadir dan submit. Tunggu konfirmasi server. Tunjukkan dokumen `sessions/{S}/attendances/{UID_U}` dengan waktu server serta status sukses UI.
5. **Rekap real-time:** perangkat A tetap di rekap; amati nama/waktu U dan jumlah hadir bertambah satu tanpa refresh/restart. Catat bukti kedua perangkat.
6. **Duplikasi:** kirim ulang untuk UID/sesi sama, termasuk klien uji jika tersedia. Tunjukkan tetap satu dokumen dan jumlah tidak bertambah.
7. **Tutup sesi:** A mengonfirmasi Tutup Sesi; tunjukkan status `closed` dan `closedAt`. Perangkat U menerima status baru. Praktikan lain yang belum hadir mencoba presensi dan harus ditolak.
8. **Persistensi:** setelah semua write dikonfirmasi, tutup aplikasi U dan buka kembali; login bila perlu. Tunjukkan catatan presensi dan sesi tertutup tetap sama; jangan reset data.

**Target bukti:** UID/path dokumen disamarkan seperlunya, timestamp, perubahan jumlah di perangkat A, penolakan duplikasi/presensi tertutup, dan hasil baca setelah restart. Semua target belum dibuktikan.

---

## 6. Skrip Demo 2 — Izin

**Status: Belum dijalankan.** Gunakan sesi lain dan UID yang belum mempunyai pengajuan. API nyata dan kontraknya harus tersedia; jika belum tersedia, catat demo integrasi AI terhambat dan jangan menggantinya dengan respons buatan yang diklaim nyata.

1. **Praktikan login** pada perangkat U, buka detail sesi kelasnya → Ajukan Izin.
2. **Ajukan izin:** isi alasan valid, kirim, tunggu konfirmasi Firestore. Tunjukkan dokumen dengan alasan, UID, sessionId dan `status = pending`, field pemeriksa masih null.
3. **Klasifikasi AI:** jalankan alur API pengajar; tunjukkan state processing lalu hasil tervalidasi tersimpan pada objek AI. Tunjukkan status keputusan tetap pending, tanpa tombol/aksi penerimaan otomatis.
4. **Asisten memeriksa:** login pada perangkat A, buka daftar pengajuan → detail. Tunjukkan alasan asli, informasi AI, identitas pemohon dan konteks sesi.
5. **Putuskan manual:** asisten memilih Terima atau Tolak lalu mengonfirmasi. Tunjukkan perubahan status akhir beserta reviewedBy/reviewedAt yang disimpan; hasil AI tetap terpisah.
6. **Pantau status:** perangkat U tetap di halaman status dan menerima keputusan tanpa restart. Tutup/buka aplikasi lalu pastikan keputusan tetap terbaca.
7. **Variasi keputusan:** gunakan pengajuan lain untuk membuktikan pilihan final yang belum dipakai; jangan mengubah keputusan pertama agar terlihat kedua jalur telah diuji.
8. **Variasi kegagalan AI:** gunakan pengajuan baru, simulasikan timeout/gagal API. Tunjukkan pengajuan tetap tersimpan, status AI gagal, retry terkendali dan keputusan tetap menunggu sampai asisten bertindak. Tunjukkan asisten dapat memutus manual dari alasan, serta respons AI terlambat tidak menimpa keputusan.

**Target bukti:** catatan request/response tanpa secret/data sensitif, field AI terpisah, klik keputusan manusia, timestamp/UID pemeriksa, sinkronisasi pemohon, dan kegagalan AI. Semua target belum dibuktikan.

---

## 7. Checklist Sign-off

Seluruh checkbox belum dijalankan; tidak boleh dicentang hanya karena dokumennya tersedia.

- [ ] SRS-01: T-01–T-05 diverifikasi.
- [ ] SRS-02: T-06–T-09 diverifikasi, termasuk delete nyata yang aman.
- [ ] SRS-03: T-10–T-13 diverifikasi di database.
- [ ] SRS-04: T-14–T-17 diverifikasi antarperangkat dan setelah restart.
- [ ] SRS-05: T-18–T-20 diverifikasi.
- [ ] SRS-06: T-21–T-24 diverifikasi; API nyata tersedia dan kegagalan diuji.
- [ ] SRS-07: T-25–T-27 diverifikasi; keputusan hanya oleh asisten.
- [ ] SRS-08: T-28–T-32 dan Rules seluruh path diverifikasi.
- [ ] Demo 1 dijalankan lengkap, hasil aktual dan bukti dicatat.
- [ ] Demo 2 dijalankan lengkap, hasil aktual dan bukti dicatat.
- [ ] `npx expo lint` dan `npx tsc --noEmit` integrasi fitur dijalankan.
- [ ] PM mengisi kondisi akhir dan form berdasarkan hasil sebenarnya.

| Nama | Peran | Tanggal | Persetujuan/catatan |
| --- | --- | --- | --- |
| Belum diisi | PM | Belum diisi | Belum diberikan |
| Belum diisi | P1 | Belum diisi | Belum diberikan |
| Belum diisi | P2 | Belum diisi | Belum diberikan |
| Belum diisi | P3 | Belum diisi | Belum diberikan |

---

## 8. Pencatatan Hasil dan Batasan

PM mencatat per uji: ID, waktu, lingkungan/perangkat, role/akun uji tersamarkan, langkah, hasil aktual, bukti, lulus/gagal/terhambat, serta pemilik tindak lanjut. Uji yang tidak dijalankan tetap **Belum dijalankan**; blocker bukan lulus. Hasil lint/typecheck baseline saat penyusunan dokumentasi tidak membuktikan SRS Firebase.

Informasi API pengajar, pilihan jalur kepercayaan AI, provisioning asisten, detail hapus aman, dan persetujuan model data masih perlu penyelesaian sesuai [prd.md](./prd.md). Rancangan tidak mengklaim fitur, Rules, atau pengujian Sprint 2 telah diimplementasikan.
