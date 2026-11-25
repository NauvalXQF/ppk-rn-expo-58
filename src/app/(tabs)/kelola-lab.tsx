import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { BulkInsertModal } from '@/features/aslab/BulkInsertModal';
import { MemberTransferModal } from '@/features/aslab/MemberTransferModal';
import { LabManagementModal } from '@/features/maps/LabManagementModal';
import { useLaboratoryData } from '@/features/maps/useMapsData';
import type { BulkType } from '@/services/aslab/bulkCsvService';
import type { Laboratory } from '@/types/laboratory';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface CourseItem {
  id: string;
  kode: string;
  nama: string;
}

const DEFAULT_COURSES: CourseItem[] = [
  { id: 'praktikum-ppk', kode: 'IF2104', nama: 'Praktikum Pemrograman Komputer' },
  { id: 'praktikum-bd', kode: 'IF2105', nama: 'Praktikum Basis Data' },
];

interface ToolRowProps {
  icon: AppIconName;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}

function ToolRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
  last = false,
}: ToolRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.toolRow, !last && styles.toolRowBorder]}
    >
      <View style={[styles.toolIconBox, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.toolTextCol}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <AppIcon name="arrow-up-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function KelolaLabScreen() {
  const { pengguna } = useAuth();
  const labData = useLaboratoryData(true);
  const laboratories = (labData.snapshot?.laboratories ?? []) as Laboratory[];

  const [selectedCourseId, setSelectedCourseId] = useState<string>(DEFAULT_COURSES[0].id);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [bulkModalType, setBulkModalType] = useState<BulkType | null>(null);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [singleLabModalVisible, setSingleLabModalVisible] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const selectedCourse =
    DEFAULT_COURSES.find((c) => c.id === selectedCourseId) ?? DEFAULT_COURSES[0];
  const activeLabs = laboratories.filter((l: Laboratory) => l.aktif);
  const currentLab =
    activeLabs.find((l: Laboratory) => l.id === selectedLabId) ?? activeLabs[0];

  function openBulkModal(type: BulkType) {
    setFeedbackSuccess(null);
    setBulkModalType(type);
  }

  function handleSuccess(msg: string) {
    setFeedbackSuccess(msg);
  }

  function handleOpenAddLab() {
    setSingleLabModalVisible(true);
  }

  function handleOpenEditLab(labId: string) {
    setSelectedLabId(labId);
    setSingleLabModalVisible(true);
  }

  return (
    <ScreenContainer variant="gradient" hasTabBar={true}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>Kelola Lab</Text>
            <Text style={styles.subtitle}>
              Pengaturan laboratorium, impor CSV, dan mutasi anggota
            </Text>
          </View>
          <AppButton
            label="+ Tambah"
            variant="primary"
            size="sm"
            onPress={handleOpenAddLab}
          />
        </View>

        {feedbackSuccess ? (
          <InfoBanner tone="success" message={feedbackSuccess} />
        ) : null}

        {/* 1. Pemilih Mata Kuliah */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mata Kuliah</Text>
          <View style={styles.courseChipRow}>
            {DEFAULT_COURSES.map((course) => (
              <FilterChip
                key={course.id}
                label={`${course.kode} · ${course.nama}`}
                active={selectedCourseId === course.id}
                onPress={() => setSelectedCourseId(course.id)}
              />
            ))}
          </View>
        </View>

        {/* 2. Daftar Laboratorium Aktif */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Laboratorium Aktif ({activeLabs.length})
            </Text>
            {currentLab ? (
              <Text style={styles.selectedHint}>Target: {currentLab.nama}</Text>
            ) : null}
          </View>

          {activeLabs.length === 0 ? (
            <InfoBanner
              tone="neutral"
              message="Belum ada laboratorium terdaftar. Tambah manual atau impor data melalui CSV."
            />
          ) : (
            <View style={styles.labsList}>
              {activeLabs.map((lab: Laboratory) => {
                const isCurrent = currentLab?.id === lab.id;
                return (
                  <AppCard
                    key={lab.id}
                    variant="glass"
                    style={[styles.labItemCard, isCurrent && styles.labItemCardSelected]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setSelectedLabId(lab.id)}
                    >
                      <View style={styles.labCardHeader}>
                        <View style={styles.labTitleRow}>
                          <Text style={styles.labName}>{lab.nama}</Text>
                          <View style={styles.labHeaderRight}>
                            <View style={styles.labBadge}>
                              <Text style={styles.labBadgeText}>{lab.kode}</Text>
                            </View>
                            <TouchableOpacity
                              hitSlop={8}
                              onPress={() => handleOpenEditLab(lab.id)}
                              style={styles.editIconBtn}
                            >
                              <AppIcon name="sliders" size={14} color={Colors.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.labGedung}>{lab.gedung}</Text>
                      </View>

                      <View style={styles.policyRow}>
                        <View style={styles.policyPill}>
                          <AppIcon name="map-pin" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>Radius {lab.radiusMeters}m</Text>
                        </View>
                        <View style={styles.policyPill}>
                          <AppIcon name="clock" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>
                            Toleransi {lab.gracePeriodMinutes ?? 15} mnt
                          </Text>
                        </View>
                        <View style={styles.policyPill}>
                          <AppIcon name="credit-card" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>
                            Denda Rp{(lab.lateFineAmount ?? 10000).toLocaleString('id-ID')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </AppCard>
                );
              })}
            </View>
          )}
        </View>

        {/* 3. Impor Data CSV & Mutasi Anggota */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Impor Massal (CSV) & Mutasi</Text>
          <AppCard variant="glass" style={styles.toolsCard}>
            <ToolRow
              icon="layers"
              iconBg="rgba(123, 184, 212, 0.16)"
              iconColor={Colors.accentBlue}
              title="Impor Data Laboratorium"
              subtitle={`Tambah banyak lab untuk ${selectedCourse.kode}`}
              onPress={() => openBulkModal('laboratorium')}
            />
            <ToolRow
              icon="users"
              iconBg={Colors.successSoft}
              iconColor={Colors.success}
              title="Impor Daftar Praktikan"
              subtitle={
                currentLab
                  ? `Masukkan praktikan ke ${currentLab.nama}`
                  : 'Daftarkan praktikan ke lab terpilih'
              }
              onPress={() => openBulkModal('praktikan')}
            />
            <ToolRow
              icon="user"
              iconBg={Colors.warningSoft}
              iconColor={Colors.warning}
              title="Impor Penugasan Asprak"
              subtitle={
                currentLab
                  ? `Tugaskan asprak ke ${currentLab.nama}`
                  : 'Tugaskan asprak ke lab terpilih'
              }
              onPress={() => openBulkModal('asprak')}
            />
            <ToolRow
              icon="repeat"
              iconBg={Colors.primarySoft}
              iconColor={Colors.primary}
              title="Transfer Anggota Antar Lab"
              subtitle="Pindahkan praktikan atau asprak tanpa ubah jadwal"
              onPress={() => setTransferModalVisible(true)}
              last={true}
            />
          </AppCard>
        </View>
      </View>

      {/* Bulk Insert Modal */}
      {bulkModalType && pengguna ? (
        <BulkInsertModal
          visible={Boolean(bulkModalType)}
          type={bulkModalType}
          actor={pengguna}
          courseId={selectedCourse.id}
          courseNama={selectedCourse.nama}
          targetLabId={currentLab?.id}
          targetLabNama={currentLab?.nama}
          onClose={() => setBulkModalType(null)}
          onSuccess={handleSuccess}
        />
      ) : null}

      {/* Member Transfer Modal */}
      {transferModalVisible && pengguna ? (
        <MemberTransferModal
          visible={transferModalVisible}
          actor={pengguna}
          laboratories={activeLabs}
          onClose={() => setTransferModalVisible(false)}
          onSuccess={handleSuccess}
        />
      ) : null}

      {/* Single Lab Management Modal */}
      {singleLabModalVisible && pengguna ? (
        <LabManagementModal
          visible={singleLabModalVisible}
          actor={pengguna}
          laboratories={laboratories}
          writable={true}
          onClose={() => setSingleLabModalVisible(false)}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  selectedHint: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  courseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  labsList: {
    gap: Spacing.sm,
  },
  labItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  labItemCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.glassStrong,
  },
  labCardHeader: {
    gap: 2,
  },
  labTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  labHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  labBadge: {
    backgroundColor: Colors.neutralSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  labBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
    color: Colors.textMuted,
  },
  editIconBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labGedung: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  policyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  policyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neutralSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  policyPillText: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  toolsCard: {
    padding: 0,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  toolRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toolIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTextCol: {
    flex: 1,
    gap: 1,
  },
  toolTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  toolSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
