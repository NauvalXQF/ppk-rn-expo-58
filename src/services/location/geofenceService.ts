import { DEFAULT_LAB_LOCATIONS } from '@/services/location/mockLocation';
import type {
  GeoPoint,
  GpsAccuracyQuality,
  LabGeofenceTarget,
  LocationReading,
  VerificationResult,
} from '@/types/geoAttendance';
import type { Sesi } from '@/types/models';

export const EARTH_RADIUS_METERS = 6_371_000;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 30;
export const WEAK_GPS_ACCURACY_THRESHOLD_METERS = 50;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Memastikan koordinat geografis valid (-90..90, -180..180) dan bertipe angka finit. */
export function isValidCoordinate(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  if (!point) return false;
  const { latitude, longitude } = point;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Menghitung jarak garis lurus antar dua titik di permukaan bumi (meter)
 * menggunakan formula Haversine.
 */
export function calculateHaversineDistanceMeters(
  from: GeoPoint,
  to: GeoPoint,
): number {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    throw new Error('Koordinat GPS tidak valid untuk perhitungan jarak Haversine.');
  }

  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.asin(Math.sqrt(clampedA));
  return Number((EARTH_RADIUS_METERS * c).toFixed(2));
}

export function classifyGpsAccuracy(accuracy: number | null | undefined): {
  quality: GpsAccuracyQuality;
  isWeak: boolean;
  label: string;
} {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0) {
    return {
      quality: 'tidak_diketahui',
      isWeak: false,
      label: 'Tidak Diketahui',
    };
  }

  if (accuracy <= 15) {
    return {
      quality: 'sangat_baik',
      isWeak: false,
      label: 'Sangat Baik',
    };
  }

  if (accuracy <= WEAK_GPS_ACCURACY_THRESHOLD_METERS) {
    return {
      quality: 'baik',
      isWeak: false,
      label: 'Baik',
    };
  }

  return {
    quality: 'lemah',
    isWeak: true,
    label: 'Lemah',
  };
}

/**
 * Mengevaluasi apakah koordinat praktikan berada di dalam radius geofence laboratorium.
 */
export function evaluateGeofence(
  reading: Pick<LocationReading, 'latitude' | 'longitude' | 'accuracy'>,
  target: {
    labNama?: string;
    coordinates: GeoPoint;
    radiusMeters: number;
  },
): VerificationResult {
  if (!isValidCoordinate(reading)) {
    throw new Error('Koordinat lokasi pengguna tidak valid.');
  }
  if (!isValidCoordinate(target.coordinates)) {
    throw new Error('Koordinat laboratorium tidak valid.');
  }
  if (
    typeof target.radiusMeters !== 'number' ||
    !Number.isFinite(target.radiusMeters) ||
    target.radiusMeters <= 0
  ) {
    throw new Error('Radius geofence laboratorium harus bernilai positif.');
  }

  const distanceMeters = calculateHaversineDistanceMeters(
    { latitude: reading.latitude, longitude: reading.longitude },
    target.coordinates,
  );
  const isWithinRadius = distanceMeters <= target.radiusMeters;
  const roundedDistance = Math.round(distanceMeters);
  const roundedRadius = Math.round(target.radiusMeters);
  const accuracyInfo = classifyGpsAccuracy(reading.accuracy);
  const labLabel = target.labNama?.trim() || 'laboratorium';

  const message = isWithinRadius
    ? `Anda berada di dalam radius ${labLabel} (jarak: ${roundedDistance} meter, maksimal: ${roundedRadius} meter).`
    : `Anda berada di luar radius laboratorium (jarak: ${roundedDistance} meter, maksimal: ${roundedRadius} meter).`;

  return {
    status: isWithinRadius ? 'DALAM_RADIUS' : 'LUAR_RADIUS',
    distanceMeters,
    radiusMeters: target.radiusMeters,
    isWithinRadius,
    accuracyMeters:
      typeof reading.accuracy === 'number' && Number.isFinite(reading.accuracy)
        ? reading.accuracy
        : null,
    accuracyQuality: accuracyInfo.quality,
    isWeakAccuracy: accuracyInfo.isWeak,
    message,
  };
}

/**
 * Menentukan koordinat acuan dan radius laboratorium untuk sebuah sesi.
 * Memprioritaskan snapshot `labCoordinates` & `radiusMeters` pada sesi; jika belum
 * tersedia, mencocokkan `labId` atau `ruang` ke koordinat uji Informatika.
 */
export function resolveSessionLabTarget(sesi: Sesi | null | undefined): LabGeofenceTarget {
  const defaultLab = DEFAULT_LAB_LOCATIONS[0];

  if (!sesi) {
    return {
      labId: defaultLab.labId,
      labNama: defaultLab.labNama,
      coordinates: defaultLab.coordinates,
      radiusMeters: defaultLab.radiusMeters,
      source: 'fallback',
    };
  }

  if (isValidCoordinate(sesi.labCoordinates)) {
    const radiusMeters =
      typeof sesi.radiusMeters === 'number' &&
      Number.isFinite(sesi.radiusMeters) &&
      sesi.radiusMeters > 0
        ? sesi.radiusMeters
        : DEFAULT_GEOFENCE_RADIUS_METERS;

    return {
      labId: sesi.labId,
      labNama: sesi.labNama?.trim() || sesi.ruang.trim() || defaultLab.labNama,
      coordinates: sesi.labCoordinates,
      radiusMeters,
      source: 'session',
    };
  }

  const normalizedLabId = sesi.labId?.trim().toLowerCase() ?? '';
  const normalizedRuang = sesi.ruang.trim().toLowerCase();

  const matched = DEFAULT_LAB_LOCATIONS.find(
    (lab) =>
      lab.labId === normalizedLabId ||
      lab.aliases.some(
        (alias) => normalizedRuang === alias || normalizedRuang.includes(alias),
      ),
  );

  if (matched) {
    return {
      labId: sesi.labId ?? matched.labId,
      labNama: sesi.labNama?.trim() || sesi.ruang.trim() || matched.labNama,
      coordinates: matched.coordinates,
      radiusMeters:
        typeof sesi.radiusMeters === 'number' &&
        Number.isFinite(sesi.radiusMeters) &&
        sesi.radiusMeters > 0
          ? sesi.radiusMeters
          : matched.radiusMeters,
      source: 'fallback',
    };
  }

  return {
    labId: sesi.labId ?? defaultLab.labId,
    labNama: sesi.labNama?.trim() || sesi.ruang.trim() || defaultLab.labNama,
    coordinates: defaultLab.coordinates,
    radiusMeters:
      typeof sesi.radiusMeters === 'number' &&
      Number.isFinite(sesi.radiusMeters) &&
      sesi.radiusMeters > 0
        ? sesi.radiusMeters
        : DEFAULT_GEOFENCE_RADIUS_METERS,
    source: 'fallback',
  };
}
