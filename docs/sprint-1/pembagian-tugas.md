# Pembagian Tugas dan Alur Kerja

Dokumen ini membagi pekerjaan Sprint 1 ke 3 programmer dengan dependency yang jelas. PM memakai dokumen ini untuk membuat task board dan memantau progres.

---

## 1. Tim

| Kode | Peran | Fokus |
| --- | --- | --- |
| D1 | Programmer Core | Kontrak data, state, navigasi, shared UI |
| D2 | Programmer Praktikan | Jadwal, presensi, riwayat praktikan |
| D3 | Programmer Asisten | Kontrol sesi, rekap kehadiran |
| PM | Project Manager | Scope, dokumen, task board, acceptance, demo |

---

## 2. Aturan Contract-First

1. D1 menyelesaikan `src/types/models.ts`, `src/store/app-context.tsx`, dan `src/store/selectors.ts` lebih dulu.
2. D2 dan D3 membaca kontrak di `data-model.md` dan boleh mulai membuat komponen presentational dengan data statis sambil menunggu kontrak selesai.
3. Setelah kontrak di-merge, D2 dan D3 baru menghubungkan komponen ke `useApp()`.
4. Perubahan kontrak (tipe, aksi, selector) harus:
   - dibuat di branch terpisah,
   - direview D1,
   - diumumkan ke grup sebelum di-merge.
5. D2 dan D3 tidak boleh menambah field ke `AppState` atau mengubah bentuk data sendiri.

---

## 3. Peta Kepemilikan File

| Area | File | Pemilik | Boleh diubah oleh |
| --- | --- | --- | --- |
| Kontrak | `src/types/models.ts` | D1 | D1 (koordinasi) |
| Data | `src/data/dummy.ts` | D1 | D1 |
| State | `src/store/app-context.tsx` | D1 | D1 |
| Selector | `src/store/selectors.ts` | D1 | D1 |
| Util tanggal | `src/utils/date.ts` | D1 | D1 |
| Token UI | `src/constants/theme.ts` | D1 | D1 |
| Shared UI | `src/components/ui/**` | D1 | D1 (request lewat PR) |
| Root layout | `src/app/_layout.tsx` | D1 | D1 |
| Form peran | `src/app/index.tsx` | D1 | D1 |
| Tabs layout | `src/app/(tabs)/_layout.tsx` | D1 | D1 |
| Profil | `src/app/(tabs)/profil.tsx` | D1 | D1 |
| Orkestrator detail | `src/app/sesi/[sesiId].tsx`, `src/features/sesi/SessionDetailScreen.tsx` | D1 | D1 |
| Kartu sesi | `src/components/domain/SessionCard.tsx` | D2 | D2; D3 hanya memakai |
| Jadwal | `src/features/jadwal/**`, `src/app/(tabs)/jadwal.tsx` | D2 | D2 |
| Presensi | `src/features/sesi/praktikan/**` | D2 | D2 |
| Kehadiran | `src/features/kehadiran/**`, `src/app/(tabs)/kehadiran.tsx` | D2 | D2 |
| Baris rekap | `src/components/domain/AttendanceRow.tsx` | D3 | D3 |
| Kontrol sesi | `src/features/sesi/asisten/**` | D3 | D3 |
| Rekap | `src/features/rekap/**`, `src/app/(tabs)/rekap.tsx` | D3 | D3 |
| Dokumentasi | `docs/sprint-1/**` | PM | PM |

Aturan: jika butuh perubahan di file milik orang lain, buat issue/chat dengan file + alasan + usulan diff. Jangan edit langsung.

---

## 4. Urutan Milestone dan Merge

```text
M0: D1 — contract & skeleton
        │
        ├──▶ M1: D1 (navigasi & profil) ─ paralel
        ├──▶ M1: D2 (alur praktikan)     ─ paralel
        └──▶ M1: D3 (alur asisten)       ─ paralel
                    │
                    ▼
M2: integrasi D1 + D2 + D3
                    │
                    ▼
M3: QA, bug fix, latihan demo
```

