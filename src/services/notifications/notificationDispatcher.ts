import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDb } from '@/services/practicumService';
import { registerFineCreatedNotifier } from '@/services/fines/fineCalculationService';
import {
  getUsersDeviceTokens,
  isExpoPushToken,
  type TokenRegistryRepository,
} from '@/services/notifications/tokenRegistryService';
import { isPraktikanInClass } from '@/store/selectors';
import type { Praktikan } from '@/types/models';
import type {
  LeaveDecidedEventInput,
  NotificationAuditRecord,
  NotificationDataPayload,
  NotificationDeliveryStatus,
  NotificationDispatchResult,
  NotificationEventType,
  PushNotificationPayload,
  ScheduleChangedEventInput,
  SessionOpenedEventInput,
} from '@/types/notification';

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'praktikum-events';
const MAX_EXPO_BATCH_SIZE = 100;

registerFineCreatedNotifier(async ({ uid, fineId }) => {
  const { enqueueFineCreated } = await import('@/services/payments/fineCreatedQueue');
  await enqueueFineCreated(uid, fineId);
});

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: NotificationDataPayload;
  sound: 'default';
  priority: 'high';
  channelId: string;
}

export interface ExpoPushSendSummary {
  deliveredTokens: string[];
  failedTokens: string[];
  invalidTokens: string[];
}

export interface NotificationAuditStore {
  record(
    entry: Omit<NotificationAuditRecord, 'id' | 'createdAt'>,
  ): Promise<NotificationAuditRecord>;
  subscribeForUser(
    uid: string,
    onData: (items: NotificationAuditRecord[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
}

export interface DispatchOptions {
  tokenRepository?: TokenRegistryRepository;
  auditStore?: NotificationAuditStore;
  fallbackMembers?: Praktikan[];
  resolveClassMemberUids?: (classId: string) => Promise<string[]>;
  fetchFn?: typeof fetch;
}

function isSafeRouteSegment(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !trimmed.includes('/') && !trimmed.includes('\\') && !trimmed.includes('..');
}

function sortNotificationsNewestFirst(
  items: NotificationAuditRecord[],
): NotificationAuditRecord[] {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt ? Date.parse(a.createdAt) || 0 : Number.MAX_SAFE_INTEGER;
    const timeB = b.createdAt ? Date.parse(b.createdAt) || 0 : Number.MAX_SAFE_INTEGER;
    return timeB - timeA;
  });
}

function normalizeTimestamp(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      const date = (raw as { toDate: () => Date }).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}

// ======================================================
// 1. PAYLOAD BUILDERS (SRS-06 AC-1, AC-2, AC-3)
// ======================================================

export function buildSessionOpenedPayload(
  input: SessionOpenedEventInput,
): PushNotificationPayload {
  const topik = input.topik.trim() || 'Sesi Praktikum';
  const labLabel = input.labNama?.trim() || input.ruang?.trim() || 'lab';

  return {
    title: 'Sesi Praktikum Dibuka',
    body: `Sesi Praktikum Dibuka: ${topik} - Silakan lakukan presensi di ${labLabel}`,
    data: {
      type: 'session_opened',
      screen: 'presensi',
      sessionId: input.sessionId.trim(),
      classId: input.classId.trim(),
    },
  };
}

export function buildScheduleChangedPayload(
  input: ScheduleChangedEventInput,
): PushNotificationPayload {
  const label = input.mataKuliah?.trim() || input.topik.trim() || 'Praktikum';
  const ruang = input.ruang.trim() || 'Ruang Lab';
  const waktu = input.waktu.trim();
  const detailLokasiWaktu = waktu ? `${ruang} (${waktu})` : ruang;
  const sessionId = input.sessionId?.trim() || undefined;
  const scheduleId = input.scheduleId?.trim() || undefined;

  return {
    title: 'Perubahan Jadwal Praktikum',
    body: `Perubahan Jadwal Praktikum: ${label} dipindahkan ke ${detailLokasiWaktu}`,
    data: {
      type: 'schedule_changed',
      screen: sessionId ? 'sesi' : 'jadwal',
      classId: input.classId.trim(),
      ...(sessionId ? { sessionId } : {}),
      ...(scheduleId ? { scheduleId } : {}),
    },
  };
}

export function buildLeaveDecidedPayload(
  input: LeaveDecidedEventInput,
): PushNotificationPayload {
  const decisionLabel = input.decision === 'approved' ? 'Disetujui' : 'Ditolak';
  const note = input.decisionNote?.trim();
  const fallbackTopic = input.sessionTopic?.trim();
  const detail =
    note ||
    (fallbackTopic
      ? `Keputusan izin untuk sesi ${fallbackTopic} telah diperbarui.`
      : 'Keputusan pengajuan izin Anda telah diperbarui oleh asisten.');

  const sessionId = input.sessionId?.trim() || undefined;

  return {
    title: `Pengajuan Izin ${decisionLabel}`,
    body: `Pengajuan Izin ${decisionLabel}: ${detail}`,
    data: {
      type: 'leave_decided',
      screen: 'izin',
      requestId: input.requestId.trim(),
      ...(sessionId ? { sessionId } : {}),
    },
  };
}

// ======================================================
// 2. DEEP LINKING ROUTE RESOLVER (SRS-06 AC-4)
// ======================================================

export function resolveNotificationRoute(
  data: Partial<NotificationDataPayload> | Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== 'object') return null;

