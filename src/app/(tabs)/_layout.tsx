import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useApp } from '@/store/app-context';
import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  const isAsisten = state.currentUser.peran === 'asisten';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen name="jadwal" options={{ title: 'Jadwal' }} />
      <Tabs.Screen
        name="kehadiran"
        options={{
          title: 'Kehadiran',
          href: isAsisten ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="rekap"
        options={{
          title: 'Rekap',
          href: isAsisten ? undefined : null,
        }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
