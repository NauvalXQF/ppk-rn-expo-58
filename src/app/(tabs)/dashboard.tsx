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
import type { Praktikan } from '@/types/models';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export default function AslabDashboardScreen() {
  const { pengguna } = useAuth();
  const { state } = useApp();
  const labData = useLaboratoryData(true);
  const laboratories = (labData.snapshot?.laboratories ?? []) as Laboratory[];

  const [period, setPeriod] = useState<PeriodFilter>('hari');
  const [fines, setFines] = useState<FineRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchDashboardFines()
        .then((list) => {
          if (active) setFines(list);
        })
        .catch(() => {
          if (active) setFines([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const classMembers = (state.pengguna ?? [])
    .filter((u): u is Praktikan => u.peran === 'praktikan')
    .map((p) => ({ classId: p.kelasId, active: true }));

  const metrics = calculateDashboardMetrics({
    laboratories,
    sessions: state.sesi ?? [],
    schedules: state.jadwal ?? [],
    classMembers,
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
