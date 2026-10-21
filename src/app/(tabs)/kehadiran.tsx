import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '@/store/app-context';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';

export default function KehadiranRoute() {
  const { state } = useApp();

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  if (state.currentUser.peran === 'asisten') {
    return <Redirect href="/jadwal" />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Kehadiran Saya</Text>
      </View>
      <EmptyState
        title="Riwayat Kehadiran"
        description="Fitur riwayat kehadiran praktikan."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
});

