import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export interface AttendanceRowProps {
  nama: string;
  nim: string;
  waktu: string; // sudah diformat, mis. "10.04"
  catatan?: string;
  kelas?: string;
  style?: StyleProp<ViewStyle>;
}

export function AttendanceRow({
  nama,
  nim,
  waktu,
  catatan,
  kelas,
  style,
}: AttendanceRowProps) {
  const subtitle = kelas ? `${nim} · ${kelas}` : nim;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <Text style={styles.nama} numberOfLines={1}>
          {nama}
        </Text>
        <Text style={styles.waktu}>{waktu}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.nim} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.badgeHadir}>
          <Text style={styles.badgeText}>Hadir</Text>
        </View>
      </View>

      {catatan ? (
        <View style={styles.catatanBox}>
          <Text style={styles.catatanLabel}>Catatan:</Text>
          <Text style={styles.catatanText} numberOfLines={2}>
            {catatan}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nama: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  waktu: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nim: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  badgeHadir: {
    backgroundColor: Colors.successSoft,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  catatanBox: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  catatanLabel: {
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 2,
  },
  catatanText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontStyle: 'italic',
  },
});

