import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  assignSingleAsprakToLab,
  fetchAvailableAspraks,
  fetchLabAspraks,
  unassignAsprakFromLab,
  type AvailableAsprak,
  type LabAssignment,
} from '@/services/aslab/labAssignmentService';
import type { ProfilPengguna } from '@/services/authService';

interface ManageAsprakModalProps {
  visible: boolean;
  actor: ProfilPengguna;
  labId: string;
  labNama: string;
  courseId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ManageAsprakModal({
  visible,
  actor,
  labId,
  labNama,
  courseId,
  onClose,
  onSuccess,
}: ManageAsprakModalProps) {
  const [assigned, setAssigned] = useState<LabAssignment[]>([]);
  const [available, setAvailable] = useState<AvailableAsprak[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!labId) return;
    setLoading(true);
    setError(null);
    try {
      const [assignedList, availableList] = await Promise.all([
        fetchLabAspraks(labId),
        fetchAvailableAspraks(),
      ]);
      setAssigned(assignedList);
      setAvailable(availableList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar Asprak.');
    } finally {
      setLoading(false);
    }
  }, [labId]);

  useEffect(() => {
    if (!visible || !labId) return;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return;
        setLoading(true);
        setError(null);
        return Promise.all([fetchLabAspraks(labId), fetchAvailableAspraks()]);
      })
      .then((res) => {
        if (!active || !res) return;
        const [assignedList, availableList] = res;
        setAssigned(assignedList);
        setAvailable(availableList);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar Asprak.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, labId]);

  const assignedUids = useMemo(() => new Set(assigned.map((a) => a.uid)), [assigned]);

  const filteredCandidates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return available
      .filter((item) => !assignedUids.has(item.uid))
      .filter((item) => {
        if (!keyword) return true;
        return (
          item.nama.toLowerCase().includes(keyword) ||
          item.email.toLowerCase().includes(keyword) ||
          item.nip.toLowerCase().includes(keyword)
        );
      });
  }, [available, assignedUids, search]);

  async function handleAssign(item: AvailableAsprak) {
    setBusyUid(item.uid);
    setError(null);
    try {
      await assignSingleAsprakToLab(actor, labId, courseId, item);
      await loadData();
      onSuccess(`${item.nama} berhasil ditugaskan ke ${labNama}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menugaskan Asprak.');
    } finally {
      setBusyUid(null);
    }
  }

  async function handleUnassign(item: LabAssignment) {
    setBusyUid(item.uid);
    setError(null);
    try {
      await unassignAsprakFromLab(actor, labId, item.uid);
      await loadData();
      onSuccess(`${item.nama} dicopot dari ${labNama}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencopot Asprak.');
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Kelola Asprak Lab</Text>
              <Text style={styles.subtitle}>Target: {labNama}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <AppIcon name="x" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {error ? <InfoBanner tone="danger" message={error} /> : null}

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Asprak Bertugas ({assigned.length})</Text>
              {loading && assigned.length === 0 ? (
                <ActivityIndicator color={Colors.primary} />
              ) : assigned.length === 0 ? (
                <InfoBanner
                  tone="neutral"
                  message="Belum ada Asprak yang ditugaskan ke laboratorium ini."
                />
              ) : (
                <View style={styles.list}>
                  {assigned.map((item) => (
                    <View key={item.uid} style={styles.rowCard}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.nama}</Text>
                        <Text style={styles.rowMeta}>
                          {item.nip ? `${item.nip} · ` : ''}
                          {item.email}
                        </Text>
                      </View>
                      <AppButton
                        label={busyUid === item.uid ? 'Memproses...' : 'Copot'}
                        variant="danger"
                        size="sm"
                        disabled={busyUid !== null}
                        onPress={() => handleUnassign(item)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tambahkan Akun Asprak</Text>
              <FormField
                label="Cari Asprak"
                placeholder="Ketik nama, email, atau NIP"
                value={search}
                onChangeText={setSearch}
              />
              {loading && available.length === 0 ? (
                <ActivityIndicator color={Colors.primary} />
              ) : filteredCandidates.length === 0 ? (
                <InfoBanner
                  tone="neutral"
                  message={
                    search.trim()
                      ? 'Tidak ada akun Asprak yang cocok dengan pencarian.'
                      : 'Semua akun Asprak terdaftar sudah ditugaskan ke lab ini.'
                  }
                />
              ) : (
                <View style={styles.list}>
                  {filteredCandidates.map((item) => (
                    <View key={item.uid} style={styles.rowCard}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.nama}</Text>
                        <Text style={styles.rowMeta}>
                          {item.nip ? `${item.nip} · ` : ''}
                          {item.email || item.uid}
                        </Text>
                      </View>
                      <AppButton
                        label={busyUid === item.uid ? 'Memproses...' : 'Tugaskan'}
                        variant="primary"
                        size="sm"
                        disabled={busyUid !== null}
                        onPress={() => handleAssign(item)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <AppButton label="Tutup" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  scrollBody: {
    maxHeight: 440,
  },
  scrollContent: {
    gap: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  list: {
    gap: Spacing.xs,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  rowMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
