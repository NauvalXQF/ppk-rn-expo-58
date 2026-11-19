import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { ProfilPengguna } from '@/services/authService';
import { archiveLaboratory, saveLaboratory } from '@/services/maps/laboratoryService';
import { DEFAULT_LAB_RADIUS, validCoordinates, validRadius } from '@/services/maps/laboratories';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';
import { LabPreview } from './LaboratoryMap';
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
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const inFlight = useRef(false);

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

  async function write(operation: () => Promise<void>) {
    if (inFlight.current || !writable) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      reset();
    } catch (cause) {
      const code = (cause as { code?: string } | undefined)?.code;
      setError(code === 'permission-denied'
        ? 'Firestore menolak perubahan laboratorium. Hubungi pengelola proyek.'
        : cause instanceof Error && !code
          ? cause.message
          : 'Perubahan gagal disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!visible || actor.role !== 'asisten') return null;
  const draft = editor?.draft;
  const currentLab = laboratories.find((lab) => lab.id === editor?.id);
  const latitude = decimal(draft?.latitude ?? '');
  const longitude = decimal(draft?.longitude ?? '');
  const radiusMeters = decimal(draft?.radiusMeters ?? '');

  return (
    <MapSheet title="Kelola laboratorium" onClose={onClose}>
      {!writable ? <InfoBanner tone="warning" message="Tunggu koneksi Firestore untuk menyimpan perubahan." /> : null}
      {busy ? <InfoBanner message="Menunggu Firestore mengonfirmasi penyimpanan…" /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
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
            disabled={!writable || Boolean(editor.id && !currentLab)}
            loading={busy && !confirmArchive}
            onPress={() => void write(() => saveLaboratory(actor, {
              nama: draft.nama, kode: draft.kode, gedung: draft.gedung, latitude, longitude,
              radiusMeters, kapasitas: decimal(draft.kapasitas),
            }, editor.id))}
          />
          {currentLab?.aktif ? (
            confirmArchive ? (
              <View style={styles.confirmation}>
                <Text style={styles.text}>Arsipkan {currentLab.nama}? Penandanya akan hilang dari peta.</Text>
                <AppButton label="Konfirmasi arsip" variant="danger" disabled={!writable}
                  loading={busy} onPress={() => void write(() => archiveLaboratory(actor, currentLab.id))} />
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
});
