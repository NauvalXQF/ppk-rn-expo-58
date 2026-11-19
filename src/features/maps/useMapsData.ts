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
  failed?: boolean;
}

export function useLaboratoryData() {
  const [state, setState] = useState<{ snapshot?: LaboratorySnapshot; error?: string }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function onError(error: unknown) {
      const code = (error as { code?: string } | undefined)?.code;
      setState({
        error: code === 'permission-denied'
          ? 'Akses data laboratorium ditolak Firestore.'
          : 'Data laboratorium gagal dimuat. Periksa koneksi lalu coba lagi.',
      });
    }
    try {
      return subscribeLaboratories((snapshot) => setState({ snapshot }), onError);
    } catch (error) {
      onError(error);
    }
  }, [attempt]);

  return {
    ...state,
    retry: () => {
      setState({});
      setAttempt((previous) => previous + 1);
    },
  };
}

export function useMapsActivity(uid: string, isAssistant: boolean, focused: boolean) {
  const [membership, setMembership] = useState<{ ids?: string[]; failed?: boolean }>({});
  const [remote, setRemote] = useState<{ key: string; entries: ActivityData[] }>();
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const membershipKey = JSON.stringify(membership.ids ?? []);
  const scopeKey = scopeIdentity(isAssistant, membershipKey, attempt);

  useEffect(() => {
    if (isAssistant) return;
    const onError = () => setMembership({ ids: [], failed: true });
    try {
      return subscribeActiveClassIds(uid, (ids) => setMembership({ ids }), onError);
    } catch {
      onError();
    }
  }, [uid, isAssistant, attempt]);

  useEffect(() => {
    const scopes: (string | null)[] = isAssistant ? [null] : JSON.parse(membershipKey);
    const entries: ActivityData[] = scopes.map(() => ({ cached: {} }));
    const publish = () => {
      setNow(Date.now());
      setRemote({ key: scopeKey, entries: [...entries] });
    };
    const subscriptions = scopes.map((scope, index) => {
      const onError = () => {
        entries[index] = { cached: {}, failed: true };
        publish();
      };
      try {
        return subscribeLabActivity(scope, {
          onSessions: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.failed) return;
            entry.sessions = items;
            entry.cached.sessions = fromCache;
            publish();
          },
          onSchedules: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.failed) return;
            entry.schedules = items;
            entry.cached.schedules = fromCache;
            publish();
          },
          onClasses: ({ items, fromCache }) => {
            const entry = entries[index];
            if (entry.failed) return;
            entry.classes = items;
            entry.cached.classes = fromCache;
            publish();
          },
          onError,
        });
      } catch {
        onError();
        return () => {};
      }
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [isAssistant, membershipKey, scopeKey]);

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
    failed: membership.failed || entries?.some((entry) => entry.failed),
    cached: entries?.some((entry) => Object.values(entry.cached).some(Boolean)),
    loading: (!isAssistant && !membership.ids) || (hasScope && (!entries ||
      entries.some((entry) => !entry.failed && (!entry.sessions || !entry.schedules)))),
    retry: () => {
      if (!isAssistant) setMembership({});
      setAttempt((previous) => previous + 1);
    },
  };
}

function scopeIdentity(isAssistant: boolean, classKey: string, attempt: number) {
  return `${isAssistant ? 'asisten' : classKey}:${attempt}`;
}
