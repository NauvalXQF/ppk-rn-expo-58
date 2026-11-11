# Firebase Setup — Sprint 2 (P1)

Dokumen ini untuk PM dan Programmer 2/3. Ikuti sekali, lalu semua modul memakai
konfigurasi yang sama.

## 1. Ambil konfigurasi

```bash
cd ppk-rn-expo-58
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

Nilai di `.env.example` sudah berisi konfigurasi Firebase project tim:
`data-mahasiswa-d011f`. Kalau tim memakai project lain, ganti nilainya dari
**Firebase Console → Project settings → Your apps → Web app**.

> `.env` tidak di-commit (ada di `.gitignore`). `.env.example` di-commit karena
> konfigurasi klien Firebase bukan rahasia.

## 2. Aktifkan metode login

**Firebase Console → Build → Authentication → Sign-in method → Email/Password → Enable → Save.**

Tanpa ini, registrasi/login akan gagal dengan `auth/operation-not-allowed`.

## 3. Buat Firestore

**Build → Firestore Database → Create database** (production mode, lokasi
`asia-southeast2`). Jika sudah ada, lanjut.

## 4. Pasang Security Rules

**Firestore Database → Rules** → tempel isi `firestore.rules` → **Publish**.

Rules ini mencakup seluruh koleksi Sprint 2:

| Koleksi | Baca | Tulis |
| --- | --- | --- |
| `users/{uid}` | pemilik atau asisten | pemilik (role tidak boleh diubah) |
| `classes`, `classMembers`, `schedules`, `sessions` | semua user login | asisten |
| `sessions/{id}/attendances/{uid}` | pemilik atau asisten | praktikan, sekali, sesi `open` |
| `leaveRequests/{id}` | pemilik atau asisten | buat: praktikan; keputusan: asisten |

## 5. Membuat akun asisten (provisioning)

Registrasi mandiri **selalu** menghasilkan role `praktikan`. Untuk membuat akun
asisten:

1. Praktikan/asisten mendaftar dulu lewat aplikasi (tab **Daftar**).
2. Buka **Firestore Database → users → pilih dokumen dengan email tersebut**.
3. Ubah field `role` dari `praktikan` menjadi `asisten`.
4. Minta pengguna login ulang (atau tunggu — listener profil akan memperbarui otomatis).

Role tidak bisa dinaikkan dari aplikasi karena rules menolak perubahan `role`.

## 6. Rebuild development build

Project ini memakai EAS development build. `@react-native-async-storage/async-storage`
adalah modul native, jadi **APK dev client lama belum memuatnya** dan sesi login
tidak akan tersimpan.

```bash
npx eas-cli@latest build --profile development --platform android
```

Install APK baru, lalu:

```bash
npx expo start --dev-client
```

### Alternatif cepat untuk pengembangan

Web tidak butuh build native:

```bash
npx expo start --web
```

Di web, Firebase memakai IndexedDB (bukan AsyncStorage). Sesi tetap bertahan
setelah refresh, tapi untuk membuktikan AsyncStorage sesuai SRS, uji di
development build Android.

## 7. Kontrak untuk Programmer 2 dan 3

```ts
import { useAuth } from '@/contexts/AuthContext';

const { status, pengguna } = useAuth();
// status  : 'memuat' | 'masuk' | 'keluar'
// pengguna: { uid, email, nama, role: 'praktikan' | 'asisten', nim?, nip?, kelasId? }

import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
```

- Jangan menginisialisasi Firebase sendiri; selalu impor dari `@/config/firebase`.
- Gunakan `pengguna.uid` sebagai identitas (sesuai `request.auth.uid` di rules).
- Status sesi: `open` / `closed`.
- Presensi: dokumen `sessions/{sessionId}/attendances/{uid}`.
- Izin: `leaveRequests/{id}` dengan `status` `pending` / `approved` / `rejected`.
- Jangan mengubah file milik P1 (`src/config`, `src/contexts`, `src/services/authService.ts`,
  `firestore.rules`).

## 8. Struktur file P1

```
src/config/firebase.ts             # inisialisasi app/auth/firestore
src/contexts/AuthContext.tsx       # state autentikasi + role
src/services/authService.ts        # registrasi, login, logout, profil, error mapping
src/app/index.tsx                  # halaman login/registrasi
src/app/_layout.tsx                # provider + sinkronisasi profil ke state aplikasi
src/app/(tabs)/_layout.tsx         # guard route + menu berdasarkan role
firestore.rules                    # security rules
.env.example                       # konfigurasi Firebase (di-commit)
```