Urutan merge yang disarankan:

1. `feat/core-foundation` (D1) — wajib pertama.
2. `feat/session-card` (D2) — PR kecil agar D3 bisa memakai kartu sesi.
3. `feat/praktikan-flow` (D2).
4. `feat/asisten-flow` (D3).
5. `feat/integration` (D1) — orkestrator detail sesi.
6. PR bug fix masing-masing.

---

## 5. Detail Tugas D1 — Core

### M0 — Contract & Skeleton

- [ ] Buat `src/types/models.ts` sesuai `data-model.md`.
- [ ] Buat `src/data/dummy.ts` dengan 5 pengguna (1 asisten, 4 praktikan), 3 kelas, 5 sesi, 3 presensi awal.
- [ ] Buat `src/store/app-context.tsx`: `AppProvider`, `appReducer`, `useApp()`.
- [ ] Buat `src/store/selectors.ts` sesuai daftar selector.
- [ ] Buat `src/utils/date.ts`.
- [ ] Buat `src/constants/theme.ts` sesuai token.
- [ ] Buat shared UI:
  - [ ] `ScreenContainer`
  - [ ] `AppCard`
  - [ ] `AppButton`
  - [ ] `StatusBadge`
  - [ ] `EmptyState`
  - [ ] `SectionHeader`
  - [ ] `InfoBanner`
  - [ ] `ConfirmSheet`
  - [ ] `FormField`
  - [ ] `RadioOption`
- [ ] Buat `src/app/_layout.tsx` dengan `AppProvider` + `Stack`.
- [ ] Buat form peran & identitas di `src/app/index.tsx`.
- [ ] Buat `src/app/(tabs)/_layout.tsx` dengan tab berbeda per peran.
- [ ] Buat placeholder `jadwal.tsx`, `kehadiran.tsx`, `rekap.tsx`, `profil.tsx` agar navigasi bisa diuji.
- [ ] Buat route tipis `src/app/sesi/[sesiId].tsx`.

**Exit criteria M0:** aplikasi bisa dibuka, memilih peran/identitas, berpindah tab, dan `npx tsc --noEmit` + `npx eslint .` bersih.

### M1 — Navigasi & Profil

- [ ] Selesaikan layar Profil: identitas, Ganti Pengguna, Reset Data Demo.
- [ ] Tambahkan guard role pada tab Kehadiran/Rekap.
- [ ] Rapikan `ConfirmSheet` setelah dipakai D2/D3.
- [ ] Pastikan `AppButton` punya state disabled yang jelas.
- [ ] Review PR D2/D3 yang menyentuh kontrak.

### M2 — Integrasi Detail Sesi

- [ ] `SessionDetailScreen` membaca `selectDetailSesi`.
- [ ] Tampilkan state “Sesi tidak ditemukan”.
- [ ] Render `PraktikanSessionView` untuk praktikan dan `AsistenSessionView` untuk asisten.
- [ ] Pastikan tidak ada logika bisnis di file route.

### M3 — QA

- [ ] Perbaiki bug shared UI/state.
- [ ] Bantu D2/D3 jika ada blocker kontrak.
- [ ] Pastikan `tsc` dan ESLint bersih di branch akhir.

---

## 6. Detail Tugas D2 — Praktikan

### Persiapan (sebelum kontrak selesai)

- [ ] Baca `data-model.md` dan `navigasi-ui.md`.
- [ ] Buat kerangka komponen dengan props statis (tanpa `useApp`).
- [ ] Siapkan `SessionCard` sesuai kontrak di `navigasi-ui.md`.

### M1 — Fitur

- [ ] `SessionCard` di `src/components/domain/SessionCard.tsx`.
- [ ] `JadwalScreen`:
  - [ ] daftar sesi dari `selectSesiUntukPengguna`,
  - [ ] meta berbeda untuk praktikan,
  - [ ] tap kartu → detail,
  - [ ] empty state.
