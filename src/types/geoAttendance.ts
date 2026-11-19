export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface LocationReading extends GeoPoint {
  accuracy: number | null;
  timestamp: number;
  isMocked?: boolean;
}

export type GeofenceStatus = 'DALAM_RADIUS' | 'LUAR_RADIUS';

export type FirestoreGeofenceStatus = 'in_radius' | 'bypass_qr';

export type LocationPermissionState = 'undetermined' | 'granted' | 'denied';

export type GpsAccuracyQuality =
  | 'sangat_baik'
  | 'baik'
  | 'lemah'
  | 'tidak_diketahui';

export interface LabGeofenceTarget {
  labId?: string;
  labNama: string;
  coordinates: GeoPoint;
  radiusMeters: number;
  source: 'session' | 'laboratory' | 'fallback';
}

export interface VerificationResult {
  status: GeofenceStatus;
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
  accuracyMeters: number | null;
  accuracyQuality: GpsAccuracyQuality;
  isWeakAccuracy: boolean;
  message: string;
}

export interface GeoAttendancePayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
  geofenceStatus: FirestoreGeofenceStatus;
}

export interface GeoAttendanceRecord extends GeoAttendancePayload {
  uid: string;
  sessionId: string;
  classId: string;
  status: 'hadir';
  recordedAt: string;
  catatan: string | null;
}
