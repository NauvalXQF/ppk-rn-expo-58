import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { BulkInsertModal } from '@/features/aslab/BulkInsertModal';
import { MemberTransferModal } from '@/features/aslab/MemberTransferModal';
import { LabManagementModal } from '@/features/maps/LabManagementModal';
import { useLaboratoryData } from '@/features/maps/useMapsData';
import { useAuth } from '@/contexts/AuthContext';
import type { BulkType } from '@/services/aslab/bulkCsvService';
import type { Laboratory } from '@/types/laboratory';

interface CourseItem {
  id: string;
  kode: string;
  nama: string;
}

const DEFAULT_COURSES: CourseItem[] = [
  { id: 'praktikum-ppk', kode: 'IF2104', nama: 'Praktikum Pemrograman Komputer' },
  { id: 'praktikum-bd', kode: 'IF2105', nama: 'Praktikum Basis Data' },
];

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

  const selectedCourse = DEFAULT_COURSES.find((c) => c.id === selectedCourseId) ?? DEFAULT_COURSES[0];
  const activeLabs = laboratories.filter((l: Laboratory) => l.aktif);
  const currentLab = activeLabs.find((l: Laboratory) => l.id === selectedLabId) ?? activeLabs[0];

  function openBulkModal(type: BulkType) {
    setFeedbackSuccess(null);
    setBulkModalType(type);
  }

  function handleSuccess(msg: string) {
    setFeedbackSuccess(msg);
  }

  return (
    <ScreenContainer variant="list" hasTabBar={true}>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {pengguna?.nama ? pengguna.nama.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>Manajemen Laboratorium</Text>
              <Text style={styles.roleSub}>Peran: Aslab · Pengelola Mata Kuliah</Text>
            </View>
          </View>
        </View>

        {feedbackSuccess ? (
          <InfoBanner tone="success" message={feedbackSuccess} />
        ) : null}

        {/* 1. Pemilih Mata Kuliah Tanggung Jawab */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mata Kuliah Tanggung Jawab</Text>
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

        {/* 2. Panel Aksi Cepat: 3 Bulk Insert Terpisah + Transfer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aksi Cepat & Bulk Insert</Text>
          <View style={styles.actionsGrid}>
            {/* Action 1: Bulk Laboratorium */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.actionCard}
              onPress={() => openBulkModal('laboratorium')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: 'rgba(123, 184, 212, 0.15)' }]}>
                <AppIcon name="layers" size={20} color={Colors.accentBlue} />
              </View>
              <Text style={styles.actionCardTitle}>Bulk Laboratorium</Text>
              <Text style={styles.actionCardDesc}>
                Input banyak lab sekaligus via template CSV untuk mata kuliah terpilih.
              </Text>
            </TouchableOpacity>

            {/* Action 2: Bulk Praktikan */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.actionCard}
              onPress={() => openBulkModal('praktikan')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: Colors.successSoft }]}>
                <AppIcon name="users" size={20} color={Colors.success} />
              </View>
              <Text style={styles.actionCardTitle}>Bulk Praktikan</Text>
              <Text style={styles.actionCardDesc}>
                Daftarkan mahasiswa praktikan ke lab terpilih via template CSV.
              </Text>
            </TouchableOpacity>

            {/* Action 3: Bulk Asprak */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.actionCard}
              onPress={() => openBulkModal('asprak')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: Colors.warningSoft }]}>
                <AppIcon name="user" size={20} color={Colors.warning} />
              </View>
              <Text style={styles.actionCardTitle}>Bulk Asprak</Text>
              <Text style={styles.actionCardDesc}>
                Tugaskan asisten praktikum ke lab terpilih via template CSV.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transfer Button */}
          <AppButton
            label="Pindahkan Praktikan / Asprak Antar Lab"
            variant="secondary"
            onPress={() => setTransferModalVisible(true)}
            style={styles.transferButton}
          />
        </View>

        {/* 3. Daftar Laboratorium & Pengaturan Kebijakan */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Laboratorium Aktif ({activeLabs.length})</Text>
            <AppButton
              label="+ Tambah Lab Single"
              variant="ghost"
              size="sm"
              onPress={() => setSingleLabModalVisible(true)}
            />
          </View>

          {activeLabs.length === 0 ? (
            <InfoBanner
              tone="neutral"
              message="Belum ada laboratorium terdaftar. Gunakan Bulk Laboratorium atau Tambah Lab Single untuk memulai."
            />
          ) : (
            <View style={styles.labsList}>
              {activeLabs.map((lab: Laboratory) => {
                const isCurrent = currentLab?.id === lab.id;
                return (
                  <AppCard
                    key={lab.id}
                    variant="solid"
                    style={[styles.labItemCard, isCurrent && styles.labItemCardSelected]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setSelectedLabId(lab.id)}
                    >
                      <View style={styles.labCardHeader}>
                        <View style={styles.labTitleGroup}>
                          <Text style={styles.labName}>{lab.nama}</Text>
                          <View style={styles.labBadge}>
                            <Text style={styles.labBadgeText}>{lab.kode}</Text>
                          </View>
                        </View>
                        <Text style={styles.labGedung}>{lab.gedung}</Text>
                      </View>

                      {/* Policy Badges */}
                      <View style={styles.policyRow}>
                        <View style={styles.policyPill}>
                          <AppIcon name="map-pin" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>Radius: {lab.radiusMeters}m</Text>
                        </View>
                        <View style={styles.policyPill}>
                          <AppIcon name="clock" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>
                            Toleransi: {lab.gracePeriodMinutes ?? 15} mnt
                          </Text>
                        </View>
                        <View style={styles.policyPill}>
                          <AppIcon name="credit-card" size={12} color={Colors.textMuted} />
                          <Text style={styles.policyPillText}>
                            Denda: Rp{(lab.lateFineAmount ?? 10000).toLocaleString('id-ID')}
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
      </ScrollView>

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
  screenScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  roleSub: {
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
  courseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  actionsGrid: {
    gap: Spacing.sm,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    ...Shadow.card,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionCardTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  actionCardDesc: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  transferButton: {
    minHeight: 48,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  labsList: {
    gap: Spacing.sm,
  },
  labItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  labItemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.glassStrong,
  },
  labCardHeader: {
    gap: 2,
  },
  labTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labName: {
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
});