  const screen = typeof data.screen === 'string' ? data.screen.trim() : '';
  const type = typeof data.type === 'string' ? data.type.trim() : '';
  const sessionId = isSafeRouteSegment(data.sessionId)
    ? data.sessionId.trim()
    : null;

  if (screen === 'presensi') {
    return sessionId ? `/presensi/${sessionId}` : '/(tabs)/jadwal';
  }
  if (screen === 'sesi') {
    return sessionId ? `/sesi/${sessionId}` : '/(tabs)/jadwal';
  }
  if (screen === 'izin') {
    return '/(tabs)/izin';
  }
  if (screen === 'jadwal') {
    return '/(tabs)/jadwal';
  }

  // Fallback berdasarkan tipe peristiwa jika field screen tidak diisi
  if (type === 'session_opened') {
    return sessionId ? `/presensi/${sessionId}` : '/(tabs)/jadwal';
  }
  if (type === 'schedule_changed') {
    return sessionId ? `/sesi/${sessionId}` : '/(tabs)/jadwal';
  }
  if (type === 'leave_decided') {
    return '/(tabs)/izin';
  }

  return null;
}

// ======================================================
// 3. RECIPIENT RESOLUTION & CLASS ISOLATION (T-23)
// ======================================================

export async function getActiveClassMemberUids(
  classId: string,
  fallbackMembers: Praktikan[] = [],
): Promise<string[]> {
  const cleanClassId = classId.trim();
  if (!cleanClassId) return [];

  const db = getDb();
  if (db) {
    try {
      const q = query(
        collection(db, 'classMembers'),
        where('classId', '==', cleanClassId),
      );
      const snapshot = await getDocs(q);
      const uids = new Set<string>();
      for (const item of snapshot.docs) {
        const data = item.data() as Record<string, unknown>;
        if (
          data.active === true &&
          data.classId === cleanClassId &&
          typeof data.uid === 'string' &&
          data.uid.trim()
        ) {
          uids.add(data.uid.trim());
        }
      }
      return Array.from(uids);
    } catch {
      // Jatuh ke anggota lokal bila query Firestore gagal sementara
    }
  }

  const fallbackUids = new Set<string>();
  for (const member of fallbackMembers) {
    if (member.peran === 'praktikan' && isPraktikanInClass(member, cleanClassId)) {
      if (member.id.trim()) fallbackUids.add(member.id.trim());
    }
  }
  return Array.from(fallbackUids);
}

// ======================================================
// 4. AUDIT STORE (Firestore `notifications` + In-Memory)
// ======================================================

