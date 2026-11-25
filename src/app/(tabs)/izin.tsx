import React, { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/store/app-context';
import { getActivePermissionRepository } from '@/services/firestorePermissionRepository';
import {
  getPraktikanClassIds,
  selectSesiUntukPengguna,
} from '@/store/selectors';
import {
  PermissionsScreen,
  mapPenggunaToPermissionActor,
  mapProfilToPermissionActor,
  mapSesiToLeaveOptions,
} from '@/features/permissions';

export default function IzinRoute() {
  const { status, pengguna } = useAuth();
  const { state } = useApp();

  const activeClassIds =
    state.currentUser?.peran === 'praktikan'
      ? getPraktikanClassIds(state.currentUser)
      : undefined;

  const actor = useMemo(
    () =>
      state.currentUser
        ? mapPenggunaToPermissionActor(state.currentUser)
        : mapProfilToPermissionActor(pengguna, activeClassIds),
    [activeClassIds, pengguna, state.currentUser],
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

  return (
    <PermissionsScreen
      actor={actor}
      sessions={sessions}
      repository={repository}
    />
  );
}
