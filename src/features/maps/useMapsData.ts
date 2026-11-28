import { useEffect, useMemo, useState } from 'react';
import type { Role } from '@/services/authService';
import { subscribeLaboratories, type LaboratorySnapshot } from '@/services/maps/laboratoryService';
import { getLabActivities, type LabSchedule, type LabSession } from '@/services/maps/labActivity';
import {
  subscribeActiveClassIds,
  subscribeAssignedLabIds,
  subscribeLabActivity,
  type LabClass,
} from '@/services/maps/labActivityService';

interface ActivityData {
  sessions?: LabSession[];
  schedules?: LabSchedule[];
  classes?: LabClass[];
  cached: { sessions?: boolean; schedules?: boolean; classes?: boolean };
  error?: string;
}

interface MembershipData {
  ids?: string[];
  cached?: boolean;
  error?: string;
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | undefined)?.code === 'permission-denied';
}

function activityError(error: unknown): string {
  return isPermissionDenied(error)
    ? 'Akses data aktivitas laboratorium ditolak Firestore.'
    : 'Sebagian data aktivitas gagal dimuat.';
}

export function useLaboratoryData(focused: boolean) {
  const [state, setState] = useState<{ snapshot?: LaboratorySnapshot; error?: string }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    function onError(error: unknown) {
      if (!active) return;
      setState({
        error: isPermissionDenied(error)
          ? 'Akses data laboratorium ditolak Firestore.'
          : 'Data laboratorium gagal dimuat. Periksa koneksi lalu coba lagi.',
      });
    }
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeLaboratories((snapshot) => {
        if (active) setState({ snapshot });
      }, onError);
    } catch (error) {
      onError(error);
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [focused, attempt]);

  return {
    ...state,
    retry: () => {
      setState({});
      setAttempt((previous) => previous + 1);
    },
  };
}

export function useMapsActivity(
  uid: string,
  roleOrIsAssistant: Role | boolean,
  focused: boolean,
) {
  const scopeRole: Role =
    typeof roleOrIsAssistant === 'boolean'
      ? roleOrIsAssistant
        ? 'aslab'
        : 'praktikan'
      : roleOrIsAssistant;
  const isFullScope = scopeRole === 'aslab';
  const isAsprakScope = scopeRole === 'asprak' || scopeRole === 'asisten';

  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  // A returning tab or account must wait for a fresh membership and activity subscription.
  const viewer = useMemo(
    () => ({ uid, scopeRole, isFullScope, isAsprakScope, focused, attempt }),
    [uid, scopeRole, isFullScope, isAsprakScope, focused, attempt],
  );
  const [membershipState, setMembership] = useState<{ viewer: typeof viewer; data: MembershipData }>();
  const membership = membershipState?.viewer === viewer ? membershipState.data : undefined;
  const membershipKey = JSON.stringify(membership?.ids ?? []);
  const membershipReady = isFullScope || membership?.ids !== undefined;
  const scope = useMemo(
    () => ({ viewer, ready: membershipReady, classIds: JSON.parse(membershipKey) as string[] }),
    [viewer, membershipReady, membershipKey],
  );
  const [remote, setRemote] = useState<{ scope: typeof scope; entries: ActivityData[] }>();

  useEffect(() => {
    if (!viewer.focused || viewer.isFullScope) return;
    let active = true;
    const onError = (error: unknown) => {
      if (active) setMembership({ viewer, data: { ids: [], error: activityError(error) } });
    };
    let unsubscribe: (() => void) | undefined;
    try {
      const subscribeIds = viewer.isAsprakScope
        ? subscribeAssignedLabIds
        : subscribeActiveClassIds;
      unsubscribe = subscribeIds(viewer.uid, (ids) => {
        if (active) setMembership({ viewer, data: { ids, cached: ids === undefined } });
      }, onError);
    } catch (error) {
      onError(error);
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [viewer]);

  useEffect(() => {
    if (!scope.viewer.focused || !scope.ready) return;
    let active = true;
    const classIds = scope.viewer.isFullScope ? [null] : scope.classIds;
    if (classIds.length === 0) return;
    const entries: ActivityData[] = classIds.map(() => ({ cached: {} }));
    const publish = () => {
      if (!active) return;
      setNow(Date.now());
      setRemote({ scope, entries: [...entries] });
    };
    const subscriptions = classIds.map((classId, index) => {
      const onError = (error: unknown) => {
        entries[index] = { cached: {}, error: activityError(error) };
        publish();
      };
      try {
        return subscribeLabActivity(classId, {
          onSessions: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.error) return;
            entry.sessions = items;
            entry.cached.sessions = fromCache;
            publish();
          },
          onSchedules: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.error) return;
            entry.schedules = items;
            entry.cached.schedules = fromCache;
            publish();
          },
          onClasses: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.error) return;
            entry.classes = items;
            entry.cached.classes = fromCache;
            publish();
          },
          onError,
        });
      } catch (error) {
        onError(error);
        return () => {};
      }
    });
    return () => {
      active = false;
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [scope]);

  useEffect(() => {
    if (!focused) return;
    const refresh = () => setNow(Date.now());
    const initial = setTimeout(refresh, 0);
    const periodic = setInterval(refresh, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(periodic);
    };
  }, [focused]);

  const entries = remote?.scope === scope ? remote.entries : undefined;
  const classes = useMemo(() => new Map(
    entries?.flatMap((entry) => entry.classes?.map((item) => [item.id, item] as const) ?? []) ?? [],
  ), [entries]);

  const activities = useMemo(() => getLabActivities(
    entries?.flatMap((entry) => entry.sessions ?? []) ?? [],
    entries?.flatMap((entry) => entry.schedules ?? []) ?? [],
    now,
  ), [entries, now]);
  const hasScope = isFullScope || Boolean(membership?.ids?.length);

  return {
    activities,
    classes,
    error: membership?.error ?? entries?.find((entry) => entry.error)?.error,
    cached: membership?.cached || entries?.some((entry) => Object.values(entry.cached).some(Boolean)),
    loading: focused && ((!isFullScope && !membership?.ids) || (hasScope && (!entries ||
      entries.some((entry) => !entry.error && (!entry.sessions || !entry.schedules))))),
    retry: () => setAttempt((previous) => previous + 1),
  };
}
