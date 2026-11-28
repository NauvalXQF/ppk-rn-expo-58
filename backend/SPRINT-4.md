# Integrasi Lokal Pembayaran Sprint 4

## Menjalankan aplikasi

Dari root repository, jalankan backend di terminal pertama.

```powershell
cd backend
npm ci
npm run dev
```

Gunakan `backend/.env.example` sebagai daftar field konfigurasi. Isi sendiri project ID, path absolut service account di luar repository, dan Server Key dari dashboard **Sandbox**. Server Key digunakan untuk API. Untuk verifikasi SHA-512 webhook, gunakan Signature Secret Key jika tersedia. Jika kosong, backend memilih Server Key saat startup. Pertahankan `MIDTRANS_IS_PRODUCTION=false`, `PORT=3000`, dan `HOST=127.0.0.1` untuk loopback. Rute pembayaran mengembalikan 503 bila key belum tersedia. `PAYMENT_NOTIFICATION_WORKER=true` menjalankan worker dalam proses backend yang sama. Isi `EXPO_PUSH_ACCESS_TOKEN` hanya bila proyek Expo menggunakan akses push yang dilindungi. Worker memerlukan development build dan registrasi perangkat aktif. Gunakan hanya proyek/akun uji yang telah diizinkan. Health check tersedia di `http://127.0.0.1:3000/api/health`.

Pada environment frontend, isi `EXPO_PUBLIC_API_BASE_URL` dengan origin API tanpa path. Android Emulator dapat memakai `http://10.0.2.2:3000` pada development build. Android fisik memakai HTTPS yang disetujui tim. Untuk pengujian USB, jalankan `adb reverse tcp:3000 tcp:3000` dan pakai `http://127.0.0.1:3000` pada development build bila kebijakan jaringan Android mengizinkannya. Client tidak mengirim Firebase ID token melalui HTTP LAN. Buka terminal kedua di root.

```powershell
npx expo start --dev-client
```

## HTTP API lokal

| Endpoint | Pemanggil | Request dan hasil |
|---|---|---|
| POST /api/admin/provisioning/users | Bearer Aslab dalam scope course/lab | Body berisi courseId, labId, users[]. Setiap row berisi rowId, role, email, nama, dan nim atau nip. Hasil berisi results[] dengan rowId, outcome, uid bila kompatibel, dan code bila gagal. |
| POST /api/payments/create | Bearer Praktikan pemilik | Body { fineId }. Hasil { orderId, snapToken, redirectUrl }. Retry jaringan mengembalikan order yang sudah direservasi atau 409 selama rekonsiliasi. |
| POST /api/payments/status | Bearer Praktikan pemilik | Body { fineId }. Memeriksa status order pending lalu merespons 204. Hasil dilihat dari Firestore. Status lunas tetap memerlukan webhook terverifikasi. |
| POST /api/payments/webhook | Midtrans Sandbox | HTTP notification resmi. SHA-512 memakai key yang dipilih saat startup dan tetap memerlukan Get Status. HTTP 204 setelah webhook diproses atau dikenali sebagai event lama. |
| POST /api/payments/fine-created | Bearer Praktikan pemilik | Body { fineId }. Backend memvalidasi fine dan presensi, lalu menulis audit serta outbox secara idempoten. Respons 204. |

Provisioning menerima sampai 100 baris **dan** mengikuti batas body Express 16 KB. Bagi CSV berukuran besar sebelum dikirim. Gunakan rowId unik dan stabil. Hanya Praktikan/Asprak sebagai role target. Kode per baris mencakup INVALID_ROW, DUPLICATE_ROW, ACCOUNT_PROFILE_CONFLICT, PROFILE_REVIEW_REQUIRED, ACCOUNT_CREATION_DISABLED, dan PROVISIONING_RETRY. Lookup menggunakan email yang dinormalisasi dan mencocokkan UID, role serta NIM/NIP. Adapter pembuatan mereservasi UID acak sebelum menulis Auth dan dapat melanjutkan profil parsial. Set PROVISIONING_ALLOW_CREATE=true pada backend lokal untuk mengaktifkan pembuatan akun. Default false hanya mengizinkan lookup akun aktif yang kompatibel. Akun baru dibuat nonaktif dengan password acak yang hanya diberikan ke Firebase Auth. Setelah profil berhasil dibuat, backend mengaktifkan akun dan menyelesaikan penanda provisioning. Retry dengan data yang sama melanjutkan reservasi yang sah. Jika akun existing nonaktif dan tidak memiliki provisioning tertunda yang cocok, backend melaporkan konflik. P1 perlu menghubungkan Firebase password reset agar pengguna dapat memilih password sendiri. Respons tidak memuat password. Backend tidak menulis classMembers, labAssignments, atau asprakUids.

