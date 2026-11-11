# Pembagian Tugas dan Alur Kerja

Dokumen ini membagi pekerjaan kepada **1 PM + 3 Programmer**. Checklist adalah rencana; seluruhnya belum dijalankan. Nama anggota diisi PM sebelum eksekusi. Ownership Sprint 2 menggantikan pembagian D1/D2/D3 pada dokumen Sprint 1 untuk pekerjaan baru ini.

---

## 1. Tim dan Branch

| Kode | Peran | Branch | Nama |
| --- | --- | --- | --- |
| PM | Project Manager | `main` | Belum ditetapkan |
| P1 | Firebase Authentication & Security | `feature/firebase-auth` | Belum ditetapkan |
| P2 | Data Praktikum & Presensi | `feature/practicum-attendance` | Belum ditetapkan |
| P3 | Pengajuan Izin & Integrasi AI | `feature/permission-ai` | Belum ditetapkan |

PM menangani planning, koordinasi, review, konflik, merge dan verifikasi. **PM tidak mengambil alih setup Firebase atau implementasi fitur. Seluruh setup Firebase adalah tanggung jawab P1.**

---

## 2. Aturan Contract-First dan Dependensi

1. PM memimpin kesepakatan [data-model.md](./data-model.md): nama koleksi, field, UID, role, scope asisten, status, kebijakan hapus dan batas validasi.
2. P1 menyediakan kontrak Auth/profil/readiness, instance Firebase dan rancangan Rules. P2/P3 boleh menyiapkan komponen/adaptor terhadap kontrak sementara tanpa menganggap integrasi sudah terbukti.
3. P2 memberikan ID kelas/sesi dan lookup keanggotaan kepada P3. P3 tidak membuat sesi/keanggotaan versi sendiri.
4. P2/P3 menyerahkan query dan field tulis agar P1 dapat menguji Rules/indeks. P1 tidak menulis fitur CRUD/izin sebagai pengganti mereka.
5. P3 memperoleh kontrak API dari pengajar melalui koordinasi PM. Jika belum ada, kerjakan persistence/form/error state; catat integrasi AI belum dapat diverifikasi.
6. Perubahan kontrak diumumkan sebelum implementasi/PR. PM mengatur urutan edit dan review, programmer pemilik file membuat perubahan.

```text
M0: PM + tim menyepakati SRS dan kontrak
  → P1: setup Firebase + UID/role + akses dasar
      → P2: CRUD + sesi + presensi + real-time
          → P3: integrasi izin ke ID sesi dan kelas
      → P3: form/persistence izin paralel + API setelah kontrak pengajar tersedia
  → P1: Rules akhir sesuai query P2/P3
  → PM: review/merge bertahap + dua demo + kondisi akhir
```

---

## 3. Peta Kepemilikan File

**Existing** berarti ditemukan saat inspeksi. **Baru/usulan** berarti belum ada dan hanya rekomendasi untuk implementasi nanti. Tidak satu pun file aplikasi di bawah dibuat/diubah oleh tugas dokumentasi ini.

