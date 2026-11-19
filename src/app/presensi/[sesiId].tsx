import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { GeoAttendanceScreen } from '@/features/presensi/GeoAttendanceScreen';
import { useApp } from '@/store/app-context';

export default function PresensiRoute() {
  const { sesiId } = useLocalSearchParams<{ sesiId: string }>();
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  return <GeoAttendanceScreen sesiId={sesiId ?? ''} />;
}
