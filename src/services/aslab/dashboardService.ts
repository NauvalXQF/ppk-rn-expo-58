import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/config/firebase';
import type { Laboratory } from '@/types/laboratory';
import type { Jadwal, Sesi } from '@/types/models';

export type PeriodFilter = 'hari' | 'minggu' | 'bulan';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface FineRecord {
  id: string;
  uid: string;
  praktikanNama: string;
  praktikanNim?: string;
  labId: string;
  labNama: string;
  sessionId: string;
  sessionTopik: string;
  sessionTanggal: string;
  amount: number;
  status: 'unpaid' | 'pending_payment' | 'paid' | 'waived';
  lateMinutes: number;
  paidAt?: string | null;
  createdAt?: unknown;
}

export interface LabOperationalStatus {
  lab: Laboratory;
  ongoingSession?: Sesi;
  upcomingSession?: Sesi | Jadwal;
  totalPraktikan: number;
  totalAsprak: number;
  statusText: 'Sedang Praktikum' | 'Terjadwal' | 'Kosong';
  statusTone: 'success' | 'warning' | 'neutral';
}

export interface DashboardMetrics {
  totalLabs: number;
  totalPraktikan: number;
  ongoingSessions: Sesi[];
  upcomingSessions: (Sesi | Jadwal)[];
  completedSessions: Sesi[];
  fineTotalPaid: number;
  fineTotalUnpaid: number;
  fineTotalWaived: number;
  paymentRatio: number;
  labStatuses: LabOperationalStatus[];
  finesList: FineRecord[];
}

export function getDateRange(period: PeriodFilter, refDate = new Date()): DateRange {
  const current = new Date(refDate);

  if (period === 'hari') {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0, 0);
    const end = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59, 999);
    const label = start.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return { start, end, label };
  }

  if (period === 'minggu') {
    const day = current.getDay();
    // Monday is day 1 in ISO, if Sunday (0) treat as 7
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() + diffToMonday, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    const label = `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return { start, end, label };
  }

  // bulan
  const start = new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export function isDateWithinRange(dateStr: string, range: DateRange): boolean {
  if (!dateStr) return false;
  // Parse YYYY-MM-DD or ISO string
  const dateObj = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  const timestamp = dateObj.getTime();
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}

export function calculateDashboardMetrics({
  laboratories,
  sessions,
  schedules = [],
  classMembers = [],
  fines = [],
  filter,
  referenceDate = new Date(),
}: {
  laboratories: Laboratory[];
  sessions: Sesi[];
  schedules?: Jadwal[];
  classMembers?: { classId: string; active?: boolean }[];
  fines?: FineRecord[];
  filter: PeriodFilter;
  referenceDate?: Date;
}): DashboardMetrics {
  const range = getDateRange(filter, referenceDate);
  const activeLabs = laboratories.filter((l) => l.aktif);

  // Filter sessions by range
  const filteredSessions = sessions.filter((s) => isDateWithinRange(s.tanggal, range));

  const ongoingSessions = filteredSessions.filter((s) => s.status === 'dibuka');
  const completedSessions = filteredSessions.filter((s) => s.status === 'ditutup');
  const scheduledSessions = filteredSessions.filter((s) => s.status === 'dijadwalkan');

  // Filter fines by range
  const filteredFines = fines.filter((f) => {
    const dateStr = f.sessionTanggal || (typeof f.createdAt === 'string' ? f.createdAt : '');
    return isDateWithinRange(dateStr, range);
  });

  let fineTotalPaid = 0;
  let fineTotalUnpaid = 0;
  let fineTotalWaived = 0;

  for (const fine of filteredFines) {
    if (fine.status === 'paid') {
      fineTotalPaid += fine.amount;
    } else if (fine.status === 'unpaid' || fine.status === 'pending_payment') {
      fineTotalUnpaid += fine.amount;
    } else if (fine.status === 'waived') {
      fineTotalWaived += fine.amount;
    }
  }

  const totalBilled = fineTotalPaid + fineTotalUnpaid;
  const paymentRatio = totalBilled > 0 ? fineTotalPaid / totalBilled : 0;

  // Total unique active praktikan
  const activeMembers = classMembers.filter((m) => m.active !== false);
  const totalPraktikan = activeMembers.length;

  // Build lab operational statuses
  const labStatuses: LabOperationalStatus[] = activeLabs.map((lab) => {
    const labOngoing = ongoingSessions.find((s) => s.labId === lab.id);
    const labUpcoming =
      scheduledSessions.find((s) => s.labId === lab.id) ||
      schedules.find((j) => j.labId === lab.id);

    const labMembers = activeMembers.filter((m) => m.classId === lab.id);
    const totalAsprak = lab.asprakUids?.length ?? 0;

    let statusText: LabOperationalStatus['statusText'] = 'Kosong';
    let statusTone: LabOperationalStatus['statusTone'] = 'neutral';

    if (labOngoing) {
      statusText = 'Sedang Praktikum';
      statusTone = 'success';
    } else if (labUpcoming) {
      statusText = 'Terjadwal';
      statusTone = 'warning';
    }

    return {
      lab,
      ongoingSession: labOngoing,
      upcomingSession: labUpcoming,
      totalPraktikan: labMembers.length,
      totalAsprak,
      statusText,
      statusTone,
    };
  });

  return {
    totalLabs: activeLabs.length,
    totalPraktikan,
    ongoingSessions,
    upcomingSessions: [...scheduledSessions, ...schedules],
    completedSessions,
    fineTotalPaid,
    fineTotalUnpaid,
    fineTotalWaived,
    paymentRatio,
    labStatuses,
    finesList: filteredFines,
  };
}

export async function fetchDashboardFines(): Promise<FineRecord[]> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, 'fines'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<FineRecord, 'id'>),
    }));
  } catch {
    return [];
  }
}
