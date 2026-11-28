import { getFirebaseDb } from '@/config/firebase';
import type { Laboratory } from '@/types/laboratory';
import type { Jadwal, Sesi } from '@/types/models';
import {
  collection,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

export type PeriodFilter = 'hari' | 'minggu' | 'bulan' | 'semua';

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
  settledAt?: string | null;
  paymentMethod?: string | null;
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

  if (period === 'semua') {
    const start = new Date(2020, 0, 1, 0, 0, 0, 0);
    const end = new Date(2100, 11, 31, 23, 59, 59, 999);
    return { start, end, label: 'Semua Periode' };
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

  // Filter fines by range (prefer settledAt for paid fines)
  const filteredFines = fines.filter((f) => {
    const rawDate =
      f.status === 'paid'
        ? f.settledAt || f.paidAt || f.sessionTanggal || f.createdAt
        : f.sessionTanggal || f.createdAt;
    const dateStr = toIsoStringOrNull(rawDate) ?? '';
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
    const labOngoing = ongoingSessions.find((s) => (s.labId || s.kelasId) === lab.id);
    const labUpcoming =
      scheduledSessions.find((s) => (s.labId || s.kelasId) === lab.id) ||
      schedules.find((j) => (j.labId || j.kelasId) === lab.id);

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

function toIsoStringOrNull(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function fetchDashboardFines(): Promise<FineRecord[]> {
  try {
    const db = getFirebaseDb();
    const [finesSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, 'fines')),
      getDocs(collection(db, 'payments')),
    ]);
    const settledByFineId = new Map<string, { settledAt: string | null; method: string | null }>();
    for (const p of paymentsSnap.docs) {
      const pData = p.data();
      if (pData.status === 'success' && typeof pData.fineId === 'string') {
        const settled = toIsoStringOrNull(pData.settledAt);
        const method =
          typeof pData.paymentMethod === 'string'
            ? pData.paymentMethod
            : typeof pData.paymentType === 'string'
              ? pData.paymentType
              : null;
        settledByFineId.set(pData.fineId, { settledAt: settled, method });
      }
    }
    return finesSnap.docs.map((d) => {
      const data = d.data() as Omit<FineRecord, 'id'>;
      const settlement = settledByFineId.get(d.id);
      return {
        id: d.id,
        ...data,
        createdAt: toIsoStringOrNull(data.createdAt),
        paidAt: toIsoStringOrNull(data.paidAt),
        settledAt: settlement?.settledAt ?? toIsoStringOrNull(data.settledAt),
        paymentMethod: settlement?.method ?? data.paymentMethod ?? null,
      };
    });
  } catch {
    return [];
  }
}

export function subscribeDashboardFines(
  onUpdate: (fines: FineRecord[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  let rawFines: FineRecord[] = [];
  const settledByFineId = new Map<string, { settledAt: string | null; method: string | null }>();

  const emit = () => {
    onUpdate(
      rawFines.map((f) => {
        const settlement = settledByFineId.get(f.id);
        return {
          ...f,
          settledAt: settlement?.settledAt ?? f.settledAt ?? null,
          paymentMethod: settlement?.method ?? f.paymentMethod ?? null,
        };
      }),
    );
  };

  const unsubFines = onSnapshot(
    collection(db, 'fines'),
    (snap) => {
      rawFines = snap.docs.map((d) => {
        const data = d.data() as Omit<FineRecord, 'id'>;
        return {
          id: d.id,
          ...data,
          createdAt: toIsoStringOrNull(data.createdAt),
          paidAt: toIsoStringOrNull(data.paidAt),
          settledAt: toIsoStringOrNull(data.settledAt),
        };
      });
      emit();
    },
    (err) => onError?.(err),
  );

  const unsubPayments = onSnapshot(
    collection(db, 'payments'),
    (snap) => {
      settledByFineId.clear();
      for (const d of snap.docs) {
        const pData = d.data();
        if (pData.status === 'success' && typeof pData.fineId === 'string') {
          const settled = toIsoStringOrNull(pData.settledAt);
          const method =
            typeof pData.paymentMethod === 'string'
              ? pData.paymentMethod
              : typeof pData.paymentType === 'string'
                ? pData.paymentType
                : null;
          settledByFineId.set(pData.fineId, { settledAt: settled, method });
        }
      }
      emit();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubFines();
    unsubPayments();
  };
}
