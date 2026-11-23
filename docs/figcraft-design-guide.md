# Guide: AI Mendesain UI di FigCraft (sebelum coding)

Tujuan: AI membuat **mockup high‑fidelity di FigCraft** yang semirip mungkin dengan gambar referensi ("Soft Glass Pastel"), disetujui user, baru kemudian diimplementasi ke kode Expo. Guide ini hanya untuk tahap desain. Spesifikasi implementasi kode ada di [ui-style-guide.md](./ui-style-guide.md) (token yang sama).

## 0. Prasyarat & koneksi

1. Jalankan FigCraft dengan control port (CMD):
   ```cmd
   start "" "C:\Program Files\ArtCraft\FigCraft\figcraft.exe" --control 7979
   ```
2. MCP `figcraft` di `~/.gemini/config/mcp_config.json` sudah menunjuk ke `figcraft-cli.exe mcp --attach 7979`. Reconnect MCP / mulai chat baru setelah app jalan.
3. Buka/buat file `docs/design/ppk-ui.figcraft` (simpan di repo) dengan `open_file` / `save_file`. Cek `run_command doc.list`.
4. Lampirkan gambar referensi di prompt. Bandingkan hasil dengan referensi pakai `screenshot`.

## 1. Aturan kerja AI di FigCraft

- Koordinat: satuan px, **y ke bawah**. `x/y` pada `create_node`/`set_properties` **relatif ke parent**.
- Anak dari frame auto layout **diposisikan oleh layout**: atur `layout`, `gap`, `padding`, `mainAlign`, `crossAlign`, `sizingH/sizingV` (`fixed|hug|fill`), jangan `x/y`.
- Gunakan **`batch`** untuk membangun satu komponen/layar sekaligus (satu undo step); beri nama step (`as`) dan referensikan dengan `{"$ref": "nama"}` sebagai `parent`.
- Warna `#RRGGBB` / `#RRGGBBAA`. Gradient: `fills: [{"type":"linearGradient","stops":[{"position":0,"color":"#..."},...]}]`.
- **Selalu beri nama layer** bermakna (`Card/Stat`, `Nav/Pill`, `Btn/Primary`), bukan "Frame 12".
- **Jangan hardcode**: buat variables/styles dulu (bagian 3), lalu bind (`variable.bind`, `style.apply`).
- Verifikasi tiap langkah: `screenshot` (visual) + `inspect_document`/`get_node` (ukuran, fill, layout). Perbaiki sebelum lanjut. Gunakan `undo` bila salah.
- Jangan hapus/ubah frame yang tidak diminta. Kerja di page terpisah per tahap.
- Cari command: `list_commands` dengan `filter` (`variable`, `style`, `component`, `effect`, `layout`, `proto`, `image`).

## 2. Struktur file

| Page | Isi |
|---|---|
| `00 Foundations` | Variables, text/effect styles, palet, tipografi, spacing, radius (dokumentasi visual) |
| `01 Components` | Komponen + variants (button, chip, card, nav, header, stat tile, badge, field) |
| `02 Screens` | Semua layar 393×852 berjejer rapi, jarak 80px, label di atas tiap frame |
| `03 Prototype` | Alur klik antar layar (`proto.*`) |

Frame layar: `frame.create` dengan `width: 393, height: 852` (iPhone 15/16), nama `Screen/<Nama>`. Cek preset dengan `frame.presets`. Beri `clip: true`.

## 3. Langkah 1 — Foundations

### 3.1 Variables (`variable.createCollection` → `variable.create`)
Koleksi **Color** (mode `Light`; tambah `Dark` bila diminta):

| Variable | Nilai | Pakai |
|---|---|---|
| `bg/base` | `#EEF1F6` | layar tanpa gradient |
| `surface` | `#FFFFFF` | sheet, kartu solid |
| `glass/fill` | `#FFFFFF8C` (55%) | glass card |
| `glass/stroke` | `#FFFFFFB3` (70%) | border glass |
| `text/primary` | `#23262D` | |
| `text/muted` | `#6B7280` | |
| `text/onDark` | `#FFFFFF` | |
| `action/primary` | `#2B2E35` | CTA, tab aktif |
| `accent/blue` | `#7BB8D4` | dot/data |
| `accent/pink` | `#E3A8DC` | progress |
| `accent/lavender` | `#CFC3F0` | |
| `accent/mint` | `#BFE6E4` | |
| `accent/peach` | `#F6C9B0` | |
| `accent/yellow` | `#F7E6A8` | |
| `status/success` / `-soft` | `#2F8F6B` / `#DDF3EA` | |
| `status/warning` / `-soft` | `#B7791F` / `#FBEFCF` | |
| `status/danger` / `-soft` | `#D14B4B` / `#FBE1E1` | |

Koleksi **Number**: `space/4,8,12,16,20,24,32`, `radius/12,20,28,32,pill(999)`.
Nilai harus identik dengan `src/constants/theme.ts` (sumber kebenaran tunggal; jika berubah, ubah keduanya).

