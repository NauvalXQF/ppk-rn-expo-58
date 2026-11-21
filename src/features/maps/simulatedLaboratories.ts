import { DEFAULT_LAB_RADIUS } from '@/services/maps/laboratories';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';

export const SIMULATED_CAMPUS_CENTER: LaboratoryCoordinates = {
  latitude: -7.052,
  longitude: 110.44,
};

// Fixtures for map development only. These never pass through the Firestore write service.
export const simulatedLaboratories: readonly Laboratory[] = [
  { id: 'LAB-SIM-01', nama: 'Laboratorium Simulasi A', latitude: -7.052, longitude: 110.44 },
  { id: 'LAB-SIM-02', nama: 'Laboratorium Simulasi B', latitude: -7.0523, longitude: 110.4404 },
  { id: 'LAB-SIM-03', nama: 'Laboratorium Simulasi C', latitude: -7.0517, longitude: 110.4407 },
].map((point) => ({
  ...point,
  kode: point.id,
  gedung: '',
  kapasitas: 0,
  radiusMeters: DEFAULT_LAB_RADIUS,
  aktif: true,
}));
