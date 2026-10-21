import React from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '@/store/app-context';
import { KehadiranScreen } from '@/features/kehadiran/KehadiranScreen';

export default function KehadiranRoute() {
  const { state } = useApp();

  if (state.currentUser?.peran === 'asisten') {
    return <Redirect href="/jadwal" />;
  }

  return <KehadiranScreen />;
}
