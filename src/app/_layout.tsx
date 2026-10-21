import React from 'react';
import { Stack } from 'expo-router';
import { AppProvider } from '@/store/app-context';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="sesi/[sesiId]"
          options={{ headerShown: true, title: 'Detail Sesi' }}
        />
      </Stack>
    </AppProvider>
  );
}
