import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const { status, pengguna } = useAuth();

  // Tunggu pemulihan sesi sebelum memutuskan redirect.
  if (status === 'memuat') {
    return null;
  }

  if (status !== 'masuk') {
    return <Redirect href="/" />;
  }

  const isAsisten = pengguna?.role === 'asisten';

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
      <Tabs.Screen name="izin" options={{ title: 'Izin' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
