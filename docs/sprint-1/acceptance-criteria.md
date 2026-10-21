# Acceptance Criteria dan Skrip Demo

Dokumen ini dipakai PM untuk menilai hasil sprint. Setiap kriteria harus bisa dibuktikan lewat langkah konkret di aplikasi.

---

## 1. Traceability Kebutuhan

| Kebutuhan tugas | Layar | AC |
| --- | --- | --- |
| Jadwal dan detail sesi | Jadwal, Detail Sesi | AC-03, AC-04 |
| Pengelolaan sesi (buka/tutup) | Detail Sesi (asisten) | AC-05, AC-06 |
| Pencatatan presensi | Detail Sesi (praktikan) | AC-07, AC-08, AC-09 |
| Rekap sederhana | Rekap, Kehadiran | AC-10, AC-11 |
| Interaksi jelas (form + modal/bottom sheet) | Pilih Peran, Detail Sesi | AC-13, AC-14 |
| Data lokal/dummy & pilihan peran | Pilih Peran, Profil | AC-01, AC-16 |
| Flexbox, navigasi, state | Semua | AC-02, AC-15 |
| Empty state & state khusus | Jadwal, Detail, Rekap, Kehadiran | AC-12 |
| Alur demo konsisten | Semua | AC-16 |
| Guard & state tidak ditemukan | Semua | AC-18 |

---

## 2. Acceptance Criteria

### AC-01 — Form pilih peran dan identitas

**Given** aplikasi dibuka dan belum ada pengguna aktif
**When** pengguna memilih peran Praktikan
**Then**
- daftar identitas hanya berisi praktikan,
- tombol Masuk disabled sampai salah satu identitas dipilih,
- memilih identitas lalu menekan Masuk menyimpan `currentUser` dan membuka `/jadwal`.

**When** pengguna memilih peran Asisten
**Then** daftar identitas hanya berisi asisten dan alur masuk sama.

**When** pengguna mengganti peran
**Then** pilihan identitas sebelumnya direset.

---

### AC-02 — Navigasi dan tab sesuai peran

**Given** pengguna aktif adalah praktikan
**Then** tab yang terlihat: **Jadwal, Kehadiran, Profil**.

**Given** pengguna aktif adalah asisten
**Then** tab yang terlihat: **Jadwal, Rekap, Profil**.

**When** praktikan membuka `/rekap` langsung
**Then** diarahkan ke `/jadwal`.

**When** asisten membuka `/kehadiran` langsung
**Then** diarahkan ke `/jadwal`.

**When** tidak ada pengguna aktif dan membuka `/jadwal`
**Then** diarahkan ke `/`.

---

### AC-03 — Daftar jadwal

**Given** pengguna aktif adalah praktikan Budi (kelas A)
**Then** daftar hanya menampilkan sesi kelas A.

**Given** pengguna aktif adalah asisten
**Then** daftar menampilkan semua sesi dari semua kelas.

**Then** setiap kartu menampilkan:
- nama praktikum,
- kelas,
- topik,
- tanggal dan jam,
- ruang,
- badge status,
- meta kehadiran (asisten: `X/Y hadir`; praktikan: status kehadiran sendiri).

**Then** sesi berstatus `dibuka` tampil paling atas, disusul `dijadwalkan`, lalu `ditutup`.

**When** kartu ditekan
**Then** aplikasi membuka `/sesi/[sesiId]` yang sesuai.

---

### AC-04 — Detail sesi lengkap

**Given** sesi tersedia
**Then** detail menampilkan nama praktikum, kelas, topik, tanggal lengkap, jam, ruang, nama asisten, dan badge status.

**When** `sesiId` tidak ditemukan
**Then** tampil state “Sesi tidak ditemukan” dengan tombol kembali, bukan crash.

---

### AC-05 — Asisten membuka sesi

**Given** sesi berstatus `dijadwalkan` dan pengguna aktif adalah asisten
**Then** tombol **Buka Sesi** terlihat.

**When** asisten menekan Buka Sesi
**Then** muncul bottom sheet konfirmasi “Buka sesi sekarang?” dengan tombol Batal dan Ya, Buka Sesi.

**When** asisten mengonfirmasi
**Then**
- status sesi menjadi `dibuka`,
- badge di detail berubah menjadi **Dibuka**,
- badge di daftar jadwal ikut berubah,
- tombol berubah menjadi **Tutup Sesi**,
- praktikan di kelas tersebut sekarang melihat form presensi.

**When** asisten membuka detail sesi yang sudah `dibuka`
**Then** tombol Buka Sesi tidak muncul lagi.

---

### AC-06 — Asisten menutup sesi

**Given** sesi berstatus `dibuka` dan pengguna aktif adalah asisten
**Then** tombol **Tutup Sesi** berwarna danger terlihat.