## Pengujian Sandbox manual

1. Setelah izin menggunakan data uji diperoleh, jalankan backend dan development build. Pilih akun Praktikan uji yang memiliki fine P2 yang valid. Aktifkan worker di lingkungan uji bila menguji push.
2. Jalankan sendiri HTTPS tunnel ke backend port 3000. Di Midtrans **Sandbox Dashboard**, atur Payment Notification URL ke `https://<host-tunnel>/api/payments/webhook`. Lakukan dari pengaturan sandbox dan gunakan kredensial sandbox. Tunnel harus meneruskan POST tanpa halaman browser interstitial atau redirect.
3. Buka Denda → Bayar Denda. Periksa order pending, lalu tutup WebView dan buka ulang melalui Lanjutkan Pembayaran. Pastikan order yang sama dipakai dan tutup/redirect WebView tidak mengubah fine menjadi paid.
4. Gunakan Midtrans Sandbox Payment Simulator untuk kanal yang didukung. Setelah webhook settlement, cek status Lunas dan histori. Pada percobaan lain, batalkan atau tunggu expiry. Retry baru diperbolehkan setelah provider memastikan status terminal dan halaman Snap lama sudah tertutup.
5. Uji push untuk denda baru, settlement, dan gagal. Cocokkan in-app audit dengan notifikasi OS serta uji tap setelah koordinasi patch PM. Tutup paksa aplikasi dan buka Riwayat lagi untuk memeriksa data persisten.
6. Jika backend mati, jalankan lagi dengan konfigurasi yang sama. Order, lease, tiket, dan outbox tetap di Firestore. Jika URL tunnel berubah, perbarui Payment Notification URL di Sandbox Dashboard sebelum percobaan baru. Untuk settlement yang kehilangan webhook, lakukan investigasi dan replay melalui jalur Midtrans yang disetujui. Jangan mengedit status fine/payment secara manual.

## Provisioning dan aktivasi

- Aslab memilih mata kuliah dan laboratorium di bulk insert. Endpoint memvalidasi scope sebelum mencari akun. Course, lab, dan kelas harus aktif, dan kelas laboratorium memakai ID serta relasi yang cocok. Respons mempertahankan `rowId`, `outcome`, serta `uid` atau `code` sesuai hasil.
- Backend membuat akun baru dalam keadaan nonaktif dengan password acak. Backend mengaktifkannya setelah profil tersimpan. Provisioning menyimpan reservasi agar retry pembuatan parsial dapat melanjutkan dengan UID yang sama.
- Klien bulk insert Aslab meminta Firebase mengirim email reset saat mendapat hasil `created`, termasuk saat retry menyelesaikan pembuatan parsial. Hasil `existing` memakai UID yang sama tanpa mengirim email otomatis atau mengubah status maupun password akun. API tidak mengirim password awal atau tautan reset.
- Jika pengiriman gagal, bulk insert menampilkan nomor baris dan tetap memakai UID hasil provisioning untuk distribusi. Pengguna dapat memasukkan alamat akunnya dan memilih **Lupa password?** di halaman masuk. Alur yang sama dapat dipakai ketika email kedaluwarsa, respons `created` terputus, atau akun sudah ada. Verifikasi template pengiriman dan pengaturan Firebase Auth pada proyek uji sebelum mengaktifkan `PROVISIONING_ALLOW_CREATE`.
- Akun lama dengan NIM/NIP kosong memerlukan verifikasi manual dengan sumber akademik tepercaya. Setelah PM memverifikasi identitas, hubungan akademik, dan otorisasi, pengelola Firebase yang berwenang dapat melengkapi profil dan Aslab menjalankan ulang baris yang bersangkutan. NIM/NIP diperlakukan sebagai string dan nol awal dipertahankan.

## Persiapan Rules dan data lama

- Periksa `users.managedCourseIds` terhadap dokumen `courses`. Backfill `laboratories.courseId`, `classes.praktikumId`, dan `labAssignments.courseId` setelah mencocokkan sumber akademik dan relasi kelas, lab, serta penugasan. Dokumen tanpa scope yang dapat dibuktikan melalui field wajib perlu ditangani oleh pengelola data sebelum dapat diedit dari klien.
- Cocokkan jadwal lama dengan kelas dan mata kuliah. Normalisasi `jamMulai` dan `jamSelesai` ke `HH:mm` serta lengkapi field jadwal wajib sebelum mengedit atau mengarsipkan dokumen lama. Periksa referensi kelas/jadwal pada sesi dan pertahankan jejak waktu historis. Jalankan migrasi melalui proses tim yang disetujui setelah cadangan dan verifikasi.
- Uji Rules di loopback dengan proyek `demo-ppk-rules` dan set `PPK_RULES_EMULATOR_PORT` ke port emulator. Roadmap deploy Rules tetap melalui review tim.