### 3.2 Paint styles (gradient) — `style.create`
- `grad/screen`: `#C6DEEA → #D9E1F0 → #E9D3EA` (atas→bawah, ±180°)
- `grad/courseA`: `#F2B8D8 → #E4C4EE → #D7D2F3`
- `grad/courseB`: `#F6C4B8 → #F7E3A8 → #F3C7D0`
- `grad/courseC`: `#B9E3E6 → #CFE6EF → #D8D4F2`
- `grad/detailTop`: `#BFE0EE → #D8C9EE`

### 3.3 Text styles
Font: **Outfit** (fallback: Urbanist / Plus Jakarta Sans). Jika belum ada, `font.download`; jika tetap tidak ada, laporkan ke user, jangan diam‑diam ganti font.

| Style | Size / Weight | Line height |
|---|---|---|
| `display` | 32 / 500 | 38 |
| `title` | 24 / 400–500 | 30 |
| `stat` | 28 / 500 | 32 |
| `heading` | 18 / 500 | 24 |
| `body` | 15 / 400 | 22 |
| `label` | 13 / 400–500 | 18 |
| `caption` | 11 / 400 | 14 |

### 3.4 Effect styles
- `shadow/card`: dropShadow `#5B6B8C1F`, offset [0,10], radius 24
- `shadow/floating`: dropShadow `#0000002E`, offset [0,8], radius 20
- `glass/blur`: `backgroundBlur` radius ±24 (alternatif: efek `glass` bawaan FigCraft untuk tampilan lebih "liquid")

## 4. Langkah 2 — Components (`component.create`, `component.combineVariants`)

Bangun dengan auto layout penuh, bind ke variables/styles. Buat variants lewat `component.addVariant`/`combineVariants` dan properti via `component.addProperty` (teks, boolean ikon).

| Komponen | Spesifikasi (ukuran px) |
|---|---|
| `Btn/Primary` | tinggi 52, pill, fill `action/primary`, teks `label` putih 500, padding H 24, `sizingH: fill` varian lebar penuh. Variants: `state` = default/pressed/disabled |
| `Btn/Secondary` | pill, fill putih 70%, stroke `glass/stroke` 1 |
| `Btn/Icon` | 44×44 lingkaran, putih/glass, ikon charcoal 20px. Varian `dark` (fill charcoal, ikon putih) untuk panah "continue" |
| `Chip` | tinggi 28, pill, fill `#FFFFFFB3`, stroke tipis, ikon 14 + teks `caption`, gap 6. Varian filter: `active` (charcoal + teks putih) / `inactive` |
| `Card/Glass` | radius 28, fill `glass/fill`, stroke `glass/stroke` 1, effect `glass/blur` + `shadow/card`, padding 16–20, auto layout vertical gap 12 |
| `Card/Gradient` | tinggi 140, radius 28, fill `grad/course*`, padding 16; slot: 2 chip (atas), judul + deskripsi 2 baris (bawah); dekorasi shape (lihat 4.1) di kanan, clip aktif |
| `Stat/Tile` | Card/Glass; label (ikon 16 + `label` muted) → angka `stat` → sub‑info `caption` |
| `Progress/Bar` | tinggi 5, track `#FFFFFF99`, fill `accent/pink`, radius pill |
| `Heatmap/Dot` | ellipse 9×9, `filled` = `accent/blue`, `empty` = `#FFFFFFE6`; grid 7 kolom × 6 baris, gap 5, label hari `caption` |
| `Nav/Pill` | lebar 313 (margin 40), tinggi 64, pill, fill putih 70% + blur, `shadow/floating`; 4 item ikon 24; item aktif = lingkaran 48 charcoal + ikon putih. Varian `active` = 0..3 |
| `Header/Profile` | avatar 36 lingkaran + nama (`label`) + level (`caption` muted) kiri; pill poin kanan |
| `Header/Nav` | Btn/Icon (back) — judul tengah — Btn/Icon (search/favorit) |
| `Sheet/White` | fill putih, radius atas 32 (`cornerRadius: [32,32,0,0]`), padding 24 |
| `Row/Info` | ikon charcoal 20 + label (`body`) kiri, nilai kanan; separator 1px `#0000000F` |
| `Badge/Status` | pill soft (success/warning/danger/neutral) |
| `Field/Input` | tinggi 52, radius 20, fill putih, stroke `border`, label di atas |
| `Status bar` | 393×54 (jam 9:41, ikon sinyal/baterai) agar mirip referensi |

### 4.1 Dekorasi bentuk (bunga/bintang/asterisk)
- Gambar dengan `vector.create` (SVG path), atau `shape.star` (`pointCount` 4, `innerRadius` ~0.35 untuk bintang 4 titik; kelopak bunga = beberapa ellipse yang di‑rotate dan digabung).
- Fill putih, opacity 0.5–0.65, ukuran 90–120, posisi kanan‑tengah kartu, sebagian keluar tepi (parent `clip: true`). Tambah `layerBlur` kecil atau inner highlight untuk kesan 3D/lembut.
- Jadikan komponen `Deco/Flower`, `Deco/Star4`, `Deco/Asterisk`.

