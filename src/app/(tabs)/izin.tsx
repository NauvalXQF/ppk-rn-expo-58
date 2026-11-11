import React, { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/store/app-context';
import { getActivePermissionRepository } from '@/services/firestorePermissionRepository';
import {
  PermissionsScreen,
  mapProfilToPermissionActor,
  mapSesiToLeaveOptions,
} from '@/features/permissions';

export default function IzinRoute() {
  const { status, pengguna } = useAuth();
  const { state } = useApp();

  const activeClassId =
    state.currentUser?.peran === 'praktikan'
      ? state.currentUser.kelasId
      : undefined;

  const actor = useMemo(
    () => mapProfilToPermissionActor(pengguna, activeClassId),
    [activeClassId, pengguna],
  );

  const sessions = useMemo(
    () => mapSesiToLeaveOptions(state.sesi, state.kelas),
    [state.kelas, state.sesi],
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
