import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { AppText } from '@/components/ui/AppText';

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface DotHeatmapProps {
  /** Number of filled dots out of 35 (7 cols × 5 rows) */
  filledCount: number;
}

export function DotHeatmap({ filledCount }: DotHeatmapProps) {
  const rows = 5;
  const cols = 7;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {Array.from({ length: cols }).map((_, colIdx) => (
          <View key={colIdx} style={styles.column}>
            {Array.from({ length: rows }).map((__, rowIdx) => {
              const cellIndex = colIdx * rows + rowIdx;
              const filled = cellIndex < filledCount;
              return (
                <View
                  key={rowIdx}
                  style={[
                    styles.dot,
                    filled ? styles.dotFilled : styles.dotEmpty,
                  ]}
                />
              );
            })}
            <AppText variant="caption" color={Colors.textMuted} style={styles.dayLabel}>
              {DAYS[colIdx]}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <AppText variant="caption" color={Colors.textMuted}>
          5 minggu terakhir
        </AppText>
        <View style={styles.legendKeys}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotEmpty]} />
            <AppText variant="caption" color={Colors.textMuted}>
              0 sesi
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotFilled]} />
            <AppText variant="caption" color={Colors.textMuted}>
              Hadir
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  column: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
  },
  dotFilled: {
    backgroundColor: Colors.accentBlue,
  },
  dotEmpty: {
    backgroundColor: Colors.glassEmptyDot,
  },
  dayLabel: {
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendKeys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
});