- [ ] Route `src/app/(tabs)/jadwal.tsx` (tipis).
- [ ] `PraktikanSessionView`:
  - [ ] state `dijadwalkan` → banner belum dibuka,
  - [ ] state `dibuka` belum presensi → form + checkbox + tombol,
  - [ ] `ConfirmSheet` sebelum dispatch,
  - [ ] state sudah presensi → kartu sukses + waktu,
  - [ ] state `ditutup` dengan/tanpa presensi.
- [ ] `PresensiForm`:
  - [ ] input catatan maks. 120 karakter,
  - [ ] checkbox wajib,
  - [ ] tombol disabled sampai checkbox dicentang.
- [ ] `PresensiSuccess`.
- [ ] `KehadiranScreen`:
  - [ ] daftar riwayat dari `selectRiwayatPraktikan`,
  - [ ] label status yang benar,
  - [ ] tap → detail,
  - [ ] empty state.
- [ ] Route `src/app/(tabs)/kehadiran.tsx`.

### M2 — Integrasi

- [ ] Sambungkan komponen ke `useApp()` dan selector.
- [ ] Pastikan `SessionCard` dipakai juga oleh D3.
- [ ] Cek meta di jadwal berubah setelah presensi.
- [ ] Cek riwayat berubah setelah presensi.

### M3 — QA

- [ ] Uji semua state praktikan.
- [ ] Perbaiki bug UI.
- [ ] Pastikan tidak ada `any` baru tanpa alasan.

---

## 7. Detail Tugas D3 — Asisten

### Persiapan (sebelum kontrak selesai)

- [ ] Baca `data-model.md` dan `navigasi-ui.md`.
- [ ] Buat kerangka `AsistenSessionView` dengan props statis.
- [ ] Siapkan `AttendanceRow`.

### M1 — Fitur

- [ ] `AttendanceRow` di `src/components/domain/AttendanceRow.tsx`.
- [ ] `AsistenSessionView`:
  - [ ] state `dijadwalkan` → tombol Buka Sesi,
  - [ ] `ConfirmSheet` buka sesi,
  - [ ] state `dibuka` → tombol Tutup Sesi + rekap live,
  - [ ] `ConfirmSheet` tutup sesi dengan tone danger,
  - [ ] state `ditutup` → tanpa tombol, rekap arsip.
- [ ] `SessionControlCard`.
- [ ] `RekapScreen`:
  - [ ] daftar semua sesi + jumlah hadir,
  - [ ] tap → detail,
  - [ ] empty state.
- [ ] Route `src/app/(tabs)/rekap.tsx`.
- [ ] `RekapSummary` / daftar hadir per sesi:
  - [ ] nama, NIM, waktu, badge Hadir,
  - [ ] hitungan `X/Y hadir`,
  - [ ] urut waktu naik,
  - [ ] empty state.

### M2 — Integrasi

- [ ] Sambungkan ke `useApp()` dan selector.
- [ ] Pastikan status di jadwal ikut berubah setelah buka/tutup.
- [ ] Pastikan rekap bertambah setelah praktikan presensi.
- [ ] Pastikan rekap tetap ada setelah sesi ditutup.

### M3 — QA

- [ ] Uji transisi status.
- [ ] Uji rekap kosong dan rekap terisi.
- [ ] Perbaiki bug UI.

---

## 8. Tugas Integrasi Bersama (M2)

Dikerjakan bersama, dipimpin D1:

- [ ] `SessionDetailScreen` merender view yang tepat berdasarkan `currentUser.peran`.
- [ ] Badge status konsisten di Jadwal, Detail, dan Rekap.
- [ ] Jumlah hadir konsisten di Detail dan Rekap.
- [ ] Riwayat praktikan konsisten dengan record presensi.
- [ ] Presensi ganda tidak mungkin terjadi lewat UI maupun reducer.
- [ ] Sesi yang ditutup tidak menampilkan form presensi.
- [ ] Ganti pengguna tidak mereset data.
- [ ] Reset Data Demo mengembalikan kondisi awal.
- [ ] Tidak ada layar yang crash saat sesi tidak ditemukan.

