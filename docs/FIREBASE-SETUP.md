# Setup Firebase — Langkah Lengkap (P1 Sprint 2)

Ikuti berurutan. Setiap langkah ada **cek berhasil**-nya.
Total waktu ±15 menit.

**Project Firebase tim:** `ppk-reactnative`
**Repo:** `ppk-rn-expo-58` · **Branch:** `feature/firebase-auth`

---

## Langkah 0 — Siapkan file `.env`

Di folder `ppk-rn-expo-58`:

```bash
copy .env.example .env
```

**Cek berhasil:** file `.env` ada di folder project, isinya 6 baris `EXPO_PUBLIC_FIREBASE_*`.

> `.env` sudah ada di `.gitignore`, jadi tidak akan ter-commit. `.env.example`
> sengaja di-commit karena konfigurasi klien Firebase bukan rahasia.

---

## Langkah 1 — Aktifkan Email/Password

1. Buka https://console.firebase.google.com
2. Pilih project **ppk-reactnative**
3. Sidebar kiri → **Build → Authentication**
4. Klik **Get started** (kalau belum pernah)
5. Tab **Sign-in method**
6. Klik **Email/Password** pada daftar provider
7. Toggle **Enable** → **Save**

**Cek berhasil:** di daftar Sign-in method, **Email/Password** tampil dengan status
**Enabled**.

> Kalau langkah ini dilewati, registrasi akan gagal dengan pesan
> "Metode Email/Password belum diaktifkan di Firebase Console."

---

## Langkah 2 — Buat Firestore

1. Sidebar → **Build → Firestore Database**
2. Klik **Create database**
3. Pilih **Start in production mode** → **Next**
4. Location: **asia-southeast2 (Jakarta)** → **Create/Enable**
5. Tunggu sampai database siap

**Cek berhasil:** tab **Data** menampilkan "Start collection", tab **Rules** bisa dibuka.

> Kalau Firestore sudah ada dari Sprint 1, lewati ke Langkah 3.

---

## Langkah 3 — Pasang Security Rules

Ini bagian terpenting P1. Rules yang salah bikin aplikasi tidak bisa menulis
data, atau sebaliknya terlalu longgar.

1. Buka **Firestore Database → tab Rules**
2. Hapus semua isi editor
3. Buka file `firestore.rules` dari repo, **copy seluruh isinya**, tempel ke editor
4. Klik **Publish**

**Cek berhasil:** muncul notifikasi "Rules published successfully", dan tab Rules
menampilkan rules baru tanpa tanda error merah.

Isi rules mencakup:

| Koleksi | Baca | Create | Update |
| --- | --- | --- | --- |
| `users/{uid}` | pemilik / asisten | pemilik, `role` wajib `praktikan` | pemilik, hanya nama/nim/nip |
| `classes` | asisten / anggota kelas | asisten | asisten |
| `classMembers` | asisten / pemilik | asisten | asisten |
| `schedules` | asisten / anggota kelas | asisten | asisten |
| `sessions` | asisten / anggota kelas | asisten | asisten (transisi saja) |
| `sessions/{id}/attendances/{uid}` | pemilik / asisten | praktikan, sesi `open` | ❌ ditolak |
| `leaveRequests` | pemilik / asisten | praktikan, `pending` | asisten (keputusan) / pemilik (`ai`) |

---

## Langkah 4 — Uji registrasi & login

Jalankan aplikasi:

```bash
npx expo start --web
```

Buka `http://localhost:8081` (atau port yang muncul di terminal).

### 4a. Registrasi praktikan

1. Klik tab **Daftar**
2. Isi Nama = `Budi Santoso`, Email = `budi@example.com`, Password = `rahasia123`
3. Klik **Buat Akun Praktikan**

**Cek berhasil:**
- Masuk ke halaman **Jadwal**
- Firebase Console → **Authentication → Users** ada akun `budi@example.com`
- Firestore → **users** ada dokumen dengan nama `Budi Santoso` dan `role: praktikan`

### 4b. Uji logout

1. Buka tab **Profil**
2. Klik **Keluar** → konfirmasi **Ya, Keluar**

**Cek berhasil:** kembali ke halaman login.

### 4c. Uji login ulang

1. Isi email + password yang sama
2. Klik **Masuk**

**Cek berhasil:** masuk ke **Jadwal** tanpa error.

### 4d. Uji "status login bertahan" (SRS-01)

1. Masih dalam keadaan login
2. **Refresh browser** (F5)

**Cek berhasil:** tetap di **Jadwal**, tidak dilempar ke halaman login.

> Di web, Firebase menyimpan sesi di IndexedDB. Di Android/iOS nanti memakai
> AsyncStorage (lihat Langkah 7).

---

## Langkah 5 — Uji role & tolak eskalasi (bukti SRS-08)

Ini yang membuktikan "akses tidak sah ditolak oleh database, bukan hanya disembunyikan UI".

### 5a. Buat akun asisten (provisioning)

Registrasi mandiri **selalu** menghasilkan praktikan. Untuk asisten:

1. Registrasi akun kedua lewat aplikasi, email `asisten@example.com`
2. Buka **Firestore Database → users**
3. Cari dokumen dengan `email: asisten@example.com`
4. Klik dokumen itu → ubah field `role` dari `praktikan` menjadi `asisten` → **Update**
5. Di aplikasi, logout lalu login dengan akun asisten

**Cek berhasil:** tab **Kehadiran** hilang, tab **Rekap** muncul.

### 5b. Bukti praktikan tidak bisa menaikkan role

