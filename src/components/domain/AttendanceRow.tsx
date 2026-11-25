import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

export type AttendanceRowBadgeTone = 'success' | 'warning' | 'neutral' | 'info';

export interface AttendanceRowProps {
  nama: string;
  nim: string;
  waktu: string;
  catatan?: string;
  kelas?: string;
  badgeLabel?: string;
  badgeTone?: AttendanceRowBadgeTone;
  style?: StyleProp<ViewStyle>;
}

const badgeToneStyles: Record<
  AttendanceRowBadgeTone,
  { backgroundColor: string; color: string }
> = {
  success: {
    backgroundColor: Colors.successSoft,
    color: Colors.success,
  },
  warning: {
    backgroundColor: Colors.warningSoft,
    color: Colors.warning,
  },
  neutral: {
    backgroundColor: Colors.neutralSoft,
    color: Colors.textMuted,
  },
  info: {
    backgroundColor: Colors.unreadSurface,
    color: Colors.accentBlue,
  },
};

export function AttendanceRow({
  nama,
  nim,
  waktu,
  catatan,
  kelas,
  badgeLabel = 'Hadir',
  badgeTone = 'success',
  style,
}: AttendanceRowProps) {
  const subtitle = kelas ? `${nim} · ${kelas}` : nim;
  const toneStyle = badgeToneStyles[badgeTone] ?? badgeToneStyles.success;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <View style={styles.infoCol}>
          <Text style={styles.nama} numberOfLines={1}>
            {nama}
          </Text>
          <Text style={styles.nim} numberOfLines={1}>
            {subtitle} · {waktu}
          </Text>
        </View>
        <View
          style={[
            styles.badgeHadir,
            { backgroundColor: toneStyle.backgroundColor },
          ]}
        >
          <Text style={[styles.badgeText, { color: toneStyle.color }]}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      {catatan ? (
        <View style={styles.catatanBox}>
          <Text style={styles.catatanText} numberOfLines={2}>
            Catatan: {catatan}
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
    padding: Spacing.md - 2,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  nama: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  nim: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  badgeHadir: {
    backgroundColor: Colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.success,
  },
  catatanBox: {
    marginTop: 2,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  catatanText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
