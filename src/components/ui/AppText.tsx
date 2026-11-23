import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'stat'
  | 'heading'
  | 'body'
  | 'label'
  | 'caption';

export type TextWeight = 'regular' | 'medium' | 'semibold';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
}

const VARIANT_STYLES: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: FontSize.display,
    lineHeight: 38,
    fontFamily: FontFamily.medium,
  },
  title: {
    fontSize: FontSize.xl,
    lineHeight: 30,
    fontFamily: FontFamily.regular,
  },
  stat: {
    fontSize: FontSize.stat,
    lineHeight: 32,
    fontFamily: FontFamily.medium,
  },
  heading: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    fontFamily: FontFamily.medium,
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
  },
  label: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontFamily: FontFamily.medium,
  },
  caption: {
    fontSize: FontSize.xs,
    lineHeight: 14,
    fontFamily: FontFamily.regular,
  },
};

export function AppText({
  variant = 'body',
  weight,
  color = Colors.text,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        VARIANT_STYLES[variant],
        weight ? { fontFamily: FontFamily[weight] } : undefined,
        { color },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