## Keputusan integrasi yang masih memerlukan koordinasi

- **P2/PM — Rules dan bukti.** Pertahankan client denial pada payments writes dan fine paid. Kunci relasi attendance/session serta kebijakan nominal pada Rules. Batasi Aslab berdasarkan course. Koleksi paymentCheckouts, paymentReconciliation, provisioningReservations, dan notificationOutbox harus tetap server-only. Verifikasi dengan Rules Emulator dan lakukan deployment hanya melalui proses tim. Backend menghitung keterlambatan dari Firestore createTime, jadwal WIB, dan openedAt. Ref yang tidak konsisten ditolak.
- **P2/PM — fine_created saat offline.** Hook existing menyimpan referensi fine di antrian lokal per UID sebelum mengirim ke backend. Aplikasi mencoba lagi saat login/aktif. Kegagalan aplikasi di antara commit presensi dan penulisan antrian lokal tetap memerlukan pencatatan atomik bersama denda atau mekanisme pemulihan lain.
- **P2/PM — kebijakan historis.** Resume memakai order yang sudah diperiksa oleh backend. Untuk fine yang belum pernah direservasi, sesi yang berubah setelah fine terbit dapat membuat checkout ditolak. Sepakati snapshot kebijakan yang tepercaya dan tidak dapat diubah klien.
- **P1/PM — dashboard.** Untuk pemasukan gunakan payments settledAt dan status success. Sepakati arti filter periode tagihan dan zona waktu. Checkout token dan URL berada di paymentCheckouts server-only. Dashboard dan histori pembayaran tidak membutuhkannya.
- **PM — lingkungan lokal.** Untuk Expo Web, atur `CORS_ALLOWED_ORIGINS` dengan daftar origin persis yang dipisahkan koma, misalnya `http://localhost:8081`. Android native dan webhook tidak perlu origin.

Backend menahan order lama yang masih bisa dibayar dan menggunakan ulang ID yang sudah direservasi jika status 404 belum membuktikan adanya transaksi. Refund, reversal, settlement atas fine waived, serta settlement order lama setelah retry dicatat untuk rekonsiliasi. Worker mengklaim job menggunakan transaksi, memakai ID audit yang sama dalam data push, menyimpan ticket dan membaca receipt. Kegagalan push tidak membatalkan settlement. Pengiriman ambigu tidak diputar ulang otomatis. Status delivered berarti receipt diterima oleh penyedia push, tanpa jaminan perangkat menampilkan notifikasi atau delivery exactly-once.

Status deny atau failure dapat berasal dari satu percobaan dalam order Snap yang masih aktif. Backend menyimpan hasil gagal dan menahan order baru sampai status expire/cancel dan penutupan halaman terkonfirmasi. Jika bukti terminal belum tersedia, tinjau order di Sandbox Dashboard. Data aktual metode pembayaran dan bentuk callback perlu diuji pada kanal yang dipilih tim.

## FCM Android

- Simpan konfigurasi aplikasi Firebase Android yang diberikan PM di root sebagai google-services.json. Cocokkan package com.nauvalxqf.ppkrnexpo58 dengan aplikasi Android pada proyek Firebase kelompok. app.config.js menambahkan expo.android.googleServicesFile saat file tersedia dan mempertahankan konfigurasi app.json, termasuk owner dan projectId.
- `.easignore` mengecualikan `backend/`, file environment lokal, dan pola kredensial. Pengecualian spesifik mengikutsertakan `google-services.json` dari checkout lokal. Simpan service account dan private key di luar repository dan arsip build. Kelola credential FCM V1 pada proyek EAS tim melalui akun yang berwenang. [Panduan .easignore](https://docs.expo.dev/build-reference/easignore/#adding-files-to-your-project-upload-with-easignore)
- Pada environment EAS untuk profil build yang dipakai, isi enam variabel `EXPO_PUBLIC_FIREBASE_*` sesuai `.env.example` dan `EXPO_PUBLIC_API_BASE_URL` dengan origin HTTPS yang dijangkau perangkat. Untuk profil saat ini, periksa environment `development`, `preview`, dan `production` sesuai jenis build. Variabel `EXPO_PUBLIC_*` masuk ke bundle klien. [Variabel environment EAS](https://docs.expo.dev/eas/environment-variables/usage/)
- Setelah FCM tersedia, buat dan pasang development build Android baru. Aktifkan PAYMENT_NOTIFICATION_WORKER=true untuk ketiga event pembayaran. Worker mengirim push dan aplikasi menampilkan audit serta menangani tap. Uji ketiganya dalam keadaan foreground, background, dan cold start pada perangkat fisik.
