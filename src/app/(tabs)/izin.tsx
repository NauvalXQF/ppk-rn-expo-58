import { useAuth } from '@/contexts/AuthContext';
import {
  PermissionsScreen,
  mapPenggunaToPermissionActor,
  mapSesiToLeaveOptions,
} from '@/features/permissions';
import { getActivePermissionRepository } from '@/services/firestorePermissionRepository';
import { useApp } from '@/store/app-context';
import { selectSesiUntukPengguna } from '@/store/selectors';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function IzinRoute() {
  const { sesiId } = useLocalSearchParams<{ sesiId?: string }>();
  const { status, pengguna } = useAuth();
  const { state, isRemote } = useApp();

  const syncedUser =
    state.currentUser && (!pengguna || state.currentUser.id === pengguna.uid)
      ? state.currentUser
      : null;

  const actor = useMemo(
    () => (syncedUser ? mapPenggunaToPermissionActor(syncedUser) : null),
    [syncedUser],
  );

  const sessions = useMemo(
    () => mapSesiToLeaveOptions(selectSesiUntukPengguna(state), state.kelas),
    [state],
  );

  const repository = useMemo(() => getActivePermissionRepository(), []);

  if (status === 'memuat') {
    return null;
  }

  if (status !== 'masuk' || !pengguna) {
    return <Redirect href="/" />;
  }

  if (
    pengguna.role !== 'praktikan' &&
    pengguna.role !== 'asprak' &&
    pengguna.role !== 'asisten' &&
    pengguna.role !== 'aslab'
  ) {
    return <Redirect href="/jadwal" />;
  }

  if (isRemote && !syncedUser) {
    return null;
  }

  return (
    <PermissionsScreen
      actor={actor}
      sessions={sessions}
      repository={repository}
      initialSessionId={typeof sesiId === 'string' ? sesiId : undefined}
      existingLeaves={state.leaveRequests}
      live={isRemote ? { requests: state.leaveRequests ?? [], loading: state.leaveRequests === undefined } : undefined}
    />
  );
}