---

## 9. Tugas PM

- [ ] Menjaga dokumen `docs/sprint-1/**` tetap sinkron dengan implementasi.
- [ ] Memecah checklist di dokumen ini menjadi issue/task board.
- [ ] Menentukan prioritas saat ada konflik scope.
- [ ] Memastikan setiap PR punya deskripsi, screenshot, dan AC terkait.
- [ ] Menjalankan `acceptance-criteria.md` di akhir M2.
- [ ] Memimpin latihan demo.
- [ ] Menolak fitur di luar scope sprint.
- [ ] Menjadi penghubung ke asisten praktikum.

---

## 10. Git Workflow

### Branch

| Branch | Pemilik | Isi |
| --- | --- | --- |
| `main` | — | Selalu stabil |
| `feat/core-foundation` | D1 | Types, state, navigasi, shared UI |
| `feat/praktikan-flow` | D2 | Jadwal, presensi, kehadiran |
| `feat/asisten-flow` | D3 | Kontrol sesi, rekap |
| `feat/session-card` | D2 | PR kecil `SessionCard` |
| `feat/integration` | D1 | Orkestrator detail sesi |
| `docs/sprint-1` | PM | Dokumen sprint |

### Commit

Format:

```text
feat: tambah form presensi praktikan
fix: cegah presensi ganda pada sesi yang sama
refactor: pisahkan SessionCard dari layar jadwal
docs: perbarui acceptance criteria sprint 1
chore: rapikan token tema
```

Aturan:

- Satu commit = satu perubahan logis.
- Jangan commit `node_modules`, `.expo`, atau file build.
- Jangan commit kredensial/keystore.

### Sebelum membuat PR

```bash
git fetch origin
git rebase origin/main
npx tsc --noEmit
npx eslint .
```

Perbaiki semua error sebelum push.

### PR Checklist

Sertakan di deskripsi PR:

```md
## Ringkasan
...

## File utama yang diubah
...

## Cara test
1. ...

## Screenshot / rekaman
...

## AC terkait
- AC-...

## Checklist
- [ ] `npx tsc --noEmit` bersih
- [ ] `npx eslint .` bersih
- [ ] Tidak mengubah file milik dev lain
- [ ] Sudah dicoba di lebar 320 px
- [ ] Tidak ada `console.error`
```

Reviewer minimal satu programmer lain. PM memverifikasi AC, bukan detail kode.

### Merge

- Gunakan **squash merge** agar history `main` rapi.
- Hapus branch setelah merge.
- Jangan force-push ke `main`.
- Jangan merge PR yang masih merah di `tsc`/ESLint.

---

## 11. Komunikasi

- Update status singkat: **selesai / sedang dikerjakan / blocker**.
- Blocker harus disertai: file, langkah reproduksi, pesan error.
- Perubahan kontrak diumumkan sebelum PR, bukan setelah merge.
- Jika dua orang butuh file yang sama, PM menentukan pemilik sementara.
- Jangan menunda integrasi sampai akhir; merge `SessionCard` dan shared UI lebih awal.

---

## 12. Definition of Done per Task

Sebuah task dianggap selesai jika:

- [ ] Perilaku sesuai spesifikasi layar.
- [ ] Semua state (normal, empty, disabled, sukses) ditangani.
- [ ] Tidak ada mutasi state langsung.
- [ ] `npx tsc --noEmit` bersih.
- [ ] `npx eslint .` bersih.
- [ ] Sudah dicoba minimal di satu HP/emulator dan satu lebar layar kecil.
- [ ] PR sudah direview.
- [ ] AC terkait dicatat di PR.
