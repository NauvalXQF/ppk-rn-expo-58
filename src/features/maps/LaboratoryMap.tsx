import type { Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';

export interface LaboratoryMapHandle {
  recenter: (point: LaboratoryCoordinates) => void;
}

export interface LaboratoryMapProps {
  ref?: Ref<LaboratoryMapHandle>;
  laboratories: readonly Laboratory[];
  activeLabIds: ReadonlySet<string>;
  userLocation?: LaboratoryCoordinates & { heading: number | null };
  isAssistant: boolean;
  allowSimulation: boolean;
  onSelect: (id: string) => void;
}

export interface LabPreviewProps {
  point: LaboratoryCoordinates;
  radius: number;
}

export default function LaboratoryMap(_props: LaboratoryMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.message}>Peta interaktif tersedia di aplikasi Android dan iOS.</Text>
    </View>
  );
}

export function LabPreview(_props: LabPreviewProps) {
  return null;
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  message: { color: Colors.textMuted, textAlign: 'center' },
});
