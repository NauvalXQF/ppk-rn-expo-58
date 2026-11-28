import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { InfoBanner } from '@/components/ui/InfoBanner';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import type { ProfilPengguna } from '@/services/authService';
import {
  downloadBulkCsvTemplate,
  getBulkCsvTemplate,
  parseBulkAsprakCsv,
  parseBulkLaboratoriumCsv,
  parseBulkPraktikanCsv,
  validateAsprakRow,
  validateLabRow,
  validatePraktikanRow,
  type AsprakRowData,
  type BulkRowItem,
  type BulkType,
  type LabRowData,
  type PraktikanRowData,
} from '@/services/aslab/bulkCsvService';
import {
  commitBulkAsprak,
  commitBulkLaboratorium,
  commitBulkPraktikan,
} from '@/services/aslab/labAssignmentService';
import { BulkPreviewScrollList } from './BulkPreviewScrollList';

export interface BulkInsertModalProps {
  visible: boolean;
  type: BulkType;
  actor: ProfilPengguna;
  courseId: string;
  courseNama: string;
  targetLabId?: string;
  targetLabNama?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const LAB_FIELD_LABELS: Record<keyof LabRowData, string> = {
  nama: 'Nama Laboratorium',
  kode: 'Kode Lab',
  gedung: 'Gedung dan Ruang',
  latitude: 'Latitude',
  longitude: 'Longitude',
  radiusMeters: 'Radius (m)',
  gracePeriodMinutes: 'Toleransi (menit)',
  lateFineAmount: 'Nominal Denda (Rp)',
  kapasitas: 'Kapasitas',
};

const PRAKTIKAN_FIELD_LABELS: Record<keyof PraktikanRowData, string> = {
  nim: 'NIM',
  nama: 'Nama Lengkap',
  email: 'Email Mahasiswa',
};

const ASPRAK_FIELD_LABELS: Record<keyof AsprakRowData, string> = {
  nip: 'NIP / Identitas',
  nama: 'Nama Lengkap',
  email: 'Email Asprak',
};

export function BulkInsertModal({
  visible,
  type,
  actor,
  courseId,
  courseNama,
  targetLabId,
  targetLabNama,
  onClose,
  onSuccess,
}: BulkInsertModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [csvInput, setCsvInput] = useState<string>('');
  const [labRows, setLabRows] = useState<BulkRowItem<LabRowData>[]>([]);
  const [praktikanRows, setPraktikanRows] = useState<BulkRowItem<PraktikanRowData>[]>([]);
  const [asprakRows, setAsprakRows] = useState<BulkRowItem<AsprakRowData>[]>([]);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const title =
    type === 'laboratorium'
      ? 'Impor Data Laboratorium'
      : type === 'praktikan'
        ? 'Impor Daftar Praktikan'
        : 'Impor Penugasan Asprak';

  const subtitle =
    type === 'laboratorium'
      ? `Target: ${courseNama} · ${courseId}`
      : `Target: ${targetLabNama || 'Laboratorium'} · ${courseNama}`;

  const columnFormatHint =
    type === 'laboratorium'
      ? 'Format kolom: nama, kode, gedung, latitude, longitude, radiusMeters'
      : type === 'praktikan'
        ? 'Format kolom: nim, nama, email'
        : 'Format kolom: nip, nama, email';

  const sampleFilename =
    type === 'laboratorium'
      ? 'daftar-laboratorium.csv'
      : type === 'praktikan'
        ? 'daftar-praktikan.csv'
        : 'daftar-asprak.csv';

  function handleReset() {
    setStep('upload');
    setCsvInput('');
    setLabRows([]);
    setPraktikanRows([]);
    setAsprakRows([]);
    setDownloadSuccess(null);
    setSaveError(null);
    setSaving(false);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleDownloadTemplate() {
    const ok = await downloadBulkCsvTemplate(type);
    if (ok) {
      setDownloadSuccess('File template berhasil diunduh / dibagikan.');
    }
  }

  function handleLoadSample() {
    setCsvInput(getBulkCsvTemplate(type));
  }

  function handleParseCsv() {
    if (!csvInput.trim()) {
      setSaveError('Masukkan teks atau file CSV terlebih dahulu.');
      return;
    }
    setSaveError(null);

    if (type === 'laboratorium') {
      const parsed = parseBulkLaboratoriumCsv(csvInput);
      if (parsed.length === 0) {
        setSaveError('Format CSV tidak valid atau baris kosong.');
        return;
      }
      setLabRows(parsed);
      setStep('preview');
    } else if (type === 'praktikan') {
      const parsed = parseBulkPraktikanCsv(csvInput);
      if (parsed.length === 0) {
        setSaveError('Format CSV tidak valid atau baris kosong.');
        return;
      }
      setPraktikanRows(parsed);
      setStep('preview');
    } else {
      const parsed = parseBulkAsprakCsv(csvInput);
      if (parsed.length === 0) {
        setSaveError('Format CSV tidak valid atau baris kosong.');
        return;
      }
      setAsprakRows(parsed);
      setStep('preview');
    }
  }

  // Row update handlers for Laboratorium
  function toggleLabStatus(rowId: string, status: 'accepted' | 'denied') {
    setLabRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status } : r)),
    );
  }

  function changeLabField(rowId: string, fieldKey: keyof LabRowData, value: string) {
    setLabRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updatedData = { ...r.data, [fieldKey]: value };
        const errors = validateLabRow(updatedData);
        return {
          ...r,
          data: updatedData,
          errors,
          isValid: Object.keys(errors).length === 0,
        };
      }),
    );
  }

  // Row update handlers for Praktikan
  function togglePraktikanStatus(rowId: string, status: 'accepted' | 'denied') {
    setPraktikanRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status } : r)),
    );
  }

  function changePraktikanField(rowId: string, fieldKey: keyof PraktikanRowData, value: string) {
    setPraktikanRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updatedData = { ...r.data, [fieldKey]: value };
        const errors = validatePraktikanRow(updatedData);
        return {
          ...r,
          data: updatedData,
          errors,
          isValid: Object.keys(errors).length === 0,
        };
      }),
    );
  }

  // Row update handlers for Asprak
  function toggleAsprakStatus(rowId: string, status: 'accepted' | 'denied') {
    setAsprakRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status } : r)),
    );
  }

  function changeAsprakField(rowId: string, fieldKey: keyof AsprakRowData, value: string) {
    setAsprakRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updatedData = { ...r.data, [fieldKey]: value };
        const errors = validateAsprakRow(updatedData);
        return {
          ...r,
          data: updatedData,
          errors,
          isValid: Object.keys(errors).length === 0,
        };
      }),
    );
  }

  async function handleCommit() {
    setSaving(true);
    setSaveError(null);

    try {
      if (type === 'laboratorium') {
        const result = await commitBulkLaboratorium(actor, courseId, courseNama, labRows);
        if (result.errors.length) {
          const committed = new Set(result.committedRowIds);
          setLabRows((rows) => rows.filter((row) => !committed.has(row.id)));
          setSaveError([`${result.successCount} laboratorium berhasil dibuat.`, ...result.errors].join('\n'));
          return;
        }
        onSuccess(`${result.successCount} laboratorium berhasil dibuat di bawah mata kuliah ${courseNama}.`);
      } else if (type === 'praktikan') {
        if (!targetLabId) throw new Error('Laboratorium tujuan belum dipilih.');
        const result = await commitBulkPraktikan(actor, targetLabId, praktikanRows, {
          courseId,
        });
        if (result.errors.length) {
          const committed = new Set(result.committedRowIds);
          setPraktikanRows((rows) => rows.filter((row) => !committed.has(row.id)));
          setSaveError([`${result.successCount} praktikan berhasil didaftarkan.`, ...result.errors].join('\n'));
          return;
        }
        onSuccess(`${result.successCount} praktikan berhasil didaftarkan ke laboratorium.`);
      } else {
        if (!targetLabId) throw new Error('Laboratorium tujuan belum dipilih.');
        const result = await commitBulkAsprak(actor, targetLabId, courseId, asprakRows);
        if (result.errors.length) {
          const committed = new Set(result.committedRowIds);
          setAsprakRows((rows) => rows.filter((row) => !committed.has(row.id)));
          setSaveError([`${result.successCount} asprak berhasil ditugaskan.`, ...result.errors].join('\n'));
          return;
        }
        onSuccess(`${result.successCount} asprak berhasil ditugaskan ke laboratorium.`);
      }
      handleClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Penyimpanan data bulk gagal.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <View style={styles.headerTitleRow}>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSub}>{subtitle}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
                <AppIcon name="x" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {step === 'upload' ? (
            <ScrollView style={styles.uploadBody} contentContainerStyle={styles.uploadBodyContent}>
              {/* Dashed Dropzone Card (FigCraft Screen/Aslab/ImporCSV) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleLoadSample}
                style={styles.dropzoneBox}
              >
                <AppIcon name="file-text" size={22} color={Colors.text} />
                <Text style={styles.dropzoneTitle}>
                  {csvInput.trim() ? sampleFilename : 'Tap untuk Muat Contoh CSV'}
                </Text>
                <Text style={styles.dropzoneSub}>
                  {columnFormatHint} · Tap untuk isi template
                </Text>
              </TouchableOpacity>

              <View style={styles.templateActions}>
                <AppButton
                  label="Unduh Template CSV"
                  variant="secondary"
                  size="sm"
                  onPress={handleDownloadTemplate}
                  style={styles.templateBtn}
                />
              </View>

              {downloadSuccess ? (
                <InfoBanner tone="success" message={downloadSuccess} />
              ) : null}

              {saveError ? (
                <InfoBanner tone="danger" message={saveError} />
              ) : null}

              {/* Paste or Type CSV input area */}
              <View style={styles.csvInputSection}>
                <Text style={styles.inputLabel}>Atau Tempel Data CSV</Text>
                <TextInput
                  style={styles.csvTextInput}
                  multiline
                  placeholder="Paste isi file .csv di sini..."
                  placeholderTextColor={Colors.textMuted}
                  value={csvInput}
                  onChangeText={setCsvInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.footerActions}>
                <AppButton
                  label="Proses & Pratinjau"
                  variant="primary"
                  disabled={!csvInput.trim()}
                  onPress={handleParseCsv}
                  style={styles.primaryActionBtn}
                />
                <AppButton
                  label="Batal"
                  variant="secondary"
                  onPress={handleClose}
                  style={styles.cancelActionBtn}
                />
              </View>
            </ScrollView>
          ) : (
            <View style={styles.previewContainer}>
              <TouchableOpacity
                style={styles.backToUploadBtn}
                onPress={() => setStep('upload')}
              >
                <AppIcon name="chevron-left" size={16} color={Colors.primary} />
                <Text style={styles.backToUploadText}>Ganti / Muat Ulang CSV</Text>
              </TouchableOpacity>

              {type === 'laboratorium' ? (
                <BulkPreviewScrollList<LabRowData>
                  type="laboratorium"
                  rows={labRows}
                  fieldLabels={LAB_FIELD_LABELS}
                  onToggleStatus={toggleLabStatus}
                  onChangeField={changeLabField}
                  onSave={handleCommit}
                  saving={saving}
                  saveError={saveError}
                />
              ) : type === 'praktikan' ? (
                <BulkPreviewScrollList<PraktikanRowData>
                  type="praktikan"
                  rows={praktikanRows}
                  fieldLabels={PRAKTIKAN_FIELD_LABELS}
                  onToggleStatus={togglePraktikanStatus}
                  onChangeField={changePraktikanField}
                  onSave={handleCommit}
                  saving={saving}
                  saveError={saveError}
                />
              ) : (
                <BulkPreviewScrollList<AsprakRowData>
                  type="asprak"
                  rows={asprakRows}
                  fieldLabels={ASPRAK_FIELD_LABELS}
                  onToggleStatus={toggleAsprakStatus}
                  onChangeField={changeAsprakField}
                  onSave={handleCommit}
                  saving={saving}
                  saveError={saveError}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: '92%',
    ...Shadow.card,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  headerSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  uploadBody: {
    flex: 1,
  },
  uploadBodyContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  dropzoneBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.accentBlue,
    backgroundColor: Colors.unreadSurface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  dropzoneTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  dropzoneSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  templateActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  templateBtn: {
    flex: 1,
  },
  csvInputSection: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  csvTextInput: {
    backgroundColor: Colors.neutralSoft,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    height: 150,
    textAlignVertical: 'top',
  },
  footerActions: {
    gap: Spacing.sm,
  },
  primaryActionBtn: {
    minHeight: 50,
    borderRadius: Radius.pill,
  },
  cancelActionBtn: {
    minHeight: 48,
    borderRadius: Radius.pill,
  },
  previewContainer: {
    flex: 1,
  },
  backToUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    alignSelf: 'flex-start',
  },
  backToUploadText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
});
