import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';

interface StatTileProps {
  icon: AppIconName;
  label: string;
  value: string;
  subInfo?: string;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ icon, label, value, subInfo, style }: StatTileProps) {
  return (
    <AppCard style={[styles.tile, style]}>
      <View style={styles.labelRow}>
        <AppIcon name={icon} size={15} color={Colors.textMuted} />
        <AppText variant="label" color={Colors.textMuted} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <View style={styles.valueRow}>
        <AppText variant="stat" color={Colors.text}>
          {value}
        </AppText>
        {subInfo ? (
          <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
            {subInfo}
          </AppText>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
});
