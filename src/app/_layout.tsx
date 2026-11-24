import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from '@expo-google-fonts/outfit';
import { AppProvider, useApp } from '@/store/app-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/hooks/useNotifications';
import { kePenggunaAplikasi } from '@/services/authService';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProvider>
      <AuthProvider>
        <NotificationProvider>
          <SinkronisasiProfil />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sesi/[sesiId]" />
            <Stack.Screen name="presensi/[sesiId]" />
          </Stack>
        </NotificationProvider>
      </AuthProvider>
    </AppProvider>
  );
}
