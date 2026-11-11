import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AppProvider, useApp } from '@/store/app-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { kePenggunaAplikasi } from '@/services/authService';
import { Colors } from '@/constants/theme';

/**
 * Menjembatani profil Firebase (AuthContext) ke state aplikasi Sprint 1,
 * sehingga layar jadwal, kehadiran, dan rekap tetap membaca `state.currentUser`
 * tanpa perlu diubah oleh modul lain.
 */
function SinkronisasiProfil() {
  const { pengguna } = useAuth();
  const { dispatch } = useApp();

  useEffect(() => {
    if (pengguna) {
      dispatch({ type: 'SET_PENGGUNA', pengguna: kePenggunaAplikasi(pengguna) });
    } else {
      dispatch({ type: 'KELUAR' });
    }
  }, [pengguna, dispatch]);

  return null;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <AuthProvider>
        <SinkronisasiProfil />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="sesi/[sesiId]"
            options={{
              headerShown: true,
              title: 'Detail Sesi',
              headerTintColor: Colors.primary,
              headerStyle: { backgroundColor: Colors.surface },
            }}
          />
        </Stack>
      </AuthProvider>
    </AppProvider>
  );
}
