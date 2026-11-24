# UI/UX Style Guide — "Soft Glass Pastel"

Panduan untuk AI (dan developer) agar UI app ini semirip mungkin dengan referensi: aplikasi belajar bergaya **pastel gradient + glassmorphism**, bersih, banyak whitespace, sudut sangat bulat.

> Referensi: 3 layar (Progress overview, Courses list, Course detail). Simpan gambarnya di `docs/assets/ui-reference.jpg` agar bisa dilampirkan ke prompt AI.

## 0. Aturan wajib untuk AI

1. Baca `AGENTS.md` dulu (Expo SDK 58: cek docs versi terkait sebelum memakai API Expo/RN).
2. **Jangan hardcode** warna/ukuran/font di screen. Semua dari `src/constants/theme.ts` (token di bagian 2) dan komponen di `src/components/ui/`.
3. Ubah **komponen dasar dulu** (`AppCard`, `AppButton`, `ScreenContainer`, `StatusBadge`, tab bar), baru screen. Satu perubahan komponen harus memperbarui seluruh app.
4. Jangan mengubah logika/service/Firebase/route. Hanya layer presentasi.
5. Dependensi baru wajib via `npx expo install <pkg>` (prioritaskan modul Expo: `expo-linear-gradient`, `expo-blur`, `expo-glass-effect` yang sudah ada, `expo-symbols`, `@expo-google-fonts/*`).
6. Selesai tiap tahap: `npx tsc --noEmit` dan `npx expo lint`, lalu cek visual di device/simulator dan bandingkan dengan referensi.
7. Teks UI tetap Bahasa Indonesia. Pertahankan accessibility (`accessibilityRole`, `accessibilityLabel`, touch target ≥ 44).

## 1. Prinsip visual (ciri khas referensi)

| Ciri | Penerapan |
|---|---|
| Latar pastel **gradient lembut** (biru muda → mint → lavender → pink) | Background layar utama berupa gradient, bukan warna datar |
| **Glass card**: putih semi-transparan, border putih tipis, blur | Kartu statistik/ringkasan di atas gradient |
| Radius **besar** (24–32 untuk kartu, pill untuk chip/tombol/nav) | Hampir tidak ada sudut tajam |
| Tipografi geometris-bulat, ringan, kontras rendah-menengah | Font seperti **Outfit** / Urbanist; weight 400/500, angka besar weight 500 |
| Aksen tunggal **charcoal gelap** untuk aksi utama | CTA, tab aktif, tombol ikon aktif = `#2B2E35` |
| Data viz minimalis dengan **dot grid** biru muda | Heatmap titik, progress bar tipis berwarna pink/lavender |
| Dekorasi **bentuk besar pudar** (bunga/bintang/asterisk) di pojok kartu | Ilustrasi putih transparan ±40% opacity, terpotong tepi kartu |
| **Floating pill bottom nav** | Bukan tab bar penuh; mengambang, ikon saja, item aktif di lingkaran gelap |
| Detail screen: header gradient + **sheet putih** bersudut atas bulat + CTA pill gelap melayang | |

## 2. Design tokens (ganti isi `src/constants/theme.ts`)

```ts
export const Colors = {
  // Surface
  background: '#EEF1F6',          // fallback untuk layar tanpa gradient (mis. list Courses)
  surface: '#FFFFFF',
  glass: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.7)',
  // Text
  text: '#23262D',
  textMuted: '#6B7280',
  textOnDark: '#FFFFFF',
  // Aksi utama (charcoal)
  primary: '#2B2E35',
  primaryPressed: '#1B1D22',
  primarySoft: 'rgba(43,46,53,0.08)',
  // Aksen data
  accentBlue: '#7BB8D4',          // dot terisi / data utama
  accentPink: '#E3A8DC',          // progress bar
  accentLavender: '#CFC3F0',
  accentMint: '#BFE6E4',
  accentPeach: '#F6C9B0',
  accentYellow: '#F7E6A8',
  border: 'rgba(0,0,0,0.06)',
  // Semantik (versi soft)
  success: '#2F8F6B', successSoft: '#DDF3EA',
  warning: '#B7791F', warningSoft: '#FBEFCF',
  danger: '#D14B4B',  dangerSoft: '#FBE1E1',
  neutralSoft: '#F1F2F5',
} as const;

export const Gradients = {
  // [atas → bawah], dipakai LinearGradient
  screen:    ['#C6DEEA', '#D9E1F0', '#E9D3EA'],   // biru → lavender → pink (Progress overview)
  courseA:   ['#F2B8D8', '#E4C4EE', '#D7D2F3'],   // pink → lavender
  courseB:   ['#F6C4B8', '#F7E3A8', '#F3C7D0'],   // peach → kuning → pink
  courseC:   ['#B9E3E6', '#CFE6EF', '#D8D4F2'],   // mint → biru → lavender
  detailTop: ['#BFE0EE', '#D8C9EE'],
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const Radius = { sm: 12, md: 20, lg: 28, xl: 32, pill: 999 } as const;

export const FontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, display: 32, stat: 28 } as const;

export const FontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

export const Shadow = {
  card: { shadowColor: '#5B6B8C', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  floating: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;
```

