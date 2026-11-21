import type { GeoPoint, LocationReading } from '@/types/geoAttendance';

export interface ReferenceLabLocation {
  labId: string;
  labNama: string;
  aliases: readonly string[];
  coordinates: GeoPoint;
  radiusMeters: number;
}

/**
 * Titik koordinat referensi laboratorium Informatika dari docs/sprint-3/acceptance-criteria.md.
 * Dipakai sebagai fallback bila sesi Sprint 2 belum memiliki metadata koordinat dari modul P3.
 */
export const DEFAULT_LAB_LOCATIONS: readonly ReferenceLabLocation[] = [
  {
    labId: 'lab-ai',
    labNama: 'Lab AI & Robotika',
    aliases: ['lab ai', 'lab-ai', 'lab ai & robotika', 'lab 3', 'lab-3'],
    coordinates: {
      latitude: -6.175392,
      longitude: 106.827153,
    },
    radiusMeters: 30,
  },
  {
    labId: 'lab-rpl',
    labNama: 'Lab Rekayasa Perangkat Lunak',
    aliases: ['lab rpl', 'lab-rpl', 'lab rekayasa perangkat lunak', 'lab 5', 'lab-5'],
    coordinates: {
      latitude: -6.17585,
      longitude: 106.8274,
    },
    radiusMeters: 25,
  },
  {
    labId: 'lab-jaringan',
    labNama: 'Lab Jaringan & Keamanan Siber',
    aliases: ['lab jaringan', 'lab-jaringan', 'lab jaringan & keamanan siber'],
    coordinates: {
      latitude: -6.1762,
      longitude: 106.8269,
    },
    radiusMeters: 35,
  },
] as const;

export const SIMULATED_LOCATIONS = {
  inRadiusLabAi: {
    latitude: -6.17544,
    longitude: 106.82718,
    accuracy: 8,
    timestamp: 0,
    isMocked: true,
  } satisfies LocationReading,
  outRadiusLabAi: {
    latitude: -6.1765,
    longitude: 106.828,
    accuracy: 10,
    timestamp: 0,
    isMocked: true,
  } satisfies LocationReading,
  weakSignalLabAi: {
    latitude: -6.17544,
    longitude: 106.82718,
    accuracy: 75,
    timestamp: 0,
    isMocked: true,
  } satisfies LocationReading,
};

export function createSimulatedReading(
  preset: keyof typeof SIMULATED_LOCATIONS,
): LocationReading {
  return {
    ...SIMULATED_LOCATIONS[preset],
    timestamp: Date.now(),
  };
}
