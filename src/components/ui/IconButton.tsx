import React, { useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';

interface IconButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'light' | 'dark';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  tone = 'light',
  size = 44,
  style,
}: IconButtonProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const animateScale = (toScale: number) => {
    Animated.timing(scale, {
      toValue: toScale,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateScale(0.95)}
        onPressOut={() => animateScale(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.base,
          {
            width: size,
            height: size,
            backgroundColor:
              tone === 'dark' ? Colors.primary : Colors.glassStrong,
            borderColor:
              tone === 'dark' ? Colors.primary : Colors.glassBorder,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
});
