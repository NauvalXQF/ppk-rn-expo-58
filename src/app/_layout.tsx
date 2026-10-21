import React from 'react';
import { Stack } from 'expo-router';
import { AppProvider } from '@/store/app-context';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <AppProvider>
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
    </AppProvider>
  );
}
