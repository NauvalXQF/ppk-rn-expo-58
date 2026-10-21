import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface InfoBannerProps {
  message: string;
  description?: string;
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
  neutral: {
    backgroundColor: Colors.neutralSoft,
    color: Colors.text,
    borderColor: Colors.border,
  },
};

export function InfoBanner({
  message,
  description,
  tone = 'info',
}: InfoBannerProps) {
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
      {description ? (
        <Text style={[styles.description, { color: config.color }]}>
          {description}
        </Text>
      ) : null}
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
  description: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    lineHeight: 18,
    opacity: 0.85,
  },
});
