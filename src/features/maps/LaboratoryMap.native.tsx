import { Component, Suspense, lazy, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { LaboratoryMapProps, LabPickerMapProps, LabPreviewProps } from './mapTypes';

const NativeMap = lazy(() => import('./LaboratoryMapRenderer.native'));
const NativePreview = lazy(() => import('./LaboratoryMapRenderer.native')
  .then(({ LabPreview }) => ({ default: LabPreview })));
const NativePicker = lazy(() => import('./LaboratoryMapRenderer.native')
  .then(({ LabPickerMap }) => ({ default: LabPickerMap })));

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Text accessibilityRole="alert" style={styles.error}>
        Peta native gagal dimuat. Gunakan Expo Go SDK 58 atau development build yang menyertakan WebView.
      </Text>
    );
  }
}

export default function LaboratoryMap(props: LaboratoryMapProps) {
  return (
    <View style={styles.map}>
      <MapErrorBoundary>
        <Suspense fallback={<ActivityIndicator accessibilityLabel="Memuat peta" />}>
          <NativeMap {...props} />
        </Suspense>
      </MapErrorBoundary>
    </View>
  );
}

export function LabPreview(props: LabPreviewProps) {
  return (
    <MapErrorBoundary>
      <Suspense fallback={<ActivityIndicator accessibilityLabel="Memuat pratinjau peta" />}>
        <NativePreview {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}

export function LabPickerMap(props: LabPickerMapProps) {
  return (
    <View style={styles.map}>
      <MapErrorBoundary>
        <Suspense fallback={<ActivityIndicator accessibilityLabel="Memuat peta pemilihan lokasi" />}>
          <NativePicker {...props} />
        </Suspense>
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, justifyContent: 'center' },
  error: { color: Colors.danger, padding: Spacing.md, textAlign: 'center' },
});
