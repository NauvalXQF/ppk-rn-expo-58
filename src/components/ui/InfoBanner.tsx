import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type BannerTone = 'info' | 'success' | 'warning' | 'danger';

interface InfoBannerProps {
  message: string;
  tone?: BannerTone;
}

const toneStyles: Record<
  BannerTone,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  info: {
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    borderColor: '#D1E0FF',
  },
  success: {
    backgroundColor: Colors.successSoft,
    color: Colors.success,
    borderColor: '#B4EDCD',
  },
  warning: {
    backgroundColor: Colors.warningSoft,
    color: Colors.warning,
    borderColor: '#FEDF89',
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
    color: Colors.danger,
    borderColor: '#FDA29B',
  },
};

export function InfoBanner({ message, tone = 'info' }: InfoBannerProps) {
  const config = toneStyles[tone] || toneStyles.info;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <Text style={[styles.text, { color: config.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  text: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '500',
  },
});
