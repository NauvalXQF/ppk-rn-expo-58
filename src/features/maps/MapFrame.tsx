import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { TILE_ATTRIBUTION_URL, type MapState } from './mapProtocol';

export type MapStatus = 'loading' | 'ready' | 'tiles' | 'failed';

export function MapAttribution() {
  return (
    <View style={styles.attribution}>
      <Text
        accessibilityRole="link"
        onPress={() => { void Linking.openURL(TILE_ATTRIBUTION_URL).catch(() => {}); }}
        style={styles.attributionLink}
      >
        © OpenStreetMap contributors
      </Text>
    </View>
  );
}

export function MapFrame({ children, labs, onSelect, onRetry, status, preview }: {
  children: ReactNode;
  labs?: MapState['labs'];
  onSelect?: (id: string) => void;
  onRetry?: () => void;
  status: MapStatus;
  preview: boolean;
}) {
  return (
    <View style={preview ? styles.preview : styles.frame}>
      {preview ? <MapAttribution /> : null}
      {status === 'tiles' || status === 'failed' ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.noticeText}>
            {status === 'tiles' ? 'Peta dasar belum tersedia.' : 'Peta gagal dimuat.'}
          </Text>
          {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
            <Text style={styles.action}>Coba lagi</Text>
          </Pressable> : null}
        </View>
      ) : null}
      <View style={styles.frame}>
        {children}
        {status === 'loading' ? (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator accessibilityLabel="Memuat peta" color={Colors.primary} />
          </View>
        ) : null}
        {status === 'failed' && labs?.length && onSelect ? (
          <ScrollView style={styles.fallback}>
            {labs.map((lab) => (
              <Pressable key={lab.id} accessibilityRole="button" onPress={() => onSelect(lab.id)} style={styles.retry}>
                <Text style={styles.action}>{lab.nama}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: Colors.background },
  preview: { height: 180, overflow: 'hidden' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  fallback: { ...StyleSheet.absoluteFill, backgroundColor: Colors.surface },
  attribution: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  attributionLink: { alignSelf: 'flex-start', color: Colors.primary, fontSize: FontSize.xs, textDecorationLine: 'underline' },
  notice: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, backgroundColor: Colors.surface },
  noticeText: { flex: 1, color: Colors.text, fontSize: FontSize.sm },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  action: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
});
