import type { Ref } from 'react';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';

export interface LaboratoryMapHandle {
  recenter: (point: LaboratoryCoordinates) => void;
}

export interface LaboratoryMapProps {
  ref?: Ref<LaboratoryMapHandle>;
  laboratories: readonly Laboratory[];
  activeLabIds: ReadonlySet<string>;
  selectedLabId?: string;
  userLocation?: LaboratoryCoordinates & { heading: number | null };
  isAssistant: boolean;
  focused: boolean;
  onSelect: (id: string) => void;
}

export interface LabPreviewProps {
  point: LaboratoryCoordinates;
  radius: number;
}

export interface LabPickerState {
  center: LaboratoryCoordinates | null;
  point: LaboratoryCoordinates | null;
  radius: number | null;
}

export interface LabPickerMapProps extends LabPickerState {
  onLocationPicked: (point: LaboratoryCoordinates) => void;
}
