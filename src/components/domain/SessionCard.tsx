import React, { useState } from 'react';
import { Animated, View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  FontFamily,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { LABEL_STATUS, type StatusSesi } from '@/types/models';

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
  index?: number;
  onPress: () => void;
}

const COURSE_GRADIENTS = [
  Gradients.courseA,
  Gradients.courseB,
  Gradients.courseC,
] as const;

function CardDecoration({ variant }: { variant: number }) {
  const mode = variant % 3;
  if (mode === 0) {
    // Asterisk
    return (
      <View pointerEvents="none" style={styles.decoWrap}>
        <View style={[styles.decoBar, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.decoBar, { transform: [{ rotate: '60deg' }] }]} />
        <View style={[styles.decoBar, { transform: [{ rotate: '120deg' }] }]} />
      </View>
    );
  }
  if (mode === 1) {
    // Star 4
    return (
      <View pointerEvents="none" style={styles.decoWrap}>
        <View style={styles.decoDiamond} />
        <View
          style={[
            styles.decoDiamond,
            { transform: [{ rotate: '45deg' }, { scale: 0.78 }] },
          ]}
        />
      </View>
    );
  }
  // Flower
  return (
    <View pointerEvents="none" style={styles.decoWrap}>
      <View style={[styles.decoPetal, { transform: [{ rotate: '0deg' }] }]} />
      <View style={[styles.decoPetal, { transform: [{ rotate: '60deg' }] }]} />
      <View style={[styles.decoPetal, { transform: [{ rotate: '120deg' }] }]} />
    </View>
  );
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
  index = 0,
  onPress,
}: SessionCardProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: toScale,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const gradientColors = COURSE_GRADIENTS[index % COURSE_GRADIENTS.length];
  const secondaryChip = meta || `${ruang} · ${waktu}`;
  const secondaryColor =
    metaTone === 'success'
      ? Colors.success
      : metaTone === 'warning'
        ? Colors.warning
        : metaTone === 'danger'
          ? Colors.danger
          : Colors.text;

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0.97, 0.9)}
        onPressOut={() => animateTo(1, 1)}
        accessibilityRole="button"
        accessibilityLabel={`${topik}, ${kelas}, ${LABEL_STATUS[status]}`}
        style={styles.outer}
      >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <CardDecoration variant={index} />

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{LABEL_STATUS[status] ?? status}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={[styles.chipText, { color: secondaryColor }]} numberOfLines={1}>
              {secondaryChip}
            </Text>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <Text style={styles.topikText} numberOfLines={1}>
            {topik}
          </Text>
          <Text style={styles.descText} numberOfLines={2}>
            {kelas} · {praktikum} · {tanggal}, {waktu} · {ruang}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  gradient: {
    minHeight: 138,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    justifyContent: 'space-between',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingRight: 52,
  },
  chip: {
    backgroundColor: Colors.glassStrong,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  bottomContent: {
    gap: 4,
    paddingRight: 64,
  },
  topikText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  descText: {
    fontSize: FontSize.xs + 1,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    opacity: 0.72,
    lineHeight: 17,
  },
  decoWrap: {
    position: 'absolute',
    right: -18,
    top: '50%',
    marginTop: -48,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.48,
  },
  decoBar: {
    position: 'absolute',
    width: 28,
    height: 92,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  decoDiamond: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  decoPetal: {
    position: 'absolute',
    width: 34,
    height: 92,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
});