Font: `npx expo install @expo-google-fonts/outfit expo-font`, load di `src/app/_layout.tsx` lewat `useFonts`, tahan splash sampai siap. Semua `<Text>` memakai `FontFamily` (buat komponen `AppText` agar tidak mengulang).

## 3. Layout & spacing

- Padding horizontal layar **20–24**; jarak antar kartu **12–16**; padding dalam kartu **16–20**.
- Konten selalu di atas gradient; header = avatar + nama/level di kiri, pill kecil (poin/notifikasi) di kanan, judul layar besar (`FontSize.xl`, weight 400/500) di bawahnya.
- Beri ruang bawah ≥ 96 agar konten tidak tertutup floating nav.
- Grid statistik: 2 kolom sama lebar (`gap: 12`), kartu lebar penuh di bawahnya.

## 4. Komponen (cara membangun)

### 4.1 `ScreenContainer`
- Tambah prop `variant: 'gradient' | 'plain'`. `gradient` → `LinearGradient` fullscreen (`Gradients.screen`), `plain` → `Colors.background`.
- `SafeAreaView` tetap; status bar `dark`.

### 4.2 `AppCard` → Glass card
- `borderRadius: Radius.lg`, `backgroundColor: Colors.glass`, `borderWidth: 1`, `borderColor: Colors.glassBorder`, `Shadow.card`, padding 16–20.
- Efek blur: bungkus dengan `BlurView` (`expo-blur`, intensity ~30, `overflow: 'hidden'`) atau `expo-glass-effect` di iOS; fallback ke warna `glass` di Android/web.
- Varian: `glass` (default di atas gradient), `solid` (putih penuh, untuk sheet/list), `gradient` (kartu course, lihat 4.6).

### 4.3 `AppButton`
- Primary: pill (`Radius.pill`), `backgroundColor: Colors.primary`, teks putih weight 500, tinggi 52, lebar penuh untuk CTA.
- Secondary: pill putih/glass, teks `text`. Ghost: transparan.
- Varian `icon`: lingkaran 40–44, putih/glass, ikon charcoal (tombol back, search, favorit); arah panah di kartu "Continue" = lingkaran charcoal dengan ikon putih.
- CTA bawah (mis. "Buy for $49.99"): `position: 'absolute'`, `left/right: 20`, `bottom: safeArea + 16`, `Shadow.floating`.

### 4.4 Chip / Badge (`StatusBadge`, filter)
- Pill, tinggi 28–36, putih (`rgba(255,255,255,0.7)`) dengan border tipis, ikon kecil + teks `FontSize.xs/sm`.
- Filter chip: aktif = `primary` + teks putih; tidak aktif = putih + border. Scroll horizontal tanpa indikator.

### 4.5 Floating pill bottom navigation
- Ganti tab bar default di `src/app/(tabs)/_layout.tsx` dengan `tabBar` kustom (atau `tabBarStyle` absolute) :
  - `position: 'absolute'`, `bottom: insets.bottom + 12`, `marginHorizontal: 40`, tinggi 64, `Radius.pill`, glass/putih 70%, `Shadow.floating`.
  - **Ikon saja** (SF Symbols via `expo-symbols`, outline); tab aktif = lingkaran charcoal 48px dengan ikon putih; tidak aktif = ikon `textMuted`.
  - Tetap pertahankan logika role (`asisten` / praktikan) dan `href: null` yang sudah ada. Beri `accessibilityLabel` = judul tab karena label teks disembunyikan.
  - Maksimal 4–5 item agar tetap lega (gabungkan/pindahkan tab yang jarang dipakai ke Profil bila perlu — tanyakan ke user dulu).

### 4.6 Kartu gradient + dekorasi (daftar item, analog "Courses")
- Tinggi ±130–150, `Radius.lg`, `LinearGradient` per item (rotasi `courseA/B/C`), padding 16.
- Atas: dua chip kecil (rating, jumlah). Bawah: judul (`FontSize.lg`, weight 500) + deskripsi 2 baris (`textMuted` gelap-transparan).
- Dekorasi: bentuk (bintang 4 titik / bunga / asterisk) putih opacity ~0.5–0.6, ukuran ±90–110, posisi kanan-tengah, sebagian terpotong. Buat sebagai SVG/PNG di `assets/shapes/` (3–4 bentuk), render dengan `expo-image`, `pointerEvents="none"`.
- Untuk "mesh gradient" lebih halus: tumpuk 2–3 `LinearGradient` semi-transparan dengan arah berbeda.