**When** asisten menekan Tutup Sesi
**Then** muncul bottom sheet “Tutup sesi?” dengan peringatan bahwa praktikan tidak dapat presensi lagi.

**When** asisten mengonfirmasi
**Then**
- status sesi menjadi `ditutup`,
- badge di detail dan daftar berubah menjadi **Ditutup**,
- tombol kontrol hilang,
- form presensi praktikan hilang,
- rekap tetap dapat dibaca.

---

### AC-07 — Presensi hanya saat sesi dibuka

**Given** sesi `dijadwalkan`
**Then** praktikan melihat banner “Sesi belum dibuka” dan tidak ada form.

**Given** sesi `ditutup`
**Then** praktikan tidak melihat form; jika punya presensi, waktu kehadiran tetap tampil.

**Given** sesi `dibuka`
**Then** praktikan yang belum presensi melihat form presensi.

---

### AC-08 — Presensi berhasil dan waktu tercatat

**Given** sesi `dibuka`, praktikan belum presensi
**Then** form menampilkan:
- input catatan opsional (maks. 120 karakter),
- checkbox konfirmasi kehadiran,
- tombol **Konfirmasi Presensi** yang disabled sampai checkbox dicentang.

**When** praktikan mencentang checkbox dan menekan tombol
**Then** muncul bottom sheet konfirmasi berisi ringkasan sesi.

**When** praktikan menekan **Ya, Presensi**
**Then**
- record presensi ditambahkan ke state,
- tampil kartu sukses “Presensi berhasil”,
- waktu kehadiran ditampilkan dalam format `HH.mm`,
- tombol berubah menjadi **Sudah Presensi** dan disabled.

---

### AC-09 — Tidak bisa presensi dua kali

**Given** praktikan sudah presensi pada sesi tersebut
**Then**
- form presensi tidak ditampilkan lagi,
- UI menampilkan status sudah presensi beserta waktunya,
- menekan ulang tidak menambah record baru.

**When** pengguna berganti peran lalu kembali ke praktikan yang sama
**Then** record presensi masih ada dan status tetap sudah presensi.

**When** aksi `CATAT_PRESENSI` dikirim ulang untuk kombinasi sesi + praktikan yang sama
**Then** reducer mengabaikannya (tidak ada duplikasi).

---

### AC-10 — Asisten melihat rekap

**Given** sesi memiliki presensi
**Then** rekap menampilkan:
- nama praktikan,
- NIM,
- waktu presensi,
- badge **Hadir**,
- hitungan `X/Y hadir`,
- urutan waktu dari paling awal.

**Given** sesi belum memiliki presensi
**Then** tampil empty state “Belum ada praktikan yang melakukan presensi” dan hitungan `0/Y hadir`.

**When** praktikan melakukan presensi, lalu pengguna berganti ke asisten
**Then** rekap sesi tersebut sudah bertambah tanpa reload aplikasi.

---

### AC-11 — Praktikan melihat riwayat sendiri

**Given** praktikan Budi punya presensi pada sesi 1
**Then** tab Kehadiran menampilkan sesi 1 dengan status **Hadir · 10.04**.

**Then** sesi yang belum berlangsung menampilkan **Belum berlangsung**, sesi dibuka tanpa presensi menampilkan **Belum presensi**, dan sesi ditutup tanpa presensi menampilkan **Tidak hadir**.

**When** item riwayat ditekan
**Then** detail sesi yang sesuai terbuka.

---

### AC-12 — Empty state

**Then** state berikut tersedia:
- daftar jadwal kosong → “Belum ada jadwal”,
- rekap sesi kosong → “Belum ada praktikan yang melakukan presensi”,
- riwayat praktikan kosong → “Kamu belum memiliki catatan kehadiran”.

Untuk menguji jadwal/riwayat kosong, gunakan praktikan **Dewi Lestari** (kelas C yang belum memiliki sesi).

---

### AC-13 — Modal / Bottom Sheet

**Then** konfirmasi berikut memakai Modal atau Bottom Sheet:
- buka sesi,
- tutup sesi,
- konfirmasi presensi,
- ganti pengguna,
- reset data demo (jika dibuat).

**Then** sheet bisa ditutup dengan tombol Batal/backdrop/back Android tanpa mengubah state.

---

### AC-14 — Form

**Then** form dipakai minimal pada:
- pemilihan peran dan identitas,
- input catatan presensi + checkbox konfirmasi.

**Then** validasi form jelas: tombol disabled, helper text, dan input tidak menyebabkan crash.

---

### AC-15 — Flexbox dan responsif

**Then**
- layout memakai Flexbox, bukan position absolut untuk susunan utama,
- tidak ada horizontal scroll pada lebar 320 px,
- teks panjang tidak menumpuk (gunakan `flexShrink` dan `numberOfLines`),
- konten dibatasi `maxWidth: 800` dan center di layar lebar,
- tombol tetap dapat ditekan dengan nyaman (min. 44×44),
- safe area diterapkan.

