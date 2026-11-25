import React, { useEffect, useState } from 'react';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useAuth } from '@/contexts/AuthContext';
import { AslabDashboardView } from '@/features/aslab/AslabDashboardView';
import { useLaboratoryData } from '@/features/maps/useMapsData';
import {
  calculateDashboardMetrics,
  fetchDashboardFines,
  type FineRecord,
  type PeriodFilter,
} from '@/services/aslab/dashboardService';
import { useApp } from '@/store/app-context';
import type { Laboratory } from '@/types/laboratory';

export default function AslabDashboardScreen() {
  const { pengguna } = useAuth();
  const { state } = useApp();
  const labData = useLaboratoryData(true);
  const laboratories = (labData.snapshot?.laboratories ?? []) as Laboratory[];

  const [period, setPeriod] = useState<PeriodFilter>('hari');
  const [fines, setFines] = useState<FineRecord[]>([]);

  useEffect(() => {
    fetchDashboardFines()
      .then(setFines)
      .catch(() => setFines([]));
  }, []);

  const metrics = calculateDashboardMetrics({
    laboratories,
    sessions: state.sesi ?? [],
    schedules: state.jadwal ?? [],
    classMembers: [],
    fines,
    filter: period,
  });

  if (!pengguna) return null;

  return (
    <ScreenContainer variant="gradient" hasTabBar={true}>
      <AslabDashboardView
        actor={pengguna}
        metrics={metrics}
        period={period}
        onChangePeriod={setPeriod}
      />
    </ScreenContainer>
  );
}
