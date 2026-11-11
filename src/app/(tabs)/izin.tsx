import React, { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '@/store/app-context';
import {
  PermissionsScreen,
  mapPenggunaToPermissionActor,
  mapSesiToLeaveOptions,
} from '@/features/permissions';

export default function IzinRoute() {
  const { state } = useApp();

  const actor = useMemo(
    () => mapPenggunaToPermissionActor(state.currentUser),
    [state.currentUser],
  );

  const sessions = useMemo(
    () => mapSesiToLeaveOptions(state.sesi, state.kelas),
    [state.kelas, state.sesi],
  );

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  return <PermissionsScreen actor={actor} sessions={sessions} />;
}

