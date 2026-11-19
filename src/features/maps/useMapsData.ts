import { useEffect, useMemo, useState } from 'react';
import { subscribeLaboratories, type LaboratorySnapshot } from '@/services/maps/laboratoryService';
import { getLabActivities, type LabSchedule, type LabSession } from '@/services/maps/labActivity';
import {
  subscribeActiveClassIds,
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

export function useMapsActivity(uid: string, isAssistant: boolean, focused: boolean) {
  const [membership, setMembership] = useState<{ ids?: string[]; error?: string }>({});
  const [remote, setRemote] = useState<{ key: string; entries: ActivityData[] }>();
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const membershipKey = JSON.stringify(membership.ids ?? []);
  const scopeKey = scopeIdentity(isAssistant, membershipKey, attempt);

  useEffect(() => {
    if (!focused || isAssistant) return;
    let active = true;
    const onError = (error: unknown) => {
      if (active) setMembership({ ids: [], error: activityError(error) });
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeActiveClassIds(uid, (ids) => {
        if (active) setMembership({ ids });
      }, onError);
    } catch (error) {
      onError(error);
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [uid, isAssistant, focused, attempt]);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    const scopes: (string | null)[] = isAssistant ? [null] : JSON.parse(membershipKey);
    const entries: ActivityData[] = scopes.map(() => ({ cached: {} }));
    const publish = () => {
      if (!active) return;
      setNow(Date.now());
      setRemote({ key: scopeKey, entries: [...entries] });
    };
    const subscriptions = scopes.map((scope, index) => {
      const onError = (error: unknown) => {
        entries[index] = { cached: {}, error: activityError(error) };
        publish();
      };
      try {
        return subscribeLabActivity(scope, {
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
  }, [isAssistant, focused, membershipKey, scopeKey]);

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

  const entries = remote?.key === scopeKey ? remote.entries : undefined;
  const classes = useMemo(() => new Map(
    entries?.flatMap((entry) => entry.classes?.map((item) => [item.id, item] as const) ?? []) ?? [],
  ), [entries]);

  const activities = useMemo(() => getLabActivities(
    entries?.flatMap((entry) => entry.sessions ?? []) ?? [],
    entries?.flatMap((entry) => entry.schedules ?? []) ?? [],
    now,
  ), [entries, now]);
  const hasScope = isAssistant || Boolean(membership.ids?.length);

  return {
    activities,
    classes,
    error: membership.error ?? entries?.find((entry) => entry.error)?.error,
    cached: entries?.some((entry) => Object.values(entry.cached).some(Boolean)),
    loading: (!isAssistant && !membership.ids) || (hasScope && (!entries ||
      entries.some((entry) => !entry.error && (!entry.sessions || !entry.schedules)))),
    retry: () => {
      if (!isAssistant) setMembership({});
      setAttempt((previous) => previous + 1);
    },
  };
}

function scopeIdentity(isAssistant: boolean, classKey: string, attempt: number) {
  return `${isAssistant ? 'asisten' : classKey}:${attempt}`;
}
