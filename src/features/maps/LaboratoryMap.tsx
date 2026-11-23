import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { LaboratoryMapProps, LabPickerMapProps, LabPreviewProps } from './mapTypes';

export default function LaboratoryMap(_props: LaboratoryMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.message}>Peta interaktif tidak tersedia di platform ini.</Text>
    </View>
  );
}

export function LabPreview(_props: LabPreviewProps) {
  return null;
}

export function LabPickerMap(_props: LabPickerMapProps) {
  return <View style={styles.fallback}><Text style={styles.message}>Peta pemilihan lokasi tidak tersedia.</Text></View>;
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  message: { color: Colors.textMuted, textAlign: 'center' },
});
