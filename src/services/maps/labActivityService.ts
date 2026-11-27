import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/config/firebase';
import { toStatusSesi } from '@/services/practicumService';
import {
  isClockTime,
  parseActivityTime,
  WEEKDAYS,
  type LabSchedule,
  type LabSession,
} from './labActivity';

export interface LabClass {
  id: string;
  name?: string;
  course?: string;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function documentId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && !value.includes('/') && value !== '.' && value !== '..'
    ? value : undefined;
}

function activityTime(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : parseActivityTime(value);
}

function hasInterval(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

function readSession(id: string, data: DocumentData): LabSession | null {
  const { status } = data;
  if (data.archived === true ||
    !['scheduled', 'open', 'closed', 'dijadwalkan', 'dibuka', 'ditutup'].includes(status)) return null;
  const classId = documentId(data.classId);
  const start = activityTime(data.startAt ?? `${data.tanggal}T${data.jamMulai}`);
  const end = activityTime(data.endAt ?? `${data.tanggal}T${data.jamSelesai}`);
  const closedTime = activityTime(data.closedAt);
  if (!classId || !hasInterval(start, end)) return null;
  return {
    id,
    // Keep unlinked sessions only to identify schedules that already have a concrete session.
    labId: documentId(data.labId) ?? '',
    classId,
    scheduleId: documentId(data.scheduleId),
    topic: optionalText(data.topik),
    assistant: optionalText(data.asistenNama),
    status: toStatusSesi(status, data.openedAt, data.closedAt),
    start,
    end,
    closedTime: Number.isFinite(closedTime) ? closedTime : undefined,
  };
}

function readSchedule(id: string, data: DocumentData): LabSchedule | null {
  const labId = documentId(data.labId);
  const classId = documentId(data.classId);
  const { status, startAt, endAt } = data;
  if (data.archived === true || !classId || !labId ||
    (status != null && status !== 'scheduled' && status !== 'dijadwalkan')) return null;
  const details = { id, labId, classId, topic: optionalText(data.topik) };
  const start = activityTime(startAt);
  const end = activityTime(endAt);
  if (hasInterval(start, end)) return { ...details, start, end };

  // A dated record with broken timestamps must not turn into a recurring schedule.
  if ([startAt, endAt].some((value) => value != null && !isClockTime(optionalText(value) ?? ''))) return null;
  const weekday = WEEKDAYS.indexOf(data.hari);
  const startTime = optionalText(data.jamMulai ?? startAt);
  const endTime = optionalText(data.jamSelesai ?? endAt);
  if (weekday < 0 || !startTime || !endTime ||
    !isClockTime(startTime) || !isClockTime(endTime) || startTime >= endTime) return null;
  return { ...details, weekday, startTime, endTime };
}

export function subscribeActiveClassIds(
  uid: string,
  onChange: (classIds: string[] | undefined) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(getFirebaseDb(), 'classMembers'), where('uid', '==', uid)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
        onChange(undefined);
        return;
      }
      const ids = snapshot.docs.flatMap((item) => {
        const data = item.data();
        const classId = documentId(data.classId);
        return classId && data.active === true && data.uid === uid && item.id === `${classId}_${uid}`
          ? [classId] : [];
      });
      onChange([...new Set(ids)].sort());
    },
    onError,
  );
}

interface ActivitySnapshot<T> {
  items: T[];
  fromCache: boolean;
}

export function subscribeLabActivity(
  classId: string | null,
  callbacks: {
    onSessions: (snapshot: ActivitySnapshot<LabSession>) => void;
    onSchedules: (snapshot: ActivitySnapshot<LabSchedule>) => void;
    onClasses: (snapshot: ActivitySnapshot<LabClass>) => void;
    onError: (error: Error) => void;
  },
) {
  const db = getFirebaseDb();
  const options = { includeMetadataChanges: true };
  const sessions = collection(db, 'sessions');
  const schedules = collection(db, 'schedules');
  const classes = collection(db, 'classes');
  const subscriptions = [
    onSnapshot(classId ? query(sessions, where('classId', '==', classId)) : sessions,
      options, (snapshot) => callbacks.onSessions({
        items: snapshot.docs.flatMap((item) => readSession(item.id, item.data()) ?? []),
        fromCache: snapshot.metadata.fromCache,
      }), callbacks.onError),
    onSnapshot(classId ? query(schedules, where('classId', '==', classId)) : schedules,
      options, (snapshot) => callbacks.onSchedules({
        items: snapshot.docs.flatMap((item) => readSchedule(item.id, item.data()) ?? []),
        fromCache: snapshot.metadata.fromCache,
      }), callbacks.onError),
  ];

  function readClass(id: string, data: DocumentData | undefined): LabClass[] {
    if (!data || data.archived === true) return [];
    return [{
      id,
      name: optionalText(data.nama ?? data.name),
      course: optionalText(data.praktikumNama),
    }];
  }

  subscriptions.push(classId
    ? onSnapshot(doc(classes, classId), options, (snapshot) => callbacks.onClasses({
      items: readClass(snapshot.id, snapshot.data()),
      fromCache: snapshot.metadata.fromCache,
    }), callbacks.onError)
    : onSnapshot(classes, options, (snapshot) => callbacks.onClasses({
      items: snapshot.docs.flatMap((item) => readClass(item.id, item.data())),
      fromCache: snapshot.metadata.fromCache,
    }), callbacks.onError));

  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}
