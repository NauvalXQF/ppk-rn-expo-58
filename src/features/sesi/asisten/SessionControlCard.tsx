import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StatusSesi } from '@/types/models';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/AppButton';
import { InfoBanner } from '@/components/ui/InfoBanner';

export interface SessionControlCardProps {
  status: StatusSesi;
  onBukaSesi: () => void;
  onTutupSesi: () => void;
}

export function SessionControlCard({
  status,
  onBukaSesi,
  onTutupSesi,
}: SessionControlCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kendali Sesi</Text>

      {status === 'dijadwalkan' && (
        <View style={styles.actionBlock}>
          <Text style={styles.description}>
            Praktikan dapat melakukan presensi setelah sesi dibuka.
          </Text>
          <AppButton
            label="Buka Sesi"
            variant="primary"
            onPress={onBukaSesi}
          />
        </View>
      )}

      {status === 'dibuka' && (
        <View style={styles.actionBlock}>
          <Text style={styles.description}>
            Praktikan sedang dapat melakukan presensi. Tutup sesi apabila waktu kehadiran telah selesai.
          </Text>
          <AppButton
            label="Tutup Sesi"
            variant="danger"
            onPress={onTutupSesi}
          />
        </View>
      )}

      {status === 'ditutup' && (
        <InfoBanner
          tone="neutral"
          message="Sesi telah ditutup."
          description="Sesi praktikum telah berakhir dan tidak dapat dibuka kembali."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  actionBlock: {
    gap: Spacing.sm,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
});