export function createInMemoryNotificationStore(
  seed: NotificationAuditRecord[] = [],
): NotificationAuditStore {
  let records: NotificationAuditRecord[] = seed.map((item) => ({
    ...item,
    data: { ...item.data },
  }));
  let seq = seed.length + 1;
  const listeners = new Map<string, Set<(items: NotificationAuditRecord[]) => void>>();

  const notifyUser = (uid: string) => {
    const bucket = listeners.get(uid);
    if (!bucket) return;
    const filtered = sortNotificationsNewestFirst(
      records.filter((item) => item.recipientUid === uid),
    ).map((item) => ({ ...item, data: { ...item.data } }));
    for (const listener of bucket) {
      listener(filtered);
    }
  };

  return {
    async record(entry) {
      const created: NotificationAuditRecord = {
        ...entry,
        id: `notif-${seq++}`,
        data: { ...entry.data },
        createdAt: new Date().toISOString(),
      };
      records = [created, ...records];
      notifyUser(created.recipientUid);
      return { ...created, data: { ...created.data } };
    },

    subscribeForUser(uid, onData) {
      const cleanUid = uid.trim();
      if (!cleanUid) {
        onData([]);
        return () => {};
      }
      let bucket = listeners.get(cleanUid);
      if (!bucket) {
        bucket = new Set();
        listeners.set(cleanUid, bucket);
      }
      bucket.add(onData);
      onData(
        sortNotificationsNewestFirst(
          records.filter((item) => item.recipientUid === cleanUid),
        ).map((item) => ({ ...item, data: { ...item.data } })),
      );
      return () => {
        const current = listeners.get(cleanUid);
        if (!current) return;
        current.delete(onData);
        if (current.size === 0) listeners.delete(cleanUid);
      };
    },
  };
}

export const defaultNotificationStore = createInMemoryNotificationStore();

function mapNotificationDoc(
  id: string,
  data: Record<string, unknown>,
): NotificationAuditRecord | null {
  const recipientUid =
    typeof data.recipientUid === 'string' ? data.recipientUid.trim() : '';
  const type = data.type;
  const paymentEvent = type === 'fine_created' || type === 'payment_success' || type === 'payment_failed';
  if (
    !recipientUid ||
    (type !== 'session_opened' &&
      type !== 'schedule_changed' &&
      type !== 'leave_decided' && !paymentEvent)
  ) {
    return null;
  }

  const rawData =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : {};
  const screen = paymentEvent ? 'denda' :
    rawData.screen === 'presensi' ||
    rawData.screen === 'sesi' ||
    rawData.screen === 'jadwal' ||
    rawData.screen === 'izin'
      ? rawData.screen
      : type === 'session_opened'
        ? 'presensi'
        : type === 'leave_decided'
          ? 'izin'
          : 'jadwal';

  const status: NotificationDeliveryStatus =
    data.status === 'delivered' || data.status === 'failed' || data.status === 'sent'
      ? data.status
      : 'sent';

  return {
    id,
    recipientUid,
    type,
    title: typeof data.title === 'string' ? data.title : 'Notifikasi Praktikum',
    body: typeof data.body === 'string' ? data.body : '',
    data: {
      type,
      screen,
      notificationId: id,
      ...(typeof rawData.sessionId === 'string' ? { sessionId: rawData.sessionId } : {}),
      ...(typeof rawData.classId === 'string' ? { classId: rawData.classId } : {}),
      ...(typeof rawData.scheduleId === 'string' ? { scheduleId: rawData.scheduleId } : {}),
      ...(typeof rawData.requestId === 'string' ? { requestId: rawData.requestId } : {}),
      ...(paymentEvent ? { tab: type === 'fine_created' ? 'aktif' : 'riwayat' } : {}),
      ...(typeof rawData.fineId === 'string' ? { fineId: rawData.fineId } : {}),
      ...(typeof rawData.orderId === 'string' ? { orderId: rawData.orderId } : {}),
    },
    status,
    createdAt: normalizeTimestamp(data.createdAt),
  };
}