---

### AC-16 — Konsistensi state selama aplikasi berjalan

**Then** setelah alur buka sesi → presensi → rekap → tutup sesi:
- status sesi sama di Jadwal, Detail, dan Rekap,
- jumlah hadir sama di Detail dan Rekap,
- riwayat praktikan sesuai record presensi,
- tidak ada data yang hilang saat berganti peran.

**Then** reload aplikasi mengembalikan data ke kondisi awal (bukan bug).

---

### AC-17 — Ganti pengguna dan reset demo

**Then** Ganti Pengguna mengosongkan `currentUser` dan kembali ke form peran tanpa menghapus data sesi/presensi.

**Then** Reset Data Demo (jika diimplementasikan) mengembalikan seluruh state ke `initialState` dan kembali ke form peran.

---

### AC-18 — Guard dan state tidak ditemukan

**Then**
- membuka tab yang bukan hak peran → redirect,
- membuka detail dengan id tidak valid → state “Sesi tidak ditemukan”,
- tidak ada error merah/console error pada semua skenario di atas.

---

## 3. Test Matrix

| ID | Skenario | Langkah | Hasil yang diharapkan | Status |
| --- | --- | --- | --- | --- |
| T-01 | Masuk sebagai praktikan | Buka app → pilih Praktikan → pilih Budi → Masuk | Tab Jadwal/Kehadiran/Profil muncul | ☐ |
| T-02 | Masuk sebagai asisten | Ganti pengguna → pilih Asisten → Nauval → Masuk | Tab Jadwal/Rekap/Profil muncul | ☐ |
| T-03 | Filter kelas | Masuk sebagai Budi | Hanya sesi kelas A yang tampil | ☐ |
| T-04 | Detail sesi | Tekan kartu sesi | Semua info sesi tampil | ☐ |
| T-05 | Buka sesi | Asisten → detail sesi `dijadwalkan` → Buka Sesi → konfirmasi | Badge menjadi Dibuka | ☐ |
| T-06 | Empty rekap | Setelah buka sesi, lihat rekap | `0/2 hadir` + empty state | ☐ |
| T-07 | Presensi | Ganti ke Budi → detail sesi dibuka → isi catatan → centang → konfirmasi | Kartu sukses + waktu | ☐ |
| T-08 | Duplikasi | Tetap di detail setelah presensi | Form hilang, tombol Sudah Presensi | ☐ |
| T-09 | Rekap terisi | Ganti ke asisten → detail sesi | Budi + NIM + waktu + `1/2 hadir` | ☐ |
| T-10 | Tutup sesi | Asisten → Tutup Sesi → konfirmasi | Badge Ditutup, tombol hilang | ☐ |
| T-11 | Presensi setelah tutup | Ganti ke Budi → detail sesi | Tidak ada form; presensi lama tetap tampil | ☐ |
| T-12 | Riwayat | Buka tab Kehadiran sebagai Budi | Sesi 1 Hadir, sesi 2 Hadir, sesi 3 Belum berlangsung | ☐ |
| T-13 | Riwayat kosong | Ganti ke Dewi (kelas C) → Kehadiran | Empty state riwayat | ☐ |
| T-14 | Jadwal kosong | Ganti ke Dewi → Jadwal | Empty state jadwal | ☐ |
| T-15 | Guard | Praktikan buka `/rekap` | Redirect ke `/jadwal` | ☐ |
| T-16 | Sesi tidak ditemukan | Buka `/sesi/tidak-ada` | State “Sesi tidak ditemukan” | ☐ |
| T-17 | Modal batal | Buka sheet lalu tekan Batal | State tidak berubah | ☐ |
| T-18 | Responsif | Kecilkan lebar layar ke 320 px | Tidak ada horizontal scroll | ☐ |
| T-19 | Ganti pengguna | Profil → Ganti Pengguna | Kembali ke form peran, data sesi tetap | ☐ |
| T-20 | Reload | Reload app | Data kembali ke kondisi awal | ☐ |

---

## 4. Skrip Demo

Demo dilakukan dari kondisi **reload bersih**.

### Persiapan

- [ ] Aplikasi terbuka di HP/emulator.
- [ ] Reload aplikasi agar state kembali ke awal.
- [ ] Pastikan data sesi hari ini (`sesi-2`) masih `dijadwalkan`.

### Langkah

1. **Masuk sebagai asisten**
   - Pilih peran **Asisten**.
   - Pilih **Nauval**.
   - Tekan **Masuk**.
   - Tunjukkan tab **Jadwal, Rekap, Profil**.

2. **Tunjukkan jadwal**
   - Jelaskan kartu sesi: nama praktikum, kelas, topik, waktu, ruang, status.
   - Tunjukkan sesi hari ini berstatus **Dijadwalkan**.

