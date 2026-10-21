import React from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { StatusSesi } from '@/types/models';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface SessionCardProps {
  praktikum: string;
  kelas: string;
  topik: string;
  tanggal: string;
  waktu: string;
  ruang: string;
  status: StatusSesi;
  meta?: string;
  metaTone?: 'default' | 'success' | 'warning' | 'danger';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SessionCard({
  praktikum,
  kelas,
  topik,
  tanggal,
  waktu,
  ruang,
  status,
  meta,
  metaTone = 'default',
  onPress,
  style,
}: SessionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.kelasContainer}>
          <Text style={styles.kelasText}>{kelas}</Text>
          <Text style={styles.praktikumText} numberOfLines={1}>
            {praktikum}
          </Text>
        </View>
        <StatusBadge status={status} />
      </View>

      <Text style={styles.topik} numberOfLines={2}>
        {topik}
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoText} numberOfLines={1}>
          {tanggal} · {waktu}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.ruangText}>{ruang}</Text>
        {meta ? (
          <Text style={[styles.metaText, styles[`meta_${metaTone}`]]}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  pressed: {
    backgroundColor: Colors.neutralSoft,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  kelasContainer: {
    flex: 1,
  },
  kelasText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  praktikumText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  topik: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  ruangText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  meta_default: {
    color: Colors.textMuted,
  },
  meta_success: {
    color: Colors.success,
  },
  meta_warning: {
    color: Colors.warning,
  },
  meta_danger: {
    color: Colors.danger,
  },
});

