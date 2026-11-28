import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard, SkeletonTile } from '@/components/ui/SkeletonCard';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AslabDashboardView } from '@/features/aslab/AslabDashboardView';
import { useLaboratoryData } from '@/features/maps/useMapsData';
import {
  calculateDashboardMetrics,
  subscribeDashboardFines,
  type FineRecord,
  type PeriodFilter,
} from '@/services/aslab/dashboardService';
import { useApp } from '@/store/app-context';
import type { Laboratory } from '@/types/laboratory';
import type { Praktikan } from '@/types/models';

export default function AslabDashboardScreen() {
  const { pengguna } = useAuth();
  const { state } = useApp();
  const labData = useLaboratoryData(true);
  const laboratories = (labData.snapshot?.laboratories ?? []) as Laboratory[];

  const [period, setPeriod] = useState<PeriodFilter>('hari');
  const [fines, setFines] = useState<FineRecord[]>([]);

  const isAslab = pengguna?.role === 'aslab';

  useEffect(() => {
    if (!isAslab) return;
    return subscribeDashboardFines(setFines, () => setFines([]));
  }, [isAslab]);

  if (!pengguna) return null;
  if (!isAslab) {
    return <Redirect href="/jadwal" />;
  }

  const managedCourseIds =
    pengguna.managedCourseIds && pengguna.managedCourseIds.length > 0
      ? new Set(pengguna.managedCourseIds)
      : null;

  const scopedLaboratories = managedCourseIds
    ? laboratories.filter((l) => !l.courseId || managedCourseIds.has(l.courseId))
    : laboratories;
  const scopedLabIds = new Set(scopedLaboratories.map((l) => l.id));

  const scopedSessions = managedCourseIds
    ? (state.sesi ?? []).filter((s) => scopedLabIds.has(s.labId || s.kelasId))
    : (state.sesi ?? []);
  const scopedSchedules = managedCourseIds
    ? (state.jadwal ?? []).filter((j) => scopedLabIds.has(j.labId || j.kelasId))
    : (state.jadwal ?? []);
  const scopedFines = managedCourseIds
    ? fines.filter((f) => scopedLabIds.has(f.labId))
    : fines;

  const classMembers = (state.pengguna ?? [])
    .filter((u): u is Praktikan => u.peran === 'praktikan')
    .flatMap((p) => {
      const ids = p.kelasIds && p.kelasIds.length > 0 ? p.kelasIds : [p.kelasId];
      return ids
        .filter((id) => !managedCourseIds || scopedLabIds.has(id))
        .map((classId) => ({ classId, active: true }));
    });

  const metrics = calculateDashboardMetrics({
    laboratories: scopedLaboratories,
    sessions: scopedSessions,
    schedules: scopedSchedules,
    classMembers,
    fines: scopedFines,
    filter: period,
  });

  const isLoading = labData.snapshot === undefined && !labData.error;

  return (
    <ScreenContainer variant="gradient" hasTabBar={true}>
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonGrid}>
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </View>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <AslabDashboardView
          actor={pengguna}
          metrics={metrics}
          period={period}
          onChangePeriod={setPeriod}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    gap: Spacing.md,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