const firestoreNotificationStore: NotificationAuditStore = {
  async record(entry) {
    const db = getDb();
    if (!db) {
      return defaultNotificationStore.record(entry);
    }
    const createdAtIso = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'notifications'), {
      recipientUid: entry.recipientUid,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      data: entry.data,
      status: entry.status,
      createdAt: serverTimestamp(),
    });
    return {
      ...entry,
      id: docRef.id,
      data: { ...entry.data, notificationId: docRef.id },
      createdAt: createdAtIso,
    };
  },

  subscribeForUser(uid, onData, onError) {
    const cleanUid = uid.trim();
    if (!cleanUid) {
      onData([]);
      return () => {};
    }
    const db = getDb();
    if (!db) {
      return defaultNotificationStore.subscribeForUser(cleanUid, onData, onError);
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', cleanUid),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationAuditRecord[] = [];
        for (const docSnap of snapshot.docs) {
          const mapped = mapNotificationDoc(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          );
          if (mapped) items.push(mapped);
        }
        onData(sortNotificationsNewestFirst(items));
      },
      (err) => {
        onError?.(
          err instanceof Error
            ? err
            : new Error('Gagal berlangganan notifikasi pengguna.'),
        );
      },
    );
  },
};

export function subscribeUserNotifications(
  uid: string,
  onData: (items: NotificationAuditRecord[]) => void,
  onError?: (error: Error) => void,
  auditStore?: NotificationAuditStore,
): Unsubscribe {
  const store = auditStore ?? firestoreNotificationStore;
  const unsubscribe = store.subscribeForUser(uid, onData, onError);
  if (auditStore) return unsubscribe;
  let active = true;
  let stopReplay: (() => void) | undefined;
  void import('@/services/payments/fineCreatedQueue').then(({ watchFineCreatedQueue }) => {
    if (active) stopReplay = watchFineCreatedQueue(uid);
  }).catch(() => {});
  return () => {
    active = false;
    stopReplay?.();
    unsubscribe();
  };
}

// ======================================================
// 5. EXPO PUSH API SENDER (Resilient & Batch-Safe)
// ======================================================

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  fetchFn: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined,
): Promise<ExpoPushSendSummary> {
  const deliveredTokens: string[] = [];
  const failedTokens: string[] = [];
  const invalidTokens: string[] = [];

  if (messages.length === 0) {
    return { deliveredTokens, failedTokens, invalidTokens };
  }

  const validMessages: ExpoPushMessage[] = [];
  for (const msg of messages) {
    if (!isExpoPushToken(msg.to)) {
      invalidTokens.push(msg.to);
      failedTokens.push(msg.to);
    } else {
      validMessages.push(msg);
    }
  }

  if (validMessages.length === 0 || !fetchFn) {
    for (const msg of validMessages) {
      failedTokens.push(msg.to);
    }
    return { deliveredTokens, failedTokens, invalidTokens };
  }

  for (let i = 0; i < validMessages.length; i += MAX_EXPO_BATCH_SIZE) {
    const chunk = validMessages.slice(i, i + MAX_EXPO_BATCH_SIZE);
    try {
      const response = await fetchFn(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        for (const msg of chunk) failedTokens.push(msg.to);
        continue;
      }

      const body = (await response.json()) as {
        data?: { status?: string; details?: { error?: string } }[];
      };
      const tickets = Array.isArray(body?.data) ? body.data : [];

      chunk.forEach((msg, index) => {
        const ticket = tickets[index];
        if (ticket?.status === 'ok') {
          deliveredTokens.push(msg.to);
        } else {
          failedTokens.push(msg.to);
          const errorCode = ticket?.details?.error;
          if (
            errorCode === 'DeviceNotRegistered' ||
            errorCode === 'InvalidCredentials'
          ) {
            invalidTokens.push(msg.to);
          }
        }
      });
    } catch {
      for (const msg of chunk) failedTokens.push(msg.to);
    }
  }

  return { deliveredTokens, failedTokens, invalidTokens };
}

// ======================================================
// 6. CORE DISPATCHER & 3 EVENT TRIGGERS (SRS-06)
// ======================================================