### 4.7 Stat tile & metrik
- Label kecil (ikon + teks `textMuted`) di atas, **angka besar** (`FontSize.stat`, weight 500) di bawah, sub-info kecil di kanan/bawah (mis. "Best 213", "+2 this week").
- Progress bar: tinggi 4–6, track putih 60%, fill `accentPink`, radius pill.
- Dot grid (heatmap): titik 8–10px, gap 4, kolom = hari, terisi `accentBlue`, kosong putih; label hari `FontSize.xs` di bawah.

### 4.8 Detail screen
- Header: gradient (`detailTop`) + dekorasi besar pudar di kanan atas; tombol back (kiri) dan favorit/aksi (kanan) berupa lingkaran putih; chip meta; judul besar (`FontSize.display`).
- Body: **sheet putih** (`Radius.xl` hanya sudut atas, overlap ke header ±24px). Baris info = ikon charcoal + label kiri, nilai kanan; pemisah tipis; section title kecil `textMuted`; item program = judul (`md`, 500), meta kecil, deskripsi.
- Tombol CTA melayang pill charcoal di bawah.

### 4.9 Header layar list
- Tombol back lingkaran kiri, judul tengah (`Courses`), tombol search lingkaran kanan; background abu muda `#F3F3F5` (bukan gradient) untuk layar list padat.

## 5. Motion & interaksi

- Press: scale 0.97 + opacity 0.9 (Reanimated, 120 ms). Jangan lebih dari itu.
- Transisi tab/layar: fade/slide halus 200–250 ms; entry kartu: fade-in + translateY 8, stagger 40 ms (opsional).
- Haptic ringan (`expo-haptics`, via `npx expo install`) saat tap tab & CTA — opsional.

## 6. Do / Don't

**Do**: gradient lembut, whitespace banyak, radius besar, satu warna aksi gelap, ikon outline tipis, angka besar + label kecil.
**Don't**: warna jenuh/neon, border tegas 1px abu di mana-mana, shadow hitam pekat, ikon filled tebal, teks bold berlebihan, primary biru lama (`#1A56DB`), sudut ≤ 12 pada kartu besar, tab bar penuh bergaris.

## 7. Pemetaan ke screen proyek ini

| Screen sekarang | Padanan referensi | Catatan |
|---|---|---|
| `jadwal` | Courses list | Kartu sesi = gradient card + chip (waktu, lab); filter chip hari/status |
| `rekap` (praktikan) | Progress overview | Stat tile kehadiran, dot grid per pertemuan, kartu ringkasan |
| `kehadiran` / `presensi/[sesiId]` | Progress + CTA | Status lokasi = glass card; tombol "Presensi" = CTA pill melayang |
| `sesi/[sesiId]` | Course detail | Header gradient + sheet putih + info rows |
| `peta` | Peta fullscreen | Sheet/modal pakai gaya sheet putih radius besar; kontrol = tombol lingkaran |
| `izin` | List + form | Form field radius 20, badge status soft pill |
| `profil` | Header profil | Avatar + level/peran pill di header gradient |

## 8. Urutan kerja yang disarankan (satu PR per tahap)

1. **Tokens & font** — `theme.ts`, load Outfit, komponen `AppText`.
2. **Komponen dasar** — `ScreenContainer` (gradient), `AppCard` (glass), `AppButton` (pill + icon), `StatusBadge`/chip.
3. **Navigasi** — floating pill tab bar.
4. **Komponen domain** — `SessionCard` (gradient card), `AttendanceRow`, stat tile, dot grid.
5. **Screen** satu per satu sesuai tabel bagian 7 (mulai `rekap`/`jadwal`, lalu `sesi`).
6. **Polish** — motion, dark mode (opsional; gelapkan gradient, jaga kontras), cek aksesibilitas.

## 9. Checklist QA (bandingkan dengan referensi)

- [ ] Latar gradient pastel terlihat halus, tanpa banding keras
- [ ] Semua kartu radius ≥ 20, ada border/blur glass
- [ ] Font Outfit termuat di semua teks; tidak ada font sistem tersisa
- [ ] Hanya satu aksen gelap untuk aksi utama
- [ ] Bottom nav mengambang, ikon saja, item aktif lingkaran gelap
- [ ] Kontras teks ≥ 4.5:1 di atas gradient (cek teks `textMuted`)
- [ ] Tidak ada nilai warna/ukuran hardcode di screen (`rg "#[0-9A-Fa-f]{6}" src/features src/app`)
- [ ] Layout aman di layar kecil (iPhone SE / Android 360dp) dan safe area
- [ ] `npx tsc --noEmit` & `npx expo lint` bersih

## 10. Template prompt untuk AI

```
Baca AGENTS.md dan docs/ui-style-guide.md. Lampirkan gambar referensi.
Kerjakan TAHAP <n> saja: <deskripsi>.
Aturan: pakai token dari theme.ts, jangan ubah logika/service/route, dependensi baru via `npx expo install`.
Setelah selesai jalankan tsc + lint, lalu jelaskan perbedaan yang masih tersisa dibanding referensi.
```
