import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/store/app-context';
import { SessionDetailScreen } from '@/features/sesi/SessionDetailScreen';

export default function SessionDetailRoute() {
  const { sesiId } = useLocalSearchParams<{ sesiId: string }>();
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  return <SessionDetailScreen sesiId={sesiId} />;
}