## 5. Langkah 3 — Screens (393×852)

Margin horizontal 20–24, gap antar kartu 12, konten bawah `padding-bottom` ≥ 96 untuk nav. Tiap layar dimulai dari Status bar, lalu isi. **Pakai instance komponen**, bukan menggambar ulang.

| Layar FigCraft | Base referensi | Isi (data dari app: lab/praktikum/kehadiran) |
|---|---|---|
| `Screen/Rekap` (praktikan) | Progress overview | Fill `grad/screen`. Header profil → judul "Rekap kehadiran" → Card besar (total jam + Heatmap/Dot per pertemuan) → 2 Stat/Tile (mis. "Streak hadir", "Pertemuan selesai") → Card "Lanjutkan" (progress bar + btn panah) → Nav/Pill |
| `Screen/Jadwal` | Courses list | Fill `bg/base` (`#F3F3F5`). Header/Nav (back, "Jadwal", search) → filter Chip → 3–4 Card/Gradient (judul praktikum, deskripsi, chip waktu & lab) |
| `Screen/SesiDetail` | Course detail | Header gradient + dekorasi besar + Btn/Icon + chip meta + judul `display`; Sheet/White overlap ±24 dengan Row/Info (Lab, Waktu, Peserta) + daftar agenda; CTA pill charcoal melayang "Presensi sekarang" |
| `Screen/Presensi` | Detail + CTA | Status lokasi = Card/Glass + Badge; CTA pill melayang |
| `Screen/Peta` | Peta + sheet | Placeholder peta, kontrol Btn/Icon, sheet putih radius 32 untuk detail lab |
| `Screen/Izin` | List + form | Field/Input, Badge/Status, Btn/Primary |
| `Screen/Profil` | Header profil | Header gradient, avatar besar, Row/Info |

Pertahankan **konten & role asli app** (asisten vs praktikan; Bahasa Indonesia). Jangan mengarang fitur baru. Jika tab > 5, jangan memaksa masuk ke Nav/Pill: tandai di catatan dan tanya user (usulan: pindahkan ke Profil).

## 6. Langkah 4 — Prototype (opsional)
`proto.interaction.add` untuk: tab nav → layar tab, kartu Jadwal → SesiDetail, CTA → Presensi, back → kembali. `proto.flow.add` pada layar awal. Preview: `proto.preview`.

## 7. Loop verifikasi (wajib tiap layar/komponen)

1. `screenshot` layar → bandingkan dengan referensi.
2. Checklist:
   - [ ] Gradient pastel halus, tidak ada warna jenuh
   - [ ] Radius kartu ≥ 28, tombol/chip/nav pill
   - [ ] Hanya satu aksen gelap (`action/primary`)
   - [ ] Font Outfit di semua teks; ukuran sesuai text style
   - [ ] Semua fill/teks ter‑bind ke variable/style (`inspect_document`: cek binding; tidak ada hex liar)
   - [ ] Auto layout benar (resize frame ke 360 lebar tidak merusak)
   - [ ] Kontras teks ≥ 4.5:1 di atas gradient
   - [ ] Nama layer rapi, komponen dipakai sebagai instance
3. Perbaiki selisih, ulangi. Maksimal 3 iterasi per layar, lalu minta feedback user.
4. Setelah disetujui: `export` PNG tiap layar ke `docs/design/exports/` dan `save_file`.

## 8. Handoff ke kode
Setelah desain disetujui, jalankan `variable.export` dan catat nilai token ke `src/constants/theme.ts`; implementasi mengikuti [ui-style-guide.md](./ui-style-guide.md) bagian 8 (urutan tahap). Gunakan nama komponen FigCraft = nama komponen React (`AppButton`, `AppCard`, dst.).

## 9. Template prompt

**Tahap 1 – Foundations**
```
Baca docs/figcraft-design-guide.md. Gunakan MCP figcraft. Lampirkan referensi.
Buat page "00 Foundations": variables (Color & Number), paint/text/effect styles persis bagian 3.
Verifikasi dengan screenshot + variable.list, lalu laporkan.
```
**Tahap 2 – Components**
```
Lanjut ke bagian 4: bangun komponen di page "01 Components" dengan auto layout, bind ke variables/styles, buat variants.
Mulai dari Btn/Primary, Chip, Card/Glass, Nav/Pill. Screenshot tiap komponen dan bandingkan dengan referensi.
```
**Tahap 3 – Screens**
```
Bangun Screen/Rekap dan Screen/Jadwal (393×852) di page "02 Screens" memakai instance komponen. Jalankan loop verifikasi bagian 7 dan tunjukkan screenshot.
```

## 10. Catatan batas
- Gradient mesh/efek 3D pada dekorasi tidak bisa 100% sama; target kemiripan ±90%: palet, radius, tipografi, layout, glass.
- Efek blur/glass di Android/RN tidak identik dengan mockup; catat perbedaan di handoff.
- Jika command gagal ("Unknown key", dll.), `list_commands` + `figcraft://command/{id}` untuk cek parameter; jangan menebak berulang.
