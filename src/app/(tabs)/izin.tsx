import React, { useMemo } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/store/app-context';
import { getActivePermissionRepository } from '@/services/firestorePermissionRepository';
import { selectSesiUntukPengguna } from '@/store/selectors';
import {
  PermissionsScreen,
  mapPenggunaToPermissionActor,
  mapSesiToLeaveOptions,
} from '@/features/permissions';

export default function IzinRoute() {
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

  if (pengguna.role === 'aslab' || syncedUser?.peran === 'aslab') {
    return <Redirect href={'/dashboard' as Href} />;
  }

  if (
    pengguna.role !== 'praktikan' &&
    pengguna.role !== 'asprak' &&
    pengguna.role !== 'asisten'
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
    />
  );
}
