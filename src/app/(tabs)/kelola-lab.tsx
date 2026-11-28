import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { BulkInsertModal } from '@/features/aslab/BulkInsertModal';
import { ManageAsprakModal } from '@/features/aslab/ManageAsprakModal';
import { MemberTransferModal } from '@/features/aslab/MemberTransferModal';
import { LabManagementModal } from '@/features/maps/LabManagementModal';
import { useLaboratoryData } from '@/features/maps/useMapsData';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import type { BulkType } from '@/services/aslab/bulkCsvService';
import { getFirebaseDb } from '@/config/firebase';
import type { Laboratory } from '@/types/laboratory';
import { Redirect } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
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

  const [remoteCourses, setRemoteCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(DEFAULT_COURSES[0].id);

  useEffect(() => {
    let active = true;
    const db = getFirebaseDb();
    getDocs(collection(db, 'courses'))
      .then((snap) => {
        if (!active || snap.empty) return;
        const loaded = snap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              kode: String(data.kode ?? d.id),
              nama: String(data.nama ?? d.id),
            };
          })
          .filter((c) => Boolean(c.nama));
        if (loaded.length > 0) {
          setRemoteCourses(loaded);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const managedIds = pengguna?.managedCourseIds;
  const availableCourses = useMemo(() => {
    const base = remoteCourses.length > 0 ? remoteCourses : DEFAULT_COURSES;
    if (managedIds && managedIds.length > 0) {
      const allowed = new Set(managedIds);
      const filtered = base.filter((c) => allowed.has(c.id));
      if (filtered.length > 0) return filtered;
    }
    return base;
  }, [remoteCourses, managedIds]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [bulkModalType, setBulkModalType] = useState<BulkType | null>(null);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [manageAsprakVisible, setManageAsprakVisible] = useState(false);
  const [singleLabModalVisible, setSingleLabModalVisible] = useState(false);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  if (pengguna && pengguna.role !== 'aslab') {
    return <Redirect href="/jadwal" />;
  }

  const selectedCourse =
    availableCourses.find((c) => c.id === selectedCourseId) ?? availableCourses[0];
  const activeLabs = laboratories.filter(
    (l: Laboratory) => l.aktif && (!l.courseId || l.courseId === selectedCourse.id),
  );
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
    setEditingLabId(null);
    setSingleLabModalVisible(true);
  }

  function handleOpenEditLab(labId: string) {
    setSelectedLabId(labId);
    setEditingLabId(labId);
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
              Pengaturan lab, CSV & mutasi
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <AppButton
              label="+ Tambah"
              variant="primary"
              size="sm"
              onPress={handleOpenAddLab}
            />
          </View>
        </View>

        {feedbackSuccess ? (
          <InfoBanner tone="success" message={feedbackSuccess} />
        ) : null}

        {/* 1. Pemilih Mata Kuliah */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mata Kuliah</Text>
          <View style={styles.courseChipRow}>
            {availableCourses.map((course) => (
              <FilterChip
                key={course.id}
                label={`${course.kode} · ${course.nama}`}
                active={selectedCourse.id === course.id}
                onPress={() => setSelectedCourseId(course.id)}
              />
            ))}
          </View>
        </View>

        {/* 2. Daftar Laboratorium Aktif */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Laboratorium Aktif ({activeLabs.length})
          </Text>

          {labData.snapshot === undefined && !labData.error ? (
            <View style={styles.labsList}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : activeLabs.length === 0 ? (
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
                          {isCurrent ? (
                            <View style={styles.selectedPill}>
                              <Text style={styles.selectedPillText}>Dipilih</Text>
                            </View>
                          ) : null}
                          <TouchableOpacity
                            hitSlop={8}
                            onPress={() => handleOpenEditLab(lab.id)}
                            style={styles.editIconBtn}
                          >
                            <AppIcon name="sliders" size={14} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.kvContainer}>
                        <View style={styles.kvRow}>
                          <Text style={styles.kvKey}>Lokasi</Text>
                          <Text style={styles.kvVal}>{lab.gedung || 'Belum diatur'}</Text>
                        </View>
                        <View style={styles.kvRow}>
                          <Text style={styles.kvKey}>Radius Geofence</Text>
                          <Text style={styles.kvVal}>{lab.radiusMeters} meter</Text>
                        </View>
                        <View style={[styles.kvRow, styles.kvRowLast]}>
                          <Text style={styles.kvKey}>Toleransi & Denda</Text>
                          <Text style={styles.kvVal}>
                            {lab.gracePeriodMinutes ?? 15} mnt · Rp
                            {(lab.lateFineAmount ?? 10000).toLocaleString('id-ID')}
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
              iconBg={Colors.neutralSoft}
              iconColor={Colors.text}
              title="Impor Data Laboratorium"
              subtitle={`Tambah banyak lab untuk ${selectedCourse.kode}`}
              onPress={() => openBulkModal('laboratorium')}
            />
            <ToolRow
              icon="users"
              iconBg={Colors.neutralSoft}
              iconColor={Colors.text}
              title="Impor Daftar Praktikan"
              subtitle={
                currentLab
                  ? `Target: ${currentLab.nama}`
                  : 'Daftarkan praktikan ke lab terpilih'
              }
              onPress={() => openBulkModal('praktikan')}
            />
            <ToolRow
              icon="user"
              iconBg={Colors.neutralSoft}
              iconColor={Colors.text}
              title="Kelola Asprak Lab (Satuan)"
              subtitle={
                currentLab
                  ? `Tambah/copot Asprak di ${currentLab.nama}`
                  : 'Pilih laboratorium terlebih dahulu'
              }
              onPress={() => {
                if (!currentLab) {
                  setFeedbackSuccess(null);
                  return;
                }
                setManageAsprakVisible(true);
              }}
            />
            <ToolRow
              icon="user"
              iconBg={Colors.neutralSoft}
              iconColor={Colors.text}
              title="Impor Penugasan Asprak"
              subtitle={
                currentLab
                  ? `Target: ${currentLab.nama}`
                  : 'Tugaskan asprak ke lab terpilih'
              }
              onPress={() => openBulkModal('asprak')}
            />
            <ToolRow
              icon="repeat"
              iconBg={Colors.neutralSoft}
              iconColor={Colors.text}
              title="Transfer Anggota Antar Lab"
              subtitle="Pindahkan tanpa ubah jadwal"
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

      {/* Manage Asprak Modal */}
      {manageAsprakVisible && pengguna && currentLab ? (
        <ManageAsprakModal
          visible={manageAsprakVisible}
          actor={pengguna}
          labId={currentLab.id}
          labNama={currentLab.nama}
          courseId={selectedCourse.id}
          onClose={() => setManageAsprakVisible(false)}
          onSuccess={handleSuccess}
        />
      ) : null}

      {/* Single Lab Management Modal */}
      {singleLabModalVisible && pengguna ? (
        <LabManagementModal
          visible={singleLabModalVisible}
          actor={pengguna}
          laboratories={laboratories}
          initialLabId={editingLabId}
          courseId={selectedCourse.id}
          courseNama={selectedCourse.nama}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  labName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  editIconBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPill: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  selectedPillText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  kvContainer: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  kvRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  kvKey: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  kvVal: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
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
