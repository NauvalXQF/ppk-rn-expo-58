import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppCard } from '@/components/ui/AppCard';
import { Radius, Spacing } from '@/constants/theme';

function usePulseAnimation() {
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = usePulseAnimation();

  return (
    <AppCard variant="glass" style={[styles.card, style]}>
      <View style={styles.rowBetween}>
        <Animated.View style={[styles.bar, styles.titleBar, { opacity }]} />
        <Animated.View style={[styles.bar, styles.pillBar, { opacity }]} />
      </View>
      <Animated.View style={[styles.bar, styles.progressBar, { opacity }]} />
      <View style={styles.rowBetween}>
        <Animated.View style={[styles.bar, styles.subBarLeft, { opacity }]} />
        <Animated.View style={[styles.bar, styles.subBarRight, { opacity }]} />
      </View>
    </AppCard>
  );
}

export function SkeletonTile({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = usePulseAnimation();

  return (
    <AppCard variant="glass" style={[styles.tile, style]}>
      <View style={styles.tileTopRow}>
        <Animated.View style={[styles.circle, { opacity }]} />
        <Animated.View style={[styles.bar, styles.tileLabel, { opacity }]} />
      </View>
      <View style={styles.rowBetween}>
        <Animated.View style={[styles.bar, styles.tileStat, { opacity }]} />
        <Animated.View style={[styles.bar, styles.tileBadge, { opacity }]} />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md + 2,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm + 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  bar: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: Radius.pill,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  titleBar: {
    height: 14,
    width: '52%',
  },
  pillBar: {
    height: 18,
    width: 68,
  },
  progressBar: {
    height: 9,
    width: '100%',
  },
  subBarLeft: {
    height: 12,
    width: '34%',
  },
  subBarRight: {
    height: 12,
    width: '28%',
  },
  tileLabel: {
    height: 12,
    width: '55%',
  },
  tileStat: {
    height: 22,
    width: 44,
  },
  tileBadge: {
    height: 16,
    width: 52,
  },
});
