import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '@/store/app-context';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { EmptyState } from '@/components/ui/EmptyState';

export default function RekapRoute() {
  const { state } = useApp();

  if (state.currentUser?.peran === 'praktikan') {
    return <Redirect href="/jadwal" />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Rekap Kehadiran</Text>
        <Text style={styles.subtitle}>Fitur alur asisten (D3)</Text>
      </View>

      <EmptyState
        title="Rekap Kehadiran Asisten"
        description="Fitur rekap kehadiran dikelola oleh Dev 3 (Asisten)."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
