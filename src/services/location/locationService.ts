import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

import type {
  LocationPermissionState,
  LocationReading,
} from '@/types/geoAttendance';

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'GPS_DISABLED'
  | 'POSITION_UNAVAILABLE';

export class LocationServiceError extends Error {
  readonly code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = 'LocationServiceError';
    this.code = code;
  }
}

function mapPermissionStatus(
  status: Location.PermissionStatus,
): LocationPermissionState {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

function toLocationReading(position: Location.LocationObject): LocationReading {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    timestamp: position.timestamp,
    isMocked: position.mocked,
  };
}

function getWebGeolocation(): Geolocation | null {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'geolocation' in navigator
  ) {
    return navigator.geolocation;
  }
  return null;
}

function requestWebPosition(
  geo: Geolocation,
  enableHighAccuracy: boolean,
  timeoutMs: number,
): Promise<LocationReading> {
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp || Date.now(),
          isMocked: false,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 10_000,
      },
    );
  });
}

export async function isLocationServicesEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return getWebGeolocation() !== null;
  }
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  try {
    const response = await Location.getForegroundPermissionsAsync();
    return mapPermissionStatus(response.status);
  } catch {
    return 'undetermined';
  }
}

export async function requestLocationPermission(): Promise<LocationPermissionState> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === Location.PermissionStatus.GRANTED) {
      return 'granted';
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    return mapPermissionStatus(requested.status);
  } catch {
    return 'denied';
  }
}

export async function getCurrentLocationReading(
  accuracy: Location.LocationAccuracy = Location.Accuracy.High,
): Promise<LocationReading> {
  const webGeo = getWebGeolocation();
  if (Platform.OS === 'web') {
    if (!webGeo) {
      throw new LocationServiceError(
        'GPS_DISABLED',
        'Browser Anda tidak mendukung Geolocation API.',
      );
    }

    try {
      return await requestWebPosition(webGeo, true, 6000);
    } catch (firstErr) {
      const code = (firstErr as { code?: number } | null)?.code;
      // GeolocationPositionError.PERMISSION_DENIED === 1
      if (code === 1) {
        throw new LocationServiceError(
          'PERMISSION_DENIED',
          'Izin lokasi di browser ditolak. Klik ikon kunci/pengaturan di sebelah kiri URL browser lalu izinkan Location.',
        );
      }
      // Fallback ke network/Wi-Fi location (enableHighAccuracy: false) karena laptop tidak punya chip GPS fisik
      try {
        return await requestWebPosition(webGeo, false, 8000);
      } catch (secondErr) {
        const secondCode = (secondErr as { code?: number } | null)?.code;
        if (secondCode === 1) {
          throw new LocationServiceError(
            'PERMISSION_DENIED',
            'Izin lokasi di browser ditolak. Klik ikon pengaturan di sebelah kiri URL browser lalu izinkan Location.',
          );
        }
        throw new LocationServiceError(
          'POSITION_UNAVAILABLE',
          'Lokasi perangkat tidak dapat diperoleh. Pastikan layanan lokasi (Windows Location Services / GPS) aktif lalu segarkan kembali.',
        );
      }
    }
  }

  const servicesEnabled = await isLocationServicesEnabled();
  if (!servicesEnabled) {
    throw new LocationServiceError(
      'GPS_DISABLED',
      'Layanan lokasi (GPS) perangkat Anda nonaktif. Aktifkan GPS lalu coba lagi.',
    );
  }

  const permission = await requestLocationPermission();
  if (permission !== 'granted') {
    throw new LocationServiceError(
      'PERMISSION_DENIED',
      'Izin lokasi ditolak. Aplikasi membutuhkan akses lokasi untuk memvalidasi presensi di lab.',
    );
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy });
    return toLocationReading(position);
  } catch {
    try {
      const fallbackPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return toLocationReading(fallbackPos);
    } catch {
      throw new LocationServiceError(
        'POSITION_UNAVAILABLE',
        'Gagal memperoleh koordinat GPS terkini. Pastikan sinyal GPS aktif dan coba segarkan lokasi.',
      );
    }
  }
}

export async function subscribeLocationUpdates(
  onReading: (reading: LocationReading) => void,
  onError?: (message: string) => void,
  options?: {
    accuracy?: Location.LocationAccuracy;
    distanceInterval?: number;
    timeInterval?: number;
  },
): Promise<() => void> {
  const webGeo = getWebGeolocation();
  if (Platform.OS === 'web' && webGeo) {
    const watchId = webGeo.watchPosition(
      (pos) => {
        onReading({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp || Date.now(),
          isMocked: false,
        });
      },
      () => {
        // Biarkan pembacaan awal / fallback tetap bertahan bila watchPosition gagal di laptop
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5000,
      },
    );
    return () => {
      webGeo.clearWatch(watchId);
    };
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: options?.accuracy ?? Location.Accuracy.High,
      distanceInterval: options?.distanceInterval ?? 3,
      timeInterval: options?.timeInterval ?? 4000,
    },
    (position) => {
      onReading(toLocationReading(position));
    },
    (errorMessage) => {
      onError?.(errorMessage);
    },
  );

  return () => {
    subscription.remove();
  };
}

export async function openDeviceLocationSettings(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