3. **Buka sesi**
   - Tekan sesi **Komponen & Layout**.
   - Tunjukkan detail dan tombol **Buka Sesi**.
   - Tekan Buka Sesi → tunjukkan bottom sheet konfirmasi → tekan **Ya, Buka Sesi**.
   - Tunjukkan badge berubah menjadi **Dibuka** dan tombol menjadi **Tutup Sesi**.
   - Tunjukkan rekap masih `0/2 hadir` dengan empty state.

4. **Ganti ke praktikan**
   - Buka tab **Profil** → **Ganti Pengguna** → konfirmasi.
   - Pilih peran **Praktikan**, pilih **Budi Santoso**, tekan **Masuk**.
   - Buka tab **Jadwal** → buka sesi yang sama.

5. **Lakukan presensi**
   - Tunjukkan form presensi.
   - Isi catatan, mis. “Hadir di Lab 3”.
   - Centang konfirmasi.
   - Tekan **Konfirmasi Presensi** → tunjukkan bottom sheet → tekan **Ya, Presensi**.
   - Tunjukkan kartu **Presensi berhasil** beserta waktu.
   - Tunjukkan form hilang dan tombol menjadi **Sudah Presensi**.

6. **Buktikan tidak bisa dua kali**
   - Tetap di layar; jelaskan tombol disabled dan status sudah presensi.
   - (Opsional) kembali ke jadwal lalu buka sesi lagi; status tetap sudah presensi.

7. **Lihat rekap sebagai asisten**
   - Profil → Ganti Pengguna → Asisten → Nauval → Masuk.
   - Buka tab **Rekap** → buka sesi yang sama.
   - Tunjukkan nama Budi, NIM, waktu, badge Hadir, dan hitungan `1/2 hadir`.

8. **Tutup sesi**
   - Masih di detail sesi, tekan **Tutup Sesi**.
   - Tunjukkan bottom sheet peringatan → tekan **Ya, Tutup Sesi**.
   - Tunjukkan badge **Ditutup**, tombol kontrol hilang, rekap tetap ada.

9. **Cek riwayat praktikan**
   - Ganti ke Budi → tab **Kehadiran**.
   - Tunjukkan sesi yang tadi berstatus **Hadir** dengan waktu.
   - Buka detailnya; tunjukkan sesi sudah ditutup dan presensi tetap tercatat.

10. **Tunjukkan empty state (opsional)**
    - Ganti ke **Dewi Lestari** (kelas C).
    - Tunjukkan jadwal kosong dan riwayat kosong.

### Hasil akhir demo

- Asisten berhasil membuka sesi.
- Praktikan berhasil presensi dan waktunya tercatat.
- Asisten melihat rekap yang sesuai.
- Asisten menutup sesi.
- Status dan data konsisten di kedua peran.

---

## 5. Checklist Sign-off

| Area | Kriteria | Lulus | Catatan |
| --- | --- | --- | --- |
| Form peran | AC-01 | ☐ | |
| Navigasi | AC-02 | ☐ | |
| Jadwal | AC-03 | ☐ | |
| Detail sesi | AC-04 | ☐ | |
| Buka sesi | AC-05 | ☐ | |
| Tutup sesi | AC-06 | ☐ | |
| Aturan presensi | AC-07, AC-08, AC-09 | ☐ | |
| Rekap | AC-10 | ☐ | |
| Riwayat | AC-11 | ☐ | |
| Empty state | AC-12 | ☐ | |
| Modal/Bottom Sheet | AC-13 | ☐ | |
| Form | AC-14 | ☐ | |
| Responsif | AC-15 | ☐ | |
| Konsistensi state | AC-16 | ☐ | |
| Ganti pengguna/reset | AC-17 | ☐ | |
| Guard/not found | AC-18 | ☐ | |
| Typecheck | `npx tsc --noEmit` | ☐ | |
| Lint | `npx eslint .` | ☐ | |
| Demo | Skrip demo | ☐ | |

Disetujui oleh:

| Nama | Peran | Tanggal | Tanda tangan |
| --- | --- | --- | --- |
| | PM | | |
| | Dev 1 | | |
| | Dev 2 | | |
| | Dev 3 | | |

---

## 6. Batasan yang Diketahui

- Data hilang saat aplikasi di-reload; ini sesuai scope sprint.
- Tidak ada sinkronisasi antar perangkat.
- Tidak ada status terlambat/alpha; tidak hadir = tidak ada record.
- Sesi yang ditutup tidak bisa dibuka kembali.
- Asisten dapat mengelola semua sesi; belum ada pembatasan kepemilikan sesi.
- Waktu memakai jam perangkat, bukan jam server.
- Tidak ada autentikasi; pemilihan identitas hanya untuk demo.
