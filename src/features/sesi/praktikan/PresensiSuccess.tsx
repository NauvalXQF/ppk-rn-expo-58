import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatWaktuPresensi } from '@/utils/date';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';

interface PresensiSuccessProps {
  waktuPresensi: string;
  catatan?: string;
  showButton?: boolean;
}

export function PresensiSuccess({
  waktuPresensi,
  catatan,
  showButton = true,
}: PresensiSuccessProps) {
  const formattedTime = formatWaktuPresensi(waktuPresensi);

  return (
    <View style={styles.container}>
      <AppCard style={styles.card}>
        <View style={styles.badgeRow}>
          <View style={styles.iconCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.title}>Presensi Berhasil</Text>
        </View>

        <Text style={styles.timeText}>Tercatat pukul {formattedTime}</Text>
        <Text style={styles.description}>
          Kehadiranmu sudah tersimpan di sistem.
        </Text>

        {catatan ? (
          <View style={styles.catatanBox}>
            <Text style={styles.catatanLabel}>Catatan:</Text>
            <Text style={styles.catatanText}>{catatan}</Text>
          </View>
        ) : null}
      </AppCard>

      {showButton ? (
        <AppButton
          label="Sudah Presensi"
          onPress={() => {}}
          disabled
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.successSoft,
    borderColor: '#B4EDCD',
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: FontSize.xs,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.success,
  },
  timeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  catatanBox: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#CDEFD9',
    gap: 2,
  },
  catatanLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  catatanText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
});