async function dispatchNotificationToUids(
  eventType: NotificationEventType,
  recipientUids: string[],
  payload: PushNotificationPayload,
  options: DispatchOptions = {},
): Promise<NotificationDispatchResult> {
  const uniqueUids = Array.from(
    new Set(recipientUids.map((u) => u.trim()).filter(Boolean)),
  );
  const auditStore = options.auditStore ?? firestoreNotificationStore;

  if (uniqueUids.length === 0) {
    return {
      eventType,
      payload,
      recipientUids: [],
      attemptedTokens: 0,
      deliveredTokens: 0,
      failedTokens: [],
      invalidTokens: [],
      auditRecordIds: [],
    };
  }

  const tokensByUid = await getUsersDeviceTokens(
    uniqueUids,
    options.tokenRepository,
  );

  const messages: ExpoPushMessage[] = [];
  const tokenToUid = new Map<string, string>();

  for (const uid of uniqueUids) {
    const records = tokensByUid.get(uid) ?? [];
    for (const record of records) {
      if (tokenToUid.has(record.token)) continue;
      tokenToUid.set(record.token, uid);
      messages.push({
        to: record.token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        priority: 'high',
        channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
      });
    }
  }

  const sendSummary = await sendExpoPushMessages(messages, options.fetchFn);
  const deliveredSet = new Set(sendSummary.deliveredTokens);
  const failedSet = new Set(sendSummary.failedTokens);

  const auditRecordIds: string[] = [];
  await Promise.all(
    uniqueUids.map(async (uid) => {
      const userTokens = tokensByUid.get(uid) ?? [];
      let status: NotificationDeliveryStatus = 'sent';
      if (userTokens.some((item) => deliveredSet.has(item.token))) {
        status = 'delivered';
      } else if (
        userTokens.length > 0 &&
        userTokens.every((item) => failedSet.has(item.token))
      ) {
        status = 'failed';
      }

      try {
        const audit = await auditStore.record({
          recipientUid: uid,
          type: eventType,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          status,
        });
        auditRecordIds.push(audit.id);
      } catch {
        // Jangan gagalkan pengiriman ke penerima lain jika audit satu dokumen gagal
      }
    }),
  );

  return {
    eventType,
    payload,
    recipientUids: uniqueUids,
    attemptedTokens: messages.length,
    deliveredTokens: sendSummary.deliveredTokens.length,
    failedTokens: sendSummary.failedTokens,
    invalidTokens: sendSummary.invalidTokens,
    auditRecordIds,
  };
}

/**
 * Peristiwa 1 (SRS-06): Sesi praktikum dibuka oleh asisten.
 * Mengirim notifikasi hanya ke praktikan anggota aktif kelas sesi terkait.
 */
export async function notifySessionOpened(
  input: SessionOpenedEventInput,
  options: DispatchOptions = {},
): Promise<NotificationDispatchResult> {
  const payload = buildSessionOpenedPayload(input);
  const recipientUids = options.resolveClassMemberUids
    ? await options.resolveClassMemberUids(input.classId)
    : await getActiveClassMemberUids(input.classId, options.fallbackMembers);

  return dispatchNotificationToUids('session_opened', recipientUids, payload, options);
}

/**
 * Peristiwa 2 (SRS-06): Jadwal atau waktu/ruang sesi diperbarui oleh asisten.
 * Mengirim notifikasi ke praktikan anggota aktif kelas terkait.
 */
export async function notifyScheduleChanged(
  input: ScheduleChangedEventInput,
  options: DispatchOptions = {},
): Promise<NotificationDispatchResult> {
  const payload = buildScheduleChangedPayload(input);
  const recipientUids = options.resolveClassMemberUids
    ? await options.resolveClassMemberUids(input.classId)
    : await getActiveClassMemberUids(input.classId, options.fallbackMembers);

  return dispatchNotificationToUids('schedule_changed', recipientUids, payload, options);
}

/**
 * Peristiwa 3 (SRS-06): Pengajuan izin praktikan diputuskan (disetujui/ditolak) oleh asisten.
 * Mengirim notifikasi khusus ke praktikan pemohon (`recipientUid`).
 */
export async function notifyLeaveDecided(
  input: LeaveDecidedEventInput,
  options: DispatchOptions = {},
): Promise<NotificationDispatchResult> {
  const payload = buildLeaveDecidedPayload(input);
  const recipientUids = input.recipientUid.trim() ? [input.recipientUid.trim()] : [];

  return dispatchNotificationToUids('leave_decided', recipientUids, payload, options);
}
