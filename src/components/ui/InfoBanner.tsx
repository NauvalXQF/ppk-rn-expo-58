import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface InfoBannerProps {
  message: string;
  description?: string;
  tone?: BannerTone;
}

const toneStyles: Record<
  BannerTone,
  { backgroundColor: string; color: string }
> = {
  info: {
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
  },
  success: {
    backgroundColor: Colors.successSoft,
    color: Colors.success,
  },
  warning: {
    backgroundColor: Colors.warningSoft,
    color: Colors.warning,
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
    color: Colors.danger,
  },
  neutral: {
    backgroundColor: Colors.neutralSoft,
    color: Colors.text,
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
        { backgroundColor: config.backgroundColor },
      ]}
    >
      <Text style={[styles.text, { color: config.color }]}>{message}</Text>
      {description ? (
        <Text style={[styles.description, { color: Colors.text }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.md - 2,
    borderRadius: Radius.md,
  },
  text: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    fontFamily: FontFamily.medium,
  },
  description: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontFamily: FontFamily.regular,
    opacity: 0.8,
  },
});
