export type NotificationEventType =
  | 'session_opened'
  | 'schedule_changed'
  | 'leave_decided';

export type NotificationScreenTarget =
  | 'presensi'
  | 'sesi'
  | 'jadwal'
  | 'izin';

export type NotificationDeliveryStatus = 'sent' | 'delivered' | 'failed';

export type DevicePlatform = 'android' | 'ios' | 'web';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

export interface NotificationDataPayload {
  type: NotificationEventType;
  screen: NotificationScreenTarget;
  sessionId?: string;
  classId?: string;
  scheduleId?: string;
  requestId?: string;
  notificationId?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data: NotificationDataPayload;
}

export interface DeviceTokenRecord {
  token: string;
  platform: DevicePlatform;
  deviceName: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface RegisterDeviceTokenInput {
  uid: string;
  token: string;
  platform: DevicePlatform;
  deviceName?: string | null;
}

export interface NotificationAuditRecord {
  id: string;
  recipientUid: string;
  type: NotificationEventType;
  title: string;
  body: string;
  data: NotificationDataPayload;
  status: NotificationDeliveryStatus;
  createdAt: string;
  read?: boolean;
}

export interface SessionOpenedEventInput {
  sessionId: string;
  classId: string;
  topik: string;
  labNama?: string;
  ruang?: string;
}

export interface ScheduleChangedEventInput {
  classId: string;
  sessionId?: string;
  scheduleId?: string;
  mataKuliah?: string;
  topik: string;
  ruang: string;
  waktu: string;
}

export interface LeaveDecidedEventInput {
  requestId: string;
  recipientUid: string;
  decision: 'approved' | 'rejected';
  sessionId?: string;
  sessionTopic?: string;
  decisionNote?: string | null;
}

export interface NotificationDispatchResult {
  eventType: NotificationEventType;
  payload: PushNotificationPayload;
  recipientUids: string[];
  attemptedTokens: number;
  deliveredTokens: number;
  failedTokens: string[];
  invalidTokens: string[];
  auditRecordIds: string[];
}
