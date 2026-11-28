import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing } from '@/constants/theme';

interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  variant?: 'gradient' | 'list' | 'plain';
  hasTabBar?: boolean;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scrollable = true,
  variant = 'gradient',
  hasTabBar = true,
  contentStyle,
}: ScreenContainerProps) {
  const bottomPad = hasTabBar ? 104 : Spacing.lg;

  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomPad },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.innerContainer}>{children}</View>
    </ScrollView>
  ) : (
    <View
      style={[
        styles.staticContent,
        { paddingBottom: bottomPad },
        styles.innerContainer,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={Gradients.screen}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.flex}
      >
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            {inner}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.flex,
        {
          backgroundColor:
            variant === 'list' ? Colors.listBackground : Colors.background,
        },
      ]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md,
    alignSelf: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 800,
    gap: 12,
  },
});
