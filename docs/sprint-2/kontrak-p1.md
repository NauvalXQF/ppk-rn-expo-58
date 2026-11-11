# Kontrak Firebase — Ringkasan untuk P2 & P3

Dokumen ini melengkapi [../FIREBASE-SETUP.md](../FIREBASE-SETUP.md) dan
[data-model.md](./data-model.md). Bagian yang **sudah diimplementasikan P1** ditandai ✅,
sisanya menunggu P2/P3.

## 1. Inisialisasi (sudah tersedia) ✅

```ts
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/config/firebase';

const auth = getFirebaseAuth();   // Auth
const db = getFirebaseDb();       // Firestore
```

**Jangan** memanggil `initializeApp`/`initializeAuth` sendiri. Satu instance dipakai bersama.

## 2. State autentikasi (sudah tersedia) ✅

```ts
import { useAuth } from '@/contexts/AuthContext';

const { status, pengguna, error, daftar, masuk, keluar } = useAuth();
```

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `status` | `'memuat' \| 'masuk' \| 'keluar'` | `memuat` saat sesi dipulihkan |
| `pengguna.uid` | `string` | Sama dengan `request.auth.uid` di Rules |
| `pengguna.role` | `'praktikan' \| 'asisten'` | Sumber kebenaran role |
| `pengguna.nama` / `email` | `string` | |
| `pengguna.nim` / `nip` / `kelasId` | `string?` | Opsional |

Guard route dan penyembunyian menu sudah ditangani P1 di `src/app/(tabs)/_layout.tsx`.
**Menyembunyikan menu bukan keamanan** — Rules tetap menolak akses tidak sah.

## 3. Field audit wajib ✅

Semua dokumen memakai:

| Field | Nilai |
| --- | --- |
| `createdAt` | `serverTimestamp()` |
| `updatedAt` | `serverTimestamp()` |

Dokumen `users/{uid}` sudah ditulis P1 dengan `uid`, `email`, `nama`, `role`, `createdAt`, `updatedAt`.

## 4. ID dokumen deterministik — **PERLU DISEPAKATI**

Rules memakai ID deterministik (tidak bisa query di dalam Rules). Konvensi yang dipakai P1:

| Koleksi | ID | Contoh |
| --- | --- | --- |
| `users` | `{uid}` | `abc123` |
| `classMembers` | `{classId}_{uid}` | `kelas-a_abc123` |
| `sessions/{id}/attendances` | `{uid}` | `abc123` |
| `leaveRequests` | bebas (`addDoc`) | auto-ID |

> **P2 wajib memakai ID `classMembers` = `{classId}_{uid}`** agar Rules keanggotaan bekerja.
> Kalau P2 ingin konvensi lain, kabari P1 **sebelum** implementasi agar Rules disesuaikan.
> Tanpa ini, praktikan akan ditolak saat presensi.

## 5. Status sesi ✅

Nilai persisten hanya `open` dan `closed`; tiga label UI Sprint 1 diturunkan dari audit:

| Firestore | Label UI |
| --- | --- |
| `closed`, `openedAt = null`, `closedAt = null` | Dijadwalkan |
| `open`, `openedAt` terisi | Dibuka |
| `closed`, `openedAt` & `closedAt` terisi | Ditutup |

Rules menolak transisi lain, dan menolak create sesi yang sudah `open`.

## 6. Matriks izin tulis (sudah diterapkan) ✅

| Koleksi | Baca | Create | Update |
| --- | --- | --- | --- |
| `users` | pemilik / asisten | pemilik, `role` wajib `praktikan` | pemilik, hanya `nama`/`nim`/`nip`/`updatedAt` |
| `classes` | asisten / anggota kelas | asisten | asisten |
| `classMembers` | asisten / pemilik | asisten | asisten |
| `schedules` | asisten / anggota kelas | asisten | asisten |
| `sessions` | asisten / anggota kelas | asisten | asisten (hanya transisi sesi) |
| `.../attendances/{uid}` | pemilik / asisten | praktikan, sesi `open`, anggota aktif | ❌ ditolak |
| `leaveRequests` | pemilik / asisten | praktikan, `status = pending` | asisten: `pending → approved/rejected` |

`delete` ditolak untuk semua koleksi (pakai `archived`/`active = false`) sesuai
kebijakan arsip di `data-model.md` §7.

## 7. Yang masih perlu diputuskan bersama

- [ ] Konvensi ID `classMembers` (usulan P1: `{classId}_{uid}`).
- [ ] `classId` praktikan di profil: sekarang P1 memakai fallback `'kelas-a'` sementara
      karena data kelas belum ada di Firestore. Setelah P2 menyediakan `classMembers`,
      `kelasId` sebaiknya diambil dari situ.
- [ ] Apakah pemohon izin boleh menulis field `ai` (hasil klasifikasi). Saat ini Rules
      **mengizinkan** pemohon meng-update `ai` saja selama status masih `pending` —
      cukup untuk alur P3: simpan `pending` → panggil AI → tulis `ai`. Field keputusan
      tetap tertutup untuk pemohon.
- [ ] Indeks Firestore yang dibutuhkan query P2/P3 (P1 yang membuat).
