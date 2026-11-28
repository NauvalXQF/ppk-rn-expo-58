import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
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
  fetchLabAspraks,
  fetchLabMembers,
  transferAsprak,
  transferPraktikan,
  type ClassMember,
  type LabAssignment,
} from '@/services/aslab/labAssignmentService';
import type { Laboratory } from '@/types/laboratory';

export interface MemberTransferModalProps {
  visible: boolean;
  actor: ProfilPengguna;
  laboratories: readonly Laboratory[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function MemberTransferModal({
  visible,
  actor,
  laboratories,
  onClose,
  onSuccess,
}: MemberTransferModalProps) {
  const activeLaboratories = laboratories.filter((l) => l.aktif);
  const defaultFromId = activeLaboratories[0]?.id ?? '';
  const defaultToId = activeLaboratories[1]?.id ?? activeLaboratories[0]?.id ?? '';

  const [transferType, setTransferType] = useState<'praktikan' | 'asprak'>('praktikan');
  const [selectedFromLabId, setSelectedFromLabId] = useState<string>('');
  const [selectedToLabId, setSelectedToLabId] = useState<string>('');
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [aspraks, setAspraks] = useState<LabAssignment[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromLabId = selectedFromLabId || defaultFromId;
  const toLabId = selectedToLabId || (fromLabId === defaultToId ? (activeLaboratories.find((l) => l.id !== fromLabId)?.id ?? '') : defaultToId);

  // Fetch members or aspraks when fromLabId or transferType changes
  useEffect(() => {
    if (!fromLabId) return;

    let active = true;

    async function loadMembers() {
      try {
        if (transferType === 'praktikan') {
          const data = await fetchLabMembers(fromLabId);
          if (active) {
            setMembers(data);
            setSelectedMemberId(data.length > 0 ? (data[0].uid || data[0].nim) : '');
            setError(null);
            setLoadingMembers(false);
          }
        } else {
          const data = await fetchLabAspraks(fromLabId);
          if (active) {
            setAspraks(data);
            setSelectedMemberId(data.length > 0 ? (data[0].uid || data[0].nip) : '');
            setError(null);
            setLoadingMembers(false);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat anggota');
          setLoadingMembers(false);
        }
      }
    }

    void Promise.resolve().then(() => {
      if (active) setLoadingMembers(true);
      return loadMembers();
    });

    return () => {
      active = false;
    };
  }, [fromLabId, transferType]);

  const targetLabs = laboratories.filter((l) => l.id !== fromLabId && l.aktif);

  async function handleTransfer() {
    if (!fromLabId || !toLabId || !selectedMemberId) {
      setError('Lengkapi laboratorium asal, tujuan, dan anggota yang dipindahkan.');
      return;
    }
    if (fromLabId === toLabId) {
      setError('Laboratorium tujuan harus berbeda dengan laboratorium asal.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (transferType === 'praktikan') {
        const targetMember = members.find((m) => (m.uid || m.nim) === selectedMemberId);
        if (!targetMember) throw new Error('Praktikan tidak ditemukan.');
        await transferPraktikan(actor, fromLabId, toLabId, targetMember);
        onSuccess(`Praktikan ${targetMember.nama} berhasil dipindahkan ke laboratorium baru.`);
      } else {
        const targetAsprak = aspraks.find((a) => (a.uid || a.nip) === selectedMemberId);
        if (!targetAsprak) throw new Error('Asprak tidak ditemukan.');
        await transferAsprak(actor, fromLabId, toLabId, targetAsprak);
        onSuccess(`Asprak ${targetAsprak.nama} berhasil dipindahkan ke laboratorium baru.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pemindahan anggota gagal.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.bottomSheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <AppIcon name="repeat" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.headerTitle}>Pindahkan Anggota Antar Lab</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Memindahkan keanggotaan tanpa mengubah jadwal sesi praktikum.
            </Text>
          </View>

          {/* Type Toggle: Praktikan vs Asprak */}
          <View style={styles.typeToggleRow}>
            <FilterChip
              label="Praktikan"
              active={transferType === 'praktikan'}
              onPress={() => setTransferType('praktikan')}
            />
            <FilterChip
              label="Asprak"
              active={transferType === 'asprak'}
              onPress={() => setTransferType('asprak')}
            />
          </View>

          {error ? (
            <View style={styles.bannerMargin}>
              <InfoBanner tone="danger" message={error} />
            </View>
          ) : null}

          {/* Form Content */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Lab Asal */}
            <Text style={styles.sectionLabel}>Laboratorium Asal</Text>
            <View style={styles.chipScroll}>
              {laboratories
                .filter((l) => l.aktif)
                .map((lab) => (
                  <TouchableOpacity
                    key={lab.id}
                    style={[
                      styles.choiceCard,
                      fromLabId === lab.id && styles.choiceCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedFromLabId(lab.id);
                      if (toLabId === lab.id) {
                        const next = laboratories.find((l) => l.id !== lab.id && l.aktif);
                        if (next) setSelectedToLabId(next.id);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceCardTitle,
                        fromLabId === lab.id && styles.choiceCardTextSelected,
                      ]}
                    >
                      {lab.nama}
                    </Text>
                    <Text
                      style={[
                        styles.choiceCardSub,
                        fromLabId === lab.id && styles.choiceCardTextSelected,
                      ]}
                    >
                      {lab.kode} · {lab.gedung}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            {/* Anggota yang Dipindahkan */}
            <Text style={styles.sectionLabel}>
              Pilih {transferType === 'praktikan' ? 'Praktikan' : 'Asprak'} Terdaftar
            </Text>
            {loadingMembers ? (
              <Text style={styles.hintText}>Memuat anggota lab asal…</Text>
            ) : transferType === 'praktikan' && members.length === 0 ? (
              <InfoBanner tone="neutral" message="Tidak ada praktikan terdaftar di laboratorium ini." />
            ) : transferType === 'asprak' && aspraks.length === 0 ? (
              <InfoBanner tone="neutral" message="Tidak ada asprak bertugas di laboratorium ini." />
            ) : (
              <View style={styles.memberList}>
                {transferType === 'praktikan'
                  ? members.map((m) => {
                      const id = m.uid || m.nim;
                      const isSel = selectedMemberId === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.memberCard, isSel && styles.memberCardSelected]}
                          onPress={() => setSelectedMemberId(id)}
                        >
                          <Text style={[styles.memberName, isSel && styles.memberNameSelected]}>
                            {m.nama}
                          </Text>
                          <Text style={[styles.memberSub, isSel && styles.memberSubSelected]}>
                            NIM: {m.nim}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  : aspraks.map((a) => {
                      const id = a.uid || a.nip;
                      const isSel = selectedMemberId === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.memberCard, isSel && styles.memberCardSelected]}
                          onPress={() => setSelectedMemberId(id)}
                        >
                          <Text style={[styles.memberName, isSel && styles.memberNameSelected]}>
                            {a.nama}
                          </Text>
                          <Text style={[styles.memberSub, isSel && styles.memberSubSelected]}>
                            NIP: {a.nip}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
              </View>
            )}

            {/* Lab Tujuan */}
            <Text style={styles.sectionLabel}>Laboratorium Tujuan</Text>
            {targetLabs.length === 0 ? (
              <InfoBanner tone="warning" message="Tidak ada lab lain yang tersedia sebagai tujuan." />
            ) : (
              <View style={styles.chipScroll}>
                {targetLabs.map((lab) => (
                  <TouchableOpacity
                    key={lab.id}
                    style={[
                      styles.choiceCard,
                      toLabId === lab.id && styles.choiceCardSelected,
                    ]}
                    onPress={() => setSelectedToLabId(lab.id)}
                  >
                    <Text
                      style={[
                        styles.choiceCardTitle,
                        toLabId === lab.id && styles.choiceCardTextSelected,
                      ]}
                    >
                      {lab.nama}
                    </Text>
                    <Text
                      style={[
                        styles.choiceCardSub,
                        toLabId === lab.id && styles.choiceCardTextSelected,
                      ]}
                    >
                      {lab.kode} · {lab.gedung}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <AppButton
              label="Batal"
              variant="secondary"
              onPress={onClose}
              disabled={submitting}
              style={styles.footerBtn}
            />
            <AppButton
              label="Pindahkan Anggota"
              variant="primary"
              disabled={!fromLabId || !toLabId || !selectedMemberId || submitting}
              loading={submitting}
              onPress={handleTransfer}
              style={styles.footerBtnPrimary}
            />
          </View>
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
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    maxHeight: '90%',
    ...Shadow.card,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    marginBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  typeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  bannerMargin: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  scrollBody: {
    flexShrink: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs + 2,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  chipScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  choiceCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutralSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  choiceCardTitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  choiceCardSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  choiceCardTextSelected: {
    color: Colors.textOnDark,
  },
  hintText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  memberList: {
    gap: 4,
  },
  memberCard: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neutralSoft,
  },
  memberCardSelected: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  memberName: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  memberNameSelected: {
    color: Colors.primary,
    fontFamily: FontFamily.semibold,
  },
  memberSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  memberSubSelected: {
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  footerBtn: {
    flex: 1,
    minHeight: 44,
  },
  footerBtnPrimary: {
    flex: 2,
    minHeight: 44,
  },
});