Coba dari Console (simulasi serangan):

1. Login sebagai **praktikan** di aplikasi (jangan logout dulu)
2. Buka **Firestore → users → dokumen praktikan**
3. Ubah `role` menjadi `asisten` → **Update**

> Catatan: di Console kamu punya akses admin penuh, jadi perubahan **akan berhasil**.
> Console bukan simulasi yang tepat. Untuk uji penolakan, gunakan **Rules Playground**
> (langkah berikut).

### 5c. Uji penolakan lewat Rules Playground

1. Firebase Console → **Firestore Database → Rules → Rules Playground**
2. Isi:
   - **Simulation type**: `update`
   - **Location**: `users/UID_PRAKTIKAN` (salin UID dari Authentication → Users)
   - **Authenticated**: ON, isi UID praktikan
   - **Firestore document**: isi dengan data dokumen user saat ini tapi `role` = `"asisten"`
3. Klik **Run**

**Cek berhasil:** hasilnya **Denied** — inilah bukti role tidak bisa dinaikkan dari klien.

Ulangi dengan uji lain:

| Uji | Location | Operasi | Hasil yang diharapkan |
| --- | --- | --- | --- |
| Praktikan buat kelas | `classes/kelas-x` | create | Denied |
| Praktikan baca presensi orang lain | `sessions/s1/attendances/UID_LAIN` | get | Denied |
| User belum login baca users | `users/UID_PRAKTIKAN` | get, auth OFF | Denied |
| Asisten buat kelas | `classes/kelas-x` | create, auth UID asisten | Allowed |

---

## Langkah 6 — Siapkan data uji untuk P2/P3

P1 tidak mengimplementasikan CRUD, tapi sebaiknya menyiapkan struktur agar P2/P3
bisa langsung bekerja. Buat dokumen manual di Console:

### 6a. Koleksi `classes`

**Firestore → Start collection** → Collection ID: `classes` → Document ID: `kelas-a`

```json
{
  "nama": "PPK A",
  "praktikumId": "praktikum-ppk",
  "praktikumNama": "Praktikum Pemrograman Komputer",
  "praktikumKode": "PPK",
  "archived": false,
  "createdAt": "<timestamp sekarang>",
  "updatedAt": "<timestamp sekarang>"
}
```

### 6b. Koleksi `classMembers`

Document ID **wajib** `{classId}_{uid}` — misal `kelas-a_AbCdEf123`.

> ID ini dipakai Rules untuk cek keanggotaan. Kalau P2 memakai format lain,
> presensi akan ditolak.

```json
{
  "classId": "kelas-a",
  "uid": "<UID praktikan>",
  "nama": "Budi Santoso",
  "nim": "2310511001",
  "active": true,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

**Cek berhasil:** login sebagai praktikan tersebut, halaman Jadwal tidak error.

---

## Langkah 7 — Build ulang development client (untuk HP)

Project ini memakai EAS. AsyncStorage adalah modul native, jadi **APK dev client
lama belum memuatnya**.

```bash
npx eas-cli@latest build --profile development --platform android
```

Setelah APK ter-install di HP:

```bash
npx expo start --dev-client
```

**Cek berhasil:** login di HP, lalu **tutup aplikasi sepenuhnya** dan buka lagi —
tetap dalam keadaan login. Itu bukti AsyncStorage bekerja (SRS-01).

---

## Ringkasan untuk laporan

Setelah semua langkah selesai, isi tabel ini dengan bukti yang benar-benar kamu jalankan:

| SRS | Bukti | Status |
| --- | --- | --- |
| SRS-01 registrasi | Akun muncul di Authentication + Firestore `users` | |
| SRS-01 login | Masuk ke halaman Jadwal | |
| SRS-01 logout | Kembali ke halaman login | |
| SRS-01 sesi bertahan | Refresh/restart tetap login | |
| SRS-01 role | Asisten lihat Rekap, praktikan lihat Kehadiran | |
| SRS-08 role tidak bisa dinaikkan | Rules Playground → Denied | |
| SRS-08 akses tanpa login | Rules Playground → Denied | |
| SRS-08 praktikan tidak bisa tulis data asisten | Rules Playground → Denied | |

---

## Kalau ada error

| Pesan / gejala | Penyebab | Solusi |
| --- | --- | --- |
| "Metode Email/Password belum diaktifkan" | Provider belum enabled | Langkah 1 |
| "Firebase belum dikonfigurasi" | `.env` belum ada | Langkah 0, lalu restart `npx expo start` |
| `permission-denied` saat registrasi | Rules belum dipublish | Langkah 3 |
| `permission-denied` saat baca data | Rules terlalu ketat / ID `classMembers` salah | Cek format `{classId}_{uid}` |
| Tab tidak berubah setelah ubah role | Cache sesi | Logout lalu login ulang |
| Sesi hilang saat app ditutup | Dev client lama (belum ada AsyncStorage) | Langkah 7 |
| `auth/unauthorized-domain` | Bukan localhost | Jalankan di `http://localhost:8081` |

---

## Catatan keamanan

- Konfigurasi `EXPO_PUBLIC_FIREBASE_*` **bukan rahasia** — aman di-commit.
- Yang benar-benar menjaga data adalah **Authentication + Security Rules**.
- Jangan pernah menaruh service account, admin key, atau API key AI di
  `EXPO_PUBLIC_*` / source code klien.
- Buat akun asisten lewat Console/Admin SDK, **bukan** lewat pilihan di form registrasi.
