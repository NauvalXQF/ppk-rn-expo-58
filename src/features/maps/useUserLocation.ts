import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';

type LocationState =
  | { status: 'searching' | 'gps-off' | 'unavailable' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'located'; point: Location.LocationObjectCoords };

export function useUserLocation(focused: boolean) {
  const [state, setState] = useState<LocationState>({ status: 'searching' });
  const [attempt, setAttempt] = useState(0);
  const promptedAttempt = useRef<number | null>(null);

  useEffect(() => {
    if (!focused || Platform.OS === 'web') return;

    let stopTracking: (() => void) | undefined;
    function updateTracking(nextState: string) {
      stopTracking?.();
      stopTracking = undefined;
      if (nextState !== 'active') return;

      let cancelled = false;
      let watcher: Location.LocationSubscription | undefined;
      let positionTimer: ReturnType<typeof setTimeout> | undefined;
      stopTracking = () => {
        cancelled = true;
        clearTimeout(positionTimer);
        watcher?.remove();
      };
      const report = (value: LocationState) => {
        if (!cancelled) setState(value);
      };

      async function start() {
        report({ status: 'searching' });
        try {
          let permission = await Location.getForegroundPermissionsAsync();
          if (cancelled) return;
          if (!permission.granted && permission.canAskAgain &&
            promptedAttempt.current !== attempt &&
            (permission.status === Location.PermissionStatus.UNDETERMINED || attempt > 0)) {
            promptedAttempt.current = attempt;
            permission = await Location.requestForegroundPermissionsAsync();
          }
          if (cancelled) return;
          if (!permission.granted) {
            report({ status: 'denied', canAskAgain: permission.canAskAgain });
            return;
          }
          const enabled = await Location.hasServicesEnabledAsync();
          if (cancelled) return;
          if (!enabled) {
            report({ status: 'gps-off' });
            return;
          }

          positionTimer = setTimeout(() => report({ status: 'unavailable' }), 15000);
          const subscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 3, timeInterval: 2000, mayShowUserSettingsDialog: false },
            ({ coords }) => {
              clearTimeout(positionTimer);
              report({ status: 'located', point: coords });
            },
            () => {
              clearTimeout(positionTimer);
              report({ status: 'unavailable' });
            },
          );
          if (cancelled) subscription.remove();
          else watcher = subscription;
        } catch {
          clearTimeout(positionTimer);
          report({ status: 'unavailable' });
        }
      }

      void start();
    }

    const listener = AppState.addEventListener('change', updateTracking);
    updateTracking(AppState.currentState ?? 'active');
    return () => {
      listener.remove();
      stopTracking?.();
    };
  }, [focused, attempt]);

  return { state, retry: () => setAttempt((previous) => previous + 1) };
}
