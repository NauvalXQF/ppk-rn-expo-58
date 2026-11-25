import { useEffect, useMemo, useState } from 'react';
import {
  defaultPermissionRepository,
  subscribeAsistenLeaves,
  subscribePraktikanLeaves,
  type PermissionRepository,
} from '@/services/permissionService';
import type { LeaveRequest, PermissionActor } from './types';

interface SubscriptionState {
  key: string;
  items: LeaveRequest[];
  error: string | null;
}

export function useLeaveSubscription(
  mode: 'praktikan' | 'asisten',
  actor: PermissionActor,
  repository: PermissionRepository = defaultPermissionRepository,
) {
  const assignedLabsKey = (actor.assignedLabIds ?? [])
    .slice()
    .sort()
    .join(',');
  const currentKey = `${mode}:${actor.role}:${actor.uid}:${assignedLabsKey}`;
  const [state, setState] = useState<SubscriptionState | null>(null);

  // Stabilkan objek aktor berdasarkan nilai primitif agar listener tidak re-subscribe saat parent re-render.
  const subscriptionActor = useMemo<PermissionActor>(
    () => ({
      uid: actor.uid,
      role: actor.role,
      displayName: actor.displayName,
      ...(assignedLabsKey
        ? { assignedLabIds: assignedLabsKey.split(',').filter(Boolean) }
        : actor.role === 'asprak'
          ? { assignedLabIds: [] }
          : {}),
    }),
    [actor.uid, actor.role, actor.displayName, assignedLabsKey],
  );

  useEffect(() => {
    let active = true;

    const subscribe =
      mode === 'praktikan' ? subscribePraktikanLeaves : subscribeAsistenLeaves;

    const unsubscribe = subscribe(
      subscriptionActor,
      (items) => {
        if (!active) return;
        setState({ key: currentKey, items, error: null });
      },
      (err) => {
        if (!active) return;
        setState({ key: currentKey, items: [], error: err.message });
      },
      repository,
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentKey, mode, repository, subscriptionActor]);

  const isCurrent = state !== null && state.key === currentKey;

  return {
    requests: isCurrent ? state.items : [],
    loading: !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
