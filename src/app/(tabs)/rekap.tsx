import React from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '@/store/app-context';
import { isStaffUser } from '@/types/models';
import { RekapScreen } from '@/features/rekap/RekapScreen';

export default function RekapRoute() {
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  if (!isStaffUser(state.currentUser)) {
    return <Redirect href="/jadwal" />;
  }

  return <RekapScreen />;
}