| Area/path | Kondisi | Penulis tunggal Sprint 2 | Batas koordinasi |
| --- | --- | --- | --- |
| `src/types/models.ts`, `src/types/firebase-contracts.ts` | Existing; kedua baru/usulan | P1 | Shared: P2/P3 mengirim kontrak domain, P1 menyatukan |
| `src/store/app-context.tsx`, `src/store/auth-context.tsx` | Existing; kedua baru/usulan | P1 | Shared: lifecycle/cache/Auth; tidak memasukkan I/O ke reducer |
| `src/services/firebase/` | Baru/usulan | P1 | Satu inisialisasi untuk P2/P3 |
| `src/features/auth/` | Baru/usulan | P1 | Login/registrasi/pemulihan profil |
| `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/profil.tsx` | Existing | P1 | Global: provider, guard, entry dan profil; PM mengurutkan integrasi |
| `package.json`, `package-lock.json`, konfigurasi environment, `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Dua pertama existing; konfigurasi Firebase baru/usulan | P1 | Hanya jika diperlukan saat implementasi; PM review; secret tidak di-commit |
| `app.json`, `eas.json`, `tsconfig.json`, `eslint.config.js` | Existing | P1 bila perlu | Global: perubahan minimum dengan koordinasi PM; jangan edit native manual |
| `src/components/ui/**`, `src/constants/theme.ts`, `src/utils/date.ts` | Existing | P1 | P2/P3 memakai ulang; kebutuhan perubahan disampaikan ke P1 |
| `src/store/selectors.ts` | Existing | P2 | Shared: perubahan adapter/join diumumkan; P3 menulis selector izin di modulnya |
| `src/app/sesi/[sesiId].tsx`, `src/features/sesi/SessionDetailScreen.tsx` | Existing | P2 | Orkestrator detail; P1 memasok guard, P3 memasok link/props izin |
| `src/features/jadwal/**`, `src/features/kehadiran/**`, `src/features/rekap/**` | Existing | P2 | Jadwal, riwayat, rekap dua peran |
| `src/features/sesi/praktikan/**`, `src/features/sesi/asisten/**` | Existing | P2 | Semua kontrol sesi/presensi, termasuk bagian asisten yang dulu dimiliki D3 |
| `src/app/(tabs)/jadwal.tsx`, `src/app/(tabs)/kehadiran.tsx`, `src/app/(tabs)/rekap.tsx` | Existing | P2 | Route tetap tipis |
| `src/components/domain/SessionCard.tsx`, `src/components/domain/AttendanceRow.tsx` | Existing | P2 | P3 menggunakan tanpa edit langsung |
| `src/services/practicum/`, `src/services/attendance/`, `src/features/praktikum/`, `src/app/praktikum/index.tsx` | Baru/usulan | P2 | CRUD dan listener domain; konfigurasi Firebase tetap P1 |
| `src/features/izin/`, `src/services/leave/`, `src/services/ai/`, `src/app/izin/[sesiId].tsx`, `src/app/pemeriksaan-izin/index.tsx` | Baru/usulan | P3 | Pengajuan, status, AI, pemeriksaan; tidak menulis data master |
| `tests/core.test.cjs` | Existing | P1 sebagai koordinator baseline | Jangan menimpa tes lama; tambahan tes domain file terpisah oleh P2/P3 |
| `src/data/dummy.ts` | Existing | Tidak diubah untuk seed produksi | Pertahankan baseline; P2 menyiapkan data uji remote lewat fitur/alat yang disepakati |
| `docs/sprint-2/*.md` | Dokumentasi sprint | PM saat pelaksanaan | Keputusan dan kondisi akhir; jangan mengubah `docs/sprint-1/` |

File shared tidak dikerjakan secara simultan. Contoh: P3 meminta tombol izin pada detail; P3 menyediakan route dan kontrak props, P2 memasang tombol pada `SessionDetailScreen`, PM memeriksa diff. Konflik pada provider/types ditangani P1; PM memfasilitasi dan menggabungkan hasil, bukan menulis ulang fitur.

---

## 4. Detail Tugas P1 — Firebase Authentication & Security

**Scope:** seluruh setup Firebase Project, pendaftaran aplikasi/config, aktivasi Auth dan Firestore, pemilihan/pemasangan SDK kompatibel Expo 58, provisioning akun asisten, environment, indeks, Rules dan pengujian akses.

- [ ] Dapatkan akses Firebase, buat/pilih lingkungan uji, aktifkan provider dan Firestore.
- [ ] Sediakan client tunggal serta kontrak UID/role/readiness untuk P2/P3.
- [ ] Implementasikan registrasi praktikan, login, logout dan pemulihan profil yang gagal dibuat.
- [ ] Implementasikan observer Auth/profil, guard role dan cleanup cache saat akun berganti.
- [ ] Pastikan registrasi/update profil tidak dapat mempromosikan diri menjadi asisten.
- [ ] Sesuaikan provider/types/global UI seperlunya sambil mempertahankan baseline Sprint 1.
- [ ] Tulis Rules whitelist field dan kewenangan sesuai query nyata P2/P3; deploy ke lingkungan uji setelah pengujian.
- [ ] Catat cara konfigurasi tanpa membagikan password, secret AI atau service account.

**Deliverables:** konfigurasi/kontrak Firebase untuk tim, fitur Auth, akun uji dua role, Rules/indeks, bukti pengujian SRS-01 dan SRS-08. **Acceptance:** UID konsisten, akses ilegal ditolak di database, P2/P3 dapat memakai koneksi yang sama. **Batas:** P1 tidak mengambil CRUD/presensi atau alur izin/AI.

---

## 5. Detail Tugas P2 — Data Praktikum & Presensi

- [ ] Implementasikan CRUD kelas, anggota/peserta, jadwal dan sesi sesuai kontrak; validasi relasi dan strategi hapus.
- [ ] Sajikan informasi sesuai role/kelas dengan adapter ke UI existing.
- [ ] Implementasikan buka/tutup sesi oleh asisten dan mapping status server ke label UI.
- [ ] Catat presensi dengan UID, ID dokumen tetap, waktu server dan proteksi duplikasi database bersama P1.
- [ ] Hubungkan jadwal, detail, kehadiran, dan rekap ke data Firestore.
- [ ] Pasang listener terbatasi untuk sesi/presensi/roster; cleanup saat scope/akun berubah.
- [ ] Tangani loading, empty, denied, not-found, kegagalan jaringan, write pending dan retry.
- [ ] Sediakan ID/detail sesi, lookup anggota dan slot tautan izin untuk P3; serahkan daftar query/indeks ke P1.

**Deliverables:** CRUD empat entitas, kontrol sesi, presensi tunggal, rekap/riwayat real-time dan bukti SRS-02–SRS-04. **Acceptance:** dua perangkat sinkron, satu dokumen UID/sesi saat request bersamaan, data tetap setelah buka ulang. **Batas:** P2 tidak setup Firebase, mengubah role, menulis keputusan izin, atau memanggil AI.

---

## 6. Detail Tugas P3 — Pengajuan Izin & Integrasi AI

- [ ] Buat form alasan berdasarkan sesi dan UID aktif dengan validasi yang disepakati.
- [ ] Simpan `pending`, alasan dan audit sebelum memanggil AI; tampilkan status sendiri.
- [ ] Konfirmasi kontrak API pengajar; buat adaptor, validasi respons dan simpan hasil terpisah.
- [ ] Tangani timeout, HTTP/jaringan gagal, respons invalid, retry terbatas dan respons terlambat.
- [ ] Sediakan daftar/detail pengajuan asisten dan konfirmasi keputusan terima/tolak manual.
- [ ] Lindungi keputusan bersamaan lewat transaksi/status guard dan Rules P1.
- [ ] Pasang listener pemohon/asisten dengan cleanup; kirim ringkasan izin ke UI P2 melalui kontrak.
- [ ] Pastikan tidak ada kategori AI yang otomatis mengubah `pending` menjadi keputusan final.

**Deliverables:** form/persistence izin, adaptor AI nyata bila kontrak tersedia, status klasifikasi, pemeriksaan dan listener keputusan; bukti SRS-05–SRS-07. **Acceptance:** kedua status final teruji, kegagalan AI tidak menghilangkan pengajuan, pemohon melihat keputusan real-time. **Batas:** P3 tidak mengarang endpoint/key/kategori, memodifikasi role, setup Firebase, atau mengedit orkestrator P2 langsung.

---

## 7. Detail Tugas PM

### 15 menit awal

- [ ] Analisis delapan kebutuhan, susun SRS dan acceptance criteria.
- [ ] Tetapkan nama/PIC, task board, branch, ownership dan kontrak bersama tim.
- [ ] Isi form awal sesuai kolom pengajar yang sebenarnya; URL/format belum tersedia.

### 60 menit eksekusi

- [ ] Pantau progres per SRS: belum mulai/sedang/review/blocker, terpisah dari status verifikasi.
- [ ] Koordinasikan kebutuhan akses P1 dan kontrak API P3 kepada pihak yang tepat.
- [ ] Review diff, bukti uji, perubahan schema/Rules dan kepatuhan ownership.
- [ ] Tangani konflik dengan melibatkan programmer pemilik file dan penulis perubahan.
- [ ] Merge bertahap ke `main` setelah perubahan terkait terverifikasi.
- [ ] Jalankan dua demo serta cek regresi baseline; bug dikembalikan ke programmer pemilik.

### 15 menit akhir

- [ ] Koordinasikan kondisi akhir; bedakan selesai, gagal uji, belum dijalankan, dan terhambat.
- [ ] Isi form akhir sesuai bukti, bukan target rancangan.
- [ ] Pastikan programmer menulis flow kode dan menyerahkannya kepada asisten praktikum.

**Deliverables:** SRS/task board, catatan keputusan, hasil review/integrasi, bukti dua demo, kondisi akhir dan form awal/akhir. **Acceptance:** setiap klaim memiliki bukti; yang belum teruji tetap Belum Terverifikasi. **Batas:** tidak mengambil alih setup Firebase atau implementasi fitur programmer.

---

## 8. Timeline Praktikum — 90 Menit

| Menit | PM | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| 00–15 | SRS, pembagian kerja, form awal, fasilitasi kontrak | Membaca baseline/kontrak dan kebutuhan akses | Membaca domain/ownership | Membaca kontrak dan menyiapkan pertanyaan API |
| 15–25 | Pantau blocker dan review kontrak | Clone bila belum ada, feature branch; setup Firebase/SDK | Clone bila belum ada, feature branch; UI CRUD/adaptor terhadap kontrak | Clone bila belum ada, feature branch; form/persistence interface, cek API pengajar |
| 25–30 | Review fondasi kecil | Auth/UID/role dan client untuk tim | Sinkronkan kontrak P1, mulai data kelas/sesi | Sinkronkan kontrak P1/P2; jangan membuat ID sesi sendiri |
| 30–45 | Review bertahap, koordinasi indeks/Rules | Auth, guard, pemulihan profil, Rules dasar | CRUD dan buka/tutup/presensi database | Persistence izin, adaptor AI dan failure state |
| 45–55 | Pantau hasil uji modul | Rules negatif dan lifecycle akun | Listener/rekap dan uji duplikasi | Pemeriksaan/status listener dan uji AI gagal |
| 55–65 | Review/merge fondasi → P2 → P3, konflik bersama pemilik | Perbaikan fondasi/Rules | Perbaikan domain dan slot integrasi | Perbaikan izin/AI |
| 65–75 | Dua demo, cek bukti dan regresi | Mendampingi QA/fix modul; commit/push branch sendiri | Mendampingi QA/fix modul; commit/push branch sendiri | Mendampingi QA/fix modul; commit/push branch sendiri |
| 75–90 | Kondisi akhir dan form akhir | Tulis flow kode di kertas, kirim kepada asisten praktikum | Tulis flow kode di kertas, kirim kepada asisten praktikum | Tulis flow kode di kertas, kirim kepada asisten praktikum |

Jendela implementasi programmer tetap **15–75 (60 menit)**. Clone adalah langkah workflow bagi anggota yang belum mempunyai salinan; repository yang sedang terbuka sudah tersedia, sehingga tugas dokumentasi ini tidak melakukan clone. Jika fondasi/API terlambat, gunakan UI/adaptor dan pengujian terisolasi untuk progres mandiri, tetapi integrasi nyata tetap belum terverifikasi. Jangan menghilangkan Rules atau memalsukan hasil AI untuk mengejar waktu.

---

## 9. Git Workflow dan Conventional Commits

Panduan berikut untuk pelaksanaan sprint mendatang; bukan perintah yang dijalankan saat membuat dokumen ini.

### Feature branch programmer

Setelah repository anggota tersedia dan working tree aman, contoh P1:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/firebase-auth
```

P2/P3 mengganti nama branch dengan branch masing-masing pada tabel tim. Jika branch sudah ada, gunakan branch existing, bukan membuat ulang. Sebelum PR, sinkronkan tanpa menulis ulang history:

```bash
git fetch origin
git merge origin/main
npx expo lint
npx tsc --noEmit
```

Selesaikan konflik bersama pemilik file, lalu periksa kembali modul. Stage file milik tugas sendiri secara eksplisit; jangan memasukkan secret, file build, `node_modules`, atau perubahan orang lain. Commit format **`type(scope): deskripsi singkat`**, baris kosong, kemudian body yang menjelaskan perubahan dan alasan. Hasil pengujian hanya ditulis bila benar-benar dijalankan.

### Contoh P1 — header dan body

```text
feat(auth): integrasikan identitas Firebase berbasis UID

Tambahkan registrasi praktikan, login, logout dan pembacaan profil.
Batasi perubahan role serta sediakan kontrak Auth untuk modul lain.
Hubungkan perubahan ini dengan SRS-01 dan SRS-08.
```

### Contoh P2 — header dan body

```text
feat(attendance): simpan presensi tunggal per sesi di Firestore

Gunakan dokumen presensi berdasarkan UID dan validasi sesi terbuka.
Perbarui rekap melalui listener dengan cleanup saat scope berubah.
Hubungkan perubahan ini dengan SRS-02, SRS-03 dan SRS-04.
```

### Contoh P3 — header dan body

```text
feat(permission): tambahkan pengajuan izin dan klasifikasi pendukung

Simpan alasan dan hasil AI terpisah dari keputusan manual asisten.
Tangani kegagalan API tanpa menghapus pengajuan yang telah tersimpan.
Hubungkan perubahan ini dengan SRS-05, SRS-06 dan SRS-07.
```

Contoh ini menggambarkan commit setelah implementasi terkait, bukan klaim kondisi repository sekarang. Push hanya ke branch sendiri:

```bash
# P1
git push -u origin feature/firebase-auth
# P2
git push -u origin feature/practicum-attendance
# P3
git push -u origin feature/permission-ai
```

PM meninjau PR beserta SRS terkait, daftar file, cara uji, hasil aktual, screenshot/rekaman yang aman, dan blocker. Urutan review/merge: fondasi P1 → domain P2 → domain P3 → revisi Rules/global oleh P1 sesuai query final. PR kecil dari branch yang sama dapat dipakai untuk mempercepat kontrak; tidak perlu branch tambahan. Tidak ada programmer push langsung ke `main`.

PM saja melakukan merge setelah hasil terkait terverifikasi. Jangan memakai force push atau hard reset; sinkronisasi cukup fetch/merge dan resolusi konflik yang direview.

---

## 10. Komunikasi dan Definition of Done per Task

Update progres memakai **selesai / sedang / blocker**, disertai SRS, file, bukti, dan kebutuhan bantuan. Blocker API menyebut informasi yang belum tersedia; blocker database menyertakan operasi/query, role dan error tanpa secret. PM menghubungkan blocker ke pemilik penyelesaiannya.

Semua item berikut belum dijalankan:

- [ ] Deliverable sesuai scope dan kontrak yang disepakati.
- [ ] Normal, loading, empty, error dan aksi ganda ditangani.
- [ ] Lint/typecheck dijalankan; hasil aktual dicatat di PR.
- [ ] Uji modul dan Rules relevan memiliki bukti; dummy tidak dianggap uji API nyata.
- [ ] File shared dan perubahan kontrak direview pemilik serta PM.
- [ ] Flow kode kertas menjelaskan input → proses/service → database/API → output/error pada modul sendiri.

---

## 11. Catatan Kondisi Akhir dan Form

Template ini diisi PM pada akhir praktikum, bukan hasil yang sudah tercapai.

| Item | Kondisi/bukti aktual |
| --- | --- |
| Waktu, anggota, perangkat dan lingkungan | Belum dicatat |
| SRS selesai dan bukti uji | Belum dicatat; seluruh SRS masih Belum Terverifikasi |
| SRS belum selesai/terhambat dan sebab | Belum dicatat |
| Hasil Demo 1 dan Demo 2 | Belum dijalankan |
| Branch/PR yang direview dan di-merge PM | Belum dicatat |
| Hasil lint/typecheck integrasi fitur | Belum dijalankan |
| Form awal/akhir dan bukti pengisian | Belum diisi; format dari pengajar belum tersedia |
| Flow kode kertas tiap programmer | Belum diserahkan |

PM menyalin informasi ke form pengajar yang sebenarnya; tabel ini tidak menggantikan form resmi.
