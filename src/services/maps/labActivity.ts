import type { StatusSesi } from '@/types/models';

export const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

interface ActivityDetails {
  id: string;
  labId: string;
  classId: string;
  topic?: string;
}

export interface LabSession extends ActivityDetails {
  scheduleId?: string;
  assistant?: string;
  status: StatusSesi;
  start: number;
  end: number;
  closedTime?: number;
}

export type LabSchedule = ActivityDetails & (
  | { start: number; end: number }
  | { weekday: number; startTime: string; endTime: string }
);

export interface ScheduledActivity extends ActivityDetails {
  start: number;
  end: number;
}

export interface LabActivity {
  ongoing?: LabSession;
  lastCompleted?: LabSession;
  upcoming: ScheduledActivity[];
}

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isClockTime(value: string): boolean {
  return CLOCK.test(value);
}

export function parseActivityTime(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) return NaN;
  const [, year, month, day] = match;
  const calendarDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (calendarDate.getUTCMonth() + 1 !== Number(month) || calendarDate.getUTCDate() !== Number(day)) {
    return NaN;
  }
  return Date.parse(value);
}

function localDateKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function nextOccurrence(schedule: LabSchedule, now: number): ScheduledActivity {
  if ('start' in schedule) return schedule;

  const start = new Date(now);
  const daysUntil = (schedule.weekday - start.getDay() + 7) % 7;
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  start.setDate(start.getDate() + daysUntil);
  start.setHours(startHour, startMinute, 0, 0);
  if (start.getTime() <= now) start.setDate(start.getDate() + 7);

  const end = new Date(start);
  end.setHours(endHour, endMinute, 0, 0);
  return { ...schedule, start: start.getTime(), end: end.getTime() };
}

export function getLabActivities(
  sessions: readonly LabSession[],
  schedules: readonly LabSchedule[],
  now: number,
): Map<string, LabActivity> {
  const activities = new Map<string, LabActivity>();
  const materializedDates = new Map<string, Set<string>>();
  const ongoing = new Map<string, LabSession[]>();

  function forLab(labId: string) {
    const activity = activities.get(labId) ?? { upcoming: [] };
    activities.set(labId, activity);
    return activity;
  }

  for (const session of sessions) {
    if (session.scheduleId) {
      const dates = materializedDates.get(session.scheduleId) ?? new Set<string>();
      dates.add(localDateKey(session.start));
      materializedDates.set(session.scheduleId, dates);
    }
    if (!session.labId) continue;
    if (session.status === 'dibuka' ||
      (session.status === 'dijadwalkan' && session.start <= now && now < session.end)) {
      const running = ongoing.get(session.labId) ?? [];
      running.push(session);
      ongoing.set(session.labId, running);
    } else if (session.status === 'dijadwalkan' && session.start > now) {
      forLab(session.labId).upcoming.push(session);
    } else if (session.status === 'ditutup') {
      const completedAt = session.closedTime ?? session.end;
      if (completedAt > now || localDateKey(completedAt) !== localDateKey(now)) continue;
      const activity = forLab(session.labId);
      const previous = activity.lastCompleted;
      if (!previous || completedAt > (previous.closedTime ?? previous.end)) {
        activity.lastCompleted = session;
      }
    }
  }

  for (const [labId, running] of ongoing) {
    running.sort((first, second) =>
      Number(second.status === 'dibuka') - Number(first.status === 'dibuka') ||
      second.start - first.start || first.id.localeCompare(second.id),
    );
    forLab(labId).ongoing = running[0];
  }

  for (const schedule of schedules) {
    const occurrence = nextOccurrence(schedule, now);
    const dates = materializedDates.get(schedule.id);
    const hasSession = dates && ('start' in schedule || dates.has(localDateKey(occurrence.start)));
    if (occurrence.start > now && !hasSession) {
      forLab(schedule.labId).upcoming.push(occurrence);
    }
  }

  for (const activity of activities.values()) {
    activity.upcoming = activity.upcoming
      .sort((first, second) => first.start - second.start || first.id.localeCompare(second.id))
      .slice(0, 3);
  }

  return activities;
}
