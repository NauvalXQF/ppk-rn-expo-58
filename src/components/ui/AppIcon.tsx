import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export type AppIconName =
  | 'calendar'
  | 'map-pin'
  | 'grid'
  | 'file-text'
  | 'user'
  | 'bell'
  | 'search'
  | 'x'
  | 'chevron-left'
  | 'arrow-up-right'
  | 'book-open'
  | 'zap'
  | 'check-circle'
  | 'clock'
  | 'users'
  | 'bar-chart-2';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
}

export function AppIcon({
  name,
  size = 18,
  color = Colors.text,
}: AppIconProps) {
  return <Feather name={name} size={size} color={color} />;
}
