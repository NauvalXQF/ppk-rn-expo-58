import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';

const TAB_ICONS: Record<string, AppIconName> = {
  dashboard: 'bar-chart-2',
  'kelola-lab': 'layers',
  jadwal: 'calendar',
  peta: 'map-pin',
  kehadiran: 'grid',
  denda: 'credit-card',
  rekap: 'grid',
  izin: 'file-text',
  profil: 'user',
};

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'kelola-lab': 'Kelola Lab',
  jadwal: 'Jadwal',
  peta: 'Peta',
  kehadiran: 'Kehadiran',
  rekap: 'Rekap',
  izin: 'Izin',
  profil: 'Profil',
};

interface TabBarProps {
  hideIzinTab: boolean;
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  descriptors: Record<string, { options?: { title?: string; href?: string | null } }>;
  emitter: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
}

function FloatingPillTabBar({
  hideIzinTab,
  state,
  descriptors,
  emitter,
  navigateToTab,
}: TabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => {
    const opts = descriptors[route.key]?.options;
    if (opts && opts.href === null) return false;
    if (hideIzinTab && route.name === 'izin') return false;
    return route.name in TAB_ICONS;
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.pill}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={45}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === routeIndex;
          const options = descriptors[route.key]?.options;
          const iconName = TAB_ICONS[route.name] ?? 'grid';

          const onPress = () => {
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options?.title ?? route.name}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                isFocused && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
            >
              <AppIcon
                name={iconName}
                size={19}
                color={isFocused ? Colors.textOnDark : Colors.text}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {options?.title ?? TAB_LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { status, pengguna } = useAuth();

  if (status === 'memuat') {
    return null;
  }

  if (status !== 'masuk') {
    return <Redirect href="/" />;
  }

  const role = pengguna?.role;
  const isAslab = role === 'aslab';
  const isAsprak = role === 'asprak' || role === 'asisten';
  const isPraktikan = role === 'praktikan';

  return (
    <Tabs
      tabBar={(props) => <FloatingPillTabBar {...props} hideIzinTab={isPraktikan} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAslab ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="kelola-lab"
        options={{
          title: 'Kelola Lab',
          href: isAslab ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="jadwal"
        options={{
          title: isAsprak ? 'Sesi' : 'Jadwal',
        }}
      />
      <Tabs.Screen name="peta" options={{ title: 'Peta' }} />
      <Tabs.Screen
        name="kehadiran"
        options={{
          title: 'Kehadiran',
          href: isPraktikan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="denda"
        options={{
          title: 'Denda',
          href: isPraktikan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="rekap"
        options={{
          title: 'Rekap',
          href: isAsprak ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="izin"
        options={{
          title: 'Izin',
          href: isAslab ? null : undefined,
        }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 356,
    height: 66,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    ...Shadow.floating,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: 24,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabItemPressed: {
    opacity: 0.85,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.textOnDark,
  },
});
