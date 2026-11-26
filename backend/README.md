# Backend Lokal PPK

Untuk kontrak provisioning, pembayaran, webhook, worker, dan langkah uji Sandbox, baca [Integrasi Lokal Pembayaran Sprint 4](./SPRINT-4.md).

Backend Express untuk Sprint 4. Fase ini menyediakan health check, konfigurasi lokal, dan fondasi verifikasi Firebase ID token untuk rute yang akan ditambahkan setelah review.

## Persiapan

Gunakan Node.js 22, minimal 22.17.0, dan npm. Jalankan perintah dari root repository.

```powershell
Set-Location backend
npm ci
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

- Isi `FIREBASE_PROJECT_ID` di `backend/.env` agar cocok dengan proyek Firebase tim. Untuk service account, tempatkan JSON di luar repository dan isi `GOOGLE_APPLICATION_CREDENTIALS` dengan path absolut. Pada Windows dapat digunakan path dengan garis miring seperti `C:/Users/nama/private/firebase-admin.json`. Gunakan tanda kutip bila path berisi spasi.
- Jika Application Default Credentials sudah tersedia untuk user lokal, `GOOGLE_APPLICATION_CREDENTIALS` dapat dikosongkan. Firebase Admin mengikuti urutan pencarian ADC.
- Pertahankan `MIDTRANS_IS_PRODUCTION=false`. Field `MIDTRANS_SERVER_KEY` dan `MIDTRANS_SIGNATURE_SECRET_KEY` boleh kosong selama fase fondasi.
- Simpan kredensial di luar source, bundle Expo, dan log. Node memuat `.env` di skrip `dev`/`start`. Variabel yang sudah disetel di environment shell mempunyai prioritas.

## Menjalankan server

```powershell
npm run dev
```

Untuk menjalankan hasil kompilasi, gunakan `npm run build`, lalu `npm start`. Hentikan server dengan Ctrl+C. Jalankan ulang proses setelah mengubah konfigurasi environment.

Default bind adalah `127.0.0.1:3000`. Android Emulator memakai `http://10.0.2.2:3000` untuk menjangkau host. Untuk Android fisik pada jaringan pengembangan yang sama, atur `HOST` ke IP LAN laptop dan gunakan IP itu dari perangkat. `HOST=0.0.0.0` juga bisa dipakai jika akses jaringan lokal memang diperlukan. Kembalikan bind ke loopback sesudah pengujian LAN. CORS dapat ditambahkan dengan allowlist jika Expo Web mulai memanggil backend.

## Health check

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health'
```

Respons HTTP 200 mempunyai body `{ "status": "ok" }`. Endpoint ini mengukur liveness HTTP tanpa memeriksa akses Firebase.

## Verifikasi

```powershell
npm run typecheck
npm run lint
npm test
```

Test menjalankan app pada port loopback sementara dan memakai adapter identitas palsu. Jika sandbox Windows menghalangi isolasi proses dengan `spawn EPERM`, jalankan runner yang sama tanpa isolasi proses.

```powershell
node --experimental-strip-types --experimental-test-isolation=none --test 'tests/*.test.mjs'
```

API error memakai `{ error: { code, message, requestId } }`. Middleware autentikasi untuk rute terproteksi mengambil UID dari Firebase ID token yang diverifikasi, lalu membaca role dari `users/{uid}`. Profil legacy `asisten` dipetakan ke `asprak`. Rute yang memakai middleware tetap bertanggung jawab memeriksa scope resource.

Sebelum build EAS berikutnya, koordinasikan penambahan `.easignore` di root dengan PM. Salin aturan root `.gitignore` sebagai dasar, lalu tambahkan `/backend/` agar backend tidak ikut arsip upload EAS. Tetap simpan file service account di luar repository.
