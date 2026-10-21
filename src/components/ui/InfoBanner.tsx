import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface InfoBannerProps {
  message: string;
  description?: string;
  tone?: BannerTone;
  style?: StyleProp<ViewStyle>;
}

export function InfoBanner({
  message,
  description,
  tone = 'info',
  style,
}: InfoBannerProps) {
  return (
    <View style={[styles.banner, styles[tone], style]}>
      <Text style={[styles.title, styles[`${tone}Text`]]}>{message}</Text>
      {description ? (
        <Text style={[styles.desc, styles[`${tone}Desc`]]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  desc: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  info: {
    backgroundColor: Colors.primarySoft,
    borderColor: '#B2CCFF',
  },
  infoText: {
    color: Colors.primary,
  },
  infoDesc: {
    color: '#1546B5',
  },
  success: {
    backgroundColor: Colors.successSoft,
    borderColor: '#A6F4C5',
  },
  successText: {
    color: Colors.success,
  },
  successDesc: {
    color: '#05603A',
  },
  warning: {
    backgroundColor: Colors.warningSoft,
    borderColor: '#FEDF89',
  },
  warningText: {
    color: Colors.warning,
  },
  warningDesc: {
    color: '#93370D',
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#FECDCA',
  },
  dangerText: {
    color: Colors.danger,
  },
  dangerDesc: {
    color: '#B42318',
  },
  neutral: {
    backgroundColor: Colors.neutralSoft,
    borderColor: Colors.border,
  },
  neutralText: {
    color: Colors.text,
  },
  neutralDesc: {
    color: Colors.textMuted,
  },
});

