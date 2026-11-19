import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { doc, getDoc } from 'firebase/firestore';

import {
  evaluateGeofence,
  isValidCoordinate,
  resolveSessionLabTarget,
} from '@/services/location/geofenceService';
import {
  getCurrentLocationReading,
  LocationServiceError,
  openDeviceLocationSettings,
  subscribeLocationUpdates,
} from '@/services/location/locationService';
import { getDb } from '@/services/practicumService';
import type {
  LabGeofenceTarget,
  LocationPermissionState,
  LocationReading,
  VerificationResult,
} from '@/types/geoAttendance';
import type { Sesi } from '@/types/models';

export interface UseGeofenceResult {
  labTarget: LabGeofenceTarget;
  reading: LocationReading | null;
  verification: VerificationResult | null;
  permissionState: LocationPermissionState;
  gpsEnabled: boolean;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  refreshLocation: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useGeofence(
  sesi: Sesi | null | undefined,
  enabled = true,
): UseGeofenceResult {
  const baseTarget = useMemo(() => resolveSessionLabTarget(sesi), [sesi]);
  const [remoteLabOverride, setRemoteLabOverride] = useState<{
    labId: string;
    target: LabGeofenceTarget;
  } | null>(null);
  const [reading, setReading] = useState<LocationReading | null>(null);
  const [permissionState, setPermissionState] =
    useState<LocationPermissionState>('undetermined');
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );

  const watchUnsubRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const labTarget = useMemo(() => {
    const labId = sesi?.labId?.trim();
    if (
      labId &&
      !isValidCoordinate(sesi?.labCoordinates) &&
      remoteLabOverride?.labId === labId
    ) {
      return remoteLabOverride.target;
    }
    return baseTarget;
  }, [baseTarget, remoteLabOverride, sesi?.labCoordinates, sesi?.labId]);

  useEffect(() => {
    const labId = sesi?.labId?.trim();
    if (!labId || isValidCoordinate(sesi?.labCoordinates)) {
      return;
    }

    const db = getDb();
    if (!db) return;

    let cancelled = false;
    getDoc(doc(db, 'laboratories', labId))
      .then((snap) => {
        if (cancelled || !mountedRef.current || !snap.exists()) return;
        const data = snap.data();
        const coords = {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        };
        const radius = Number(data.radiusMeters);
        if (isValidCoordinate(coords)) {
          setRemoteLabOverride({
            labId: snap.id,
            target: {
              labId: snap.id,
              labNama:
                typeof data.nama === 'string' && data.nama.trim()
                  ? data.nama.trim()
                  : baseTarget.labNama,
              coordinates: coords,
              radiusMeters:
                Number.isFinite(radius) && radius > 0
                  ? radius
                  : baseTarget.radiusMeters,
              source: 'laboratory',
            },
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [baseTarget.labNama, baseTarget.radiusMeters, sesi?.labCoordinates, sesi?.labId]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        setAppActive(nextState === 'active');
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);

  const stopWatcher = useCallback(() => {
    if (watchUnsubRef.current) {
      watchUnsubRef.current();
      watchUnsubRef.current = null;
    }
  }, []);

  const fetchAndWatch = useCallback(
    async (isManualRefresh: boolean) => {
      if (!enabled) {
        stopWatcher();
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const current = await getCurrentLocationReading(Location.Accuracy.High);
        if (!mountedRef.current) return;

        setPermissionState('granted');
        setGpsEnabled(true);
        setReading(current);
        setErrorMessage(null);

        stopWatcher();
        const unsub = await subscribeLocationUpdates(
          (nextReading) => {
            if (!mountedRef.current) return;
            setReading(nextReading);
          },
          (watchErr) => {
            if (!mountedRef.current) return;
            setErrorMessage(watchErr);
          },
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 4000,
          },
        );
        if (!mountedRef.current) {
          unsub();
          return;
        }
        watchUnsubRef.current = unsub;
      } catch (err) {
        if (!mountedRef.current) return;
        stopWatcher();

        if (err instanceof LocationServiceError) {
          if (err.code === 'PERMISSION_DENIED') {
            setPermissionState('denied');
          } else if (err.code === 'GPS_DISABLED') {
            setGpsEnabled(false);
          }
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Gagal memperoleh lokasi perangkat.',
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, stopWatcher],
  );

  useEffect(() => {
    if (!enabled || !appActive) {
      stopWatcher();
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchAndWatch(false).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      stopWatcher();
    };
  }, [appActive, enabled, fetchAndWatch, stopWatcher]);

  const refreshLocation = useCallback(async () => {
    await fetchAndWatch(true);
  }, [fetchAndWatch]);

  const openSettings = useCallback(async () => {
    await openDeviceLocationSettings();
  }, []);

  const verification = useMemo<VerificationResult | null>(() => {
    if (!reading) return null;
    try {
      return evaluateGeofence(reading, {
        labNama: labTarget.labNama,
        coordinates: labTarget.coordinates,
        radiusMeters: labTarget.radiusMeters,
      });
    } catch {
      return null;
    }
  }, [labTarget.coordinates, labTarget.labNama, labTarget.radiusMeters, reading]);

  return {
    labTarget,
    reading,
    verification,
    permissionState,
    gpsEnabled,
    loading: enabled ? loading : false,
    refreshing,
    errorMessage,
    refreshLocation,
    openSettings,
  };
}
