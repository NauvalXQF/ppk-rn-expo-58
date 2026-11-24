import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { ProfilPengguna } from '@/services/authService';
import { archiveLaboratory, saveLaboratory } from '@/services/maps/laboratoryService';
import { DEFAULT_LAB_RADIUS, validCoordinates, validRadius } from '@/services/maps/laboratories';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';
import { LabPickerMap, LabPreview } from './LaboratoryMap';
import { MapSheet } from './MapSheet';

const fields = [
  ['nama', 'Nama laboratorium'],
  ['kode', 'Kode singkat'],
  ['gedung', 'Gedung dan lantai'],
  ['kapasitas', 'Kapasitas (orang)'],
  ['latitude', 'Latitude'],
  ['longitude', 'Longitude'],
  ['radiusMeters', 'Radius (meter)'],
] as const;

type Draft = Record<(typeof fields)[number][0], string>;
const blank: Draft = {
  nama: '', kode: '', gedung: '', latitude: '', longitude: '',
  radiusMeters: String(DEFAULT_LAB_RADIUS), kapasitas: '',
};
const COORDINATE_DECIMALS = 7;

function decimal(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
}

export function LabManagementModal({
  visible, actor, laboratories, location, writable, onClose,
}: {
  visible: boolean;
  actor: ProfilPengguna;
  laboratories: readonly Laboratory[];
  location?: LaboratoryCoordinates;
  writable: boolean;
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<{ id?: string; draft: Draft }>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [picker, setPicker] = useState<{ center: LaboratoryCoordinates | null; point: LaboratoryCoordinates | null }>();
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function edit(lab?: Laboratory) {
    setEditor({
      id: lab?.id,
      draft: lab ? {
        nama: lab.nama, kode: lab.kode, gedung: lab.gedung,
        kapasitas: String(lab.kapasitas), latitude: String(lab.latitude),
        longitude: String(lab.longitude), radiusMeters: String(lab.radiusMeters),
      } : blank,
    });
    setError(undefined);
    setSuccess(undefined);
    setConfirmArchive(false);
  }

  function change(field: keyof Draft, value: string) {
    setEditor((current) => current ? { ...current, draft: { ...current.draft, [field]: value } } : current);
  }

  function reset() {
    setEditor(undefined);
    setError(undefined);
    setConfirmArchive(false);
  }

  async function write(operation: () => Promise<void>, confirmation: string) {
    if (inFlight.current || !writable) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await operation();
      if (mounted.current) {
        reset();
        setSuccess(confirmation);
      }
    } catch (cause) {
      if (!mounted.current) return;
      const code = (cause as { code?: string } | undefined)?.code;
      setError(code === 'permission-denied'
        ? 'Firestore menolak perubahan laboratorium. Hubungi pengelola proyek.'
        : cause instanceof Error && !code
          ? cause.message
          : 'Perubahan gagal disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (!visible || actor.role !== 'asisten') return null;
  const draft = editor?.draft;
  const currentLab = laboratories.find((lab) => lab.id === editor?.id);
  const latitude = decimal(draft?.latitude ?? '');
  const longitude = decimal(draft?.longitude ?? '');
  const radiusMeters = decimal(draft?.radiusMeters ?? '');

  function openPicker() {
    if (!draft || busy) return;
    Keyboard.dismiss();
    const center = validCoordinates(latitude, longitude) ? { latitude, longitude }
      : location && validCoordinates(location.latitude, location.longitude)
        ? { latitude: location.latitude, longitude: location.longitude } : null;
    setPicker({ center, point: null });
  }

  function pickLocation(point: LaboratoryCoordinates) {
    if (!validCoordinates(point.latitude, point.longitude)) return;
    const coordinates = {
      latitude: Number(point.latitude.toFixed(COORDINATE_DECIMALS)),
      longitude: Number(point.longitude.toFixed(COORDINATE_DECIMALS)),
    };
    setPicker((current) => current ? { ...current, point: coordinates } : current);
  }

  function confirmLocation() {
    const point = picker?.point;
    if (!point || !validCoordinates(point.latitude, point.longitude)) return;
    setEditor((current) => current ? {
      ...current,
      draft: {
        ...current.draft,
        latitude: point.latitude.toFixed(COORDINATE_DECIMALS),
        longitude: point.longitude.toFixed(COORDINATE_DECIMALS),
      },
    } : current);
    setPicker(undefined);
  }

  if (picker) {
    const { center, point } = picker;
    const cancel = () => setPicker(undefined);
    return (
      <MapSheet title="Pilih Lokasi di Peta" onClose={cancel} fullScreen>
        <Text style={styles.pickerHint}>Ketuk peta untuk memilih lokasi laboratorium.</Text>
        <LabPickerMap center={center} point={point} radius={validRadius(radiusMeters) ? radiusMeters : null}
          onLocationPicked={pickLocation} />
        <View style={styles.pickerFooter}>
          <View style={styles.pickerCoordinates} accessibilityLiveRegion="polite">
            <Text style={styles.text}>Latitude {point?.latitude.toFixed(COORDINATE_DECIMALS) ?? '–'}</Text>
            <Text style={styles.text}>Longitude {point?.longitude.toFixed(COORDINATE_DECIMALS) ?? '–'}</Text>
          </View>
          <View style={styles.pickerActions}>
            <AppButton label="Batal" variant="secondary" onPress={cancel} style={styles.pickerButton} />
            <AppButton label="Gunakan Lokasi Ini" disabled={!point} onPress={confirmLocation} style={styles.pickerButton} />
          </View>
        </View>
      </MapSheet>
    );
  }

  return (
    <MapSheet title="Kelola laboratorium" onClose={onClose}>
      {!writable ? <InfoBanner tone="warning" message="Tunggu koneksi Firestore untuk menyimpan perubahan." /> : null}
      {busy ? <InfoBanner message="Menunggu Firestore mengonfirmasi penyimpanan…" /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {success ? <InfoBanner tone="success" message={success} /> : null}
      {!draft ? (
        <>
          <AppButton label="Tambah laboratorium" onPress={() => edit()} disabled={!writable || busy} />
          {!laboratories.length ? <Text style={styles.text}>Belum ada data laboratorium dari Firestore.</Text> : null}
          {laboratories.map((lab) => (
            <View key={lab.id} style={styles.row}>
              <View style={styles.rowDetails}>
                <Text style={styles.label}>{lab.nama}</Text>
                <Text style={styles.text}>{lab.kode} · {lab.aktif ? 'Aktif' : 'Diarsipkan'}</Text>
              </View>
              <AppButton label="Edit" onPress={() => edit(lab)} variant="secondary" disabled={busy} />
            </View>
          ))}
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={styles.label}>{editor.id ? 'Edit laboratorium' : 'Laboratorium baru'}</Text>
          {fields.map(([key, label]) => (
            <FormField
              key={key}
              label={label}
              accessibilityLabel={label}
              value={draft[key]}
              editable={!busy}
              autoCapitalize={key === 'kode' ? 'characters' : 'none'}
              keyboardType={key === 'kapasitas' ? 'number-pad' : key === 'radiusMeters' ? 'decimal-pad' : 'default'}
              onChangeText={(value) => change(key, value)}
            />
          ))}
          <AppButton label="Pilih Lokasi di Peta" variant="secondary" disabled={busy} onPress={openPicker} />
          <AppButton label="Gunakan lokasi saat ini" variant="secondary" disabled={!location || busy}
            onPress={() => {
              if (!location) return;
              change('latitude', String(location.latitude));
              change('longitude', String(location.longitude));
            }} />
          {validCoordinates(latitude, longitude) && validRadius(radiusMeters) ? (
            <LabPreview point={{ latitude, longitude }} radius={radiusMeters} />
          ) : null}
          <AppButton
            label="Simpan laboratorium"
            disabled={busy || !writable || Boolean(editor.id && !currentLab)}
            loading={busy && !confirmArchive}
            onPress={() => void write(() => saveLaboratory(actor, {
              nama: draft.nama, kode: draft.kode, gedung: draft.gedung, latitude, longitude,
              radiusMeters, kapasitas: decimal(draft.kapasitas),
            }, editor.id), 'Laboratorium berhasil disimpan.')}
          />
          {currentLab?.aktif ? (
            confirmArchive ? (
              <View style={styles.confirmation}>
                <Text style={styles.text}>Arsipkan {currentLab.nama}? Penandanya akan hilang dari peta.</Text>
                <AppButton label="Konfirmasi arsip" variant="danger" disabled={!writable}
                  loading={busy} onPress={() => void write(
                    () => archiveLaboratory(actor, currentLab.id), 'Laboratorium berhasil diarsipkan.',
                  )} />
              </View>
            ) : (
              <AppButton label="Arsipkan laboratorium" variant="secondary" disabled={!writable || busy}
                onPress={() => setConfirmArchive(true)} />
            )
          ) : null}
          <AppButton label="Kembali ke daftar" onPress={reset} variant="ghost" disabled={busy} />
        </>
      )}
    </MapSheet>
  );
}

const styles = StyleSheet.create({
  label: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  text: { color: Colors.textMuted, fontSize: FontSize.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: Spacing.sm,
  },
  rowDetails: { flex: 1, gap: Spacing.xs },
  confirmation: { gap: Spacing.sm, backgroundColor: Colors.dangerSoft, padding: Spacing.md },
  pickerHint: { color: Colors.textMuted, fontSize: FontSize.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  pickerFooter: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  pickerCoordinates: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  pickerButton: { minHeight: 48 },
});
