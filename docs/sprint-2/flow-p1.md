# Flow Kode P1 — Firebase Authentication & Security

Gambaran umum saja, bukan detail implementasi.

## Diagram

```
                        ┌─────────────────────┐
                        │  Aplikasi dibuka    │
                        └──────────┬──────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │  AuthContext cek sesi login   │
                   │  (AsyncStorage / IndexedDB)   │
                   └───────────────┬───────────────┘
                                   ▼
                          ┌────────────────┐
                          │ Sesi ada?      │
                          └───┬────────┬───┘
                        tidak │        │ ada
                              ▼        ▼
              ┌───────────────────┐    │
              │ Halaman Login /   │    │
              │ Registrasi        │    │
              └─────────┬─────────┘    │
                        ▼              │
              ┌───────────────────┐    │
              │ Pilih mode        │    │
              └──┬─────────────┬──┘    │
          Masuk  │             │ Daftar│
                 ▼             ▼       │
        ┌──────────────┐ ┌────────────┐│
        │ Firebase Auth│ │Firebase Auth││
        │ signIn       │ │createUser  ││
        └──────┬───────┘ └──────┬─────┘│
               │                ▼      │
               │      ┌─────────────────────┐
               │      │ Simpan users/{uid}  │
               │      │ role = praktikan    │
               │      └──────────┬──────────┘
               │                 │      │
               └────────┬────────┘      │
                        ▼               │
            ┌───────────────────────┐   │
            │ Baca profil users/    │◄──┘
            │ {uid} → dapat role    │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ Tampilan sesuai role  │
            └────┬─────────────┬────┘
         praktikan│             │asisten
                 ▼             ▼
        ┌────────────────┐ ┌────────────────┐
        │ Jadwal         │ │ Jadwal         │
        │ Kehadiran      │ │ Rekap          │
        │ Profil         │ │ Profil         │
        └────────┬───────┘ └───────┬────────┘
                 └────────┬────────┘
                          ▼
            ┌───────────────────────────┐
            │ Setiap akses data ke      │
            │ Firestore                 │
            └─────────────┬─────────────┘
                          ▼
            ┌───────────────────────────┐
            │ Security Rules memeriksa: │
            │ • sudah login?            │
            │ • role sesuai?            │
            │ • pemilik data?           │
            └───────┬───────────┬───────┘
              lolos │           │ ditolak
                    ▼           ▼
            ┌──────────────┐ ┌──────────────────────┐
            │ Data tampil  │ │ Error                │
            └──────────────┘ │ permission-denied    │
                             └──────────────────────┘
```

## Penjelasan singkat

| Tahap | Yang terjadi |
| --- | --- |
| Cek sesi | Firebase memulihkan sesi dari storage; pengguna tidak perlu login ulang |
| Login | Email + password diverifikasi Firebase Authentication |
| Registrasi | Akun dibuat, lalu profil ditulis ke `users/{uid}` dengan role `praktikan` |
| Role | Dibaca dari Firestore, bukan dari input pengguna |
| Tampilan | Menu dibedakan per role |
| Keamanan | Firestore Security Rules menolak akses tidak sah di level database |

## Poin penting

1. **Registrasi selalu jadi praktikan.** Akun asisten dibuat lewat Firebase Console,
   bukan pilihan di form.
2. **Role tidak bisa dinaikkan sendiri.** Rules menolak perubahan field `role`.
3. **Keamanan bukan di UI.** Menyembunyikan menu hanya kosmetik; penolakan sebenarnya
   terjadi di Security Rules.
4. **Sesi bertahan.** Token disimpan AsyncStorage (Android/iOS) atau IndexedDB (web).
5. **Logout** menghapus sesi di Firebase dan mengembalikan ke halaman login.
