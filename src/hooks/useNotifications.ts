import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { resolvePaymentNotificationRoute } from '@/services/payments/paymentData';
import {
  resolveNotificationRoute,
  subscribeUserNotifications,
} from '@/services/notifications/notificationDispatcher';
import {
  configureNotificationHandler,
  getNotificationPermissionStatus,
  openNotificationSettings,
  presentLocalNotification,
  registerUserDeviceForNotifications,
  setupAndroidNotificationChannel,
} from '@/services/notifications/notificationService';
import type {
  NotificationAuditRecord,
  NotificationDataPayload,
  NotificationPermissionStatus,
} from '@/types/notification';

export type TokenRegistrationState =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'unavailable'
  | 'denied';

export interface NotificationContextValue {
  permissionStatus: NotificationPermissionStatus;
  canAskAgain: boolean;
  deviceToken: string | null;
  tokenState: TokenRegistrationState;
  statusMessage: string | null;
  notifications: NotificationAuditRecord[];
  unreadCount: number;
  requestAndRegister: () => Promise<void>;
  openSettings: () => Promise<void>;
  markAllAsRead: () => void;
  markAsRead: (notificationId: string) => void;
  navigateFromNotification: (
    data: Partial<NotificationDataPayload> | Record<string, unknown> | null | undefined,
  ) => boolean;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

export function NotificationProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { status: authStatus, pengguna } = useAuth();

  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>(
      Platform.OS === 'web' ? 'unsupported' : 'undetermined',
    );
  const [canAskAgain, setCanAskAgain] = useState(Platform.OS !== 'web');
  const [deviceTokenState, setDeviceTokenState] = useState<{
    uid: string | null;
    token: string | null;
    state: TokenRegistrationState;
    message: string | null;
  }>({
    uid: null,
    token: null,
    state: 'idle',
    message: null,
  });
  const [notificationFeed, setNotificationFeed] = useState<{
    uid: string | null;
    items: NotificationAuditRecord[];
  }>({
    uid: null,
    items: [],
  });
  const [readState, setReadState] = useState<{
    uid: string | null;
    ids: Set<string>;
  }>({
    uid: null,
    ids: new Set(),
  });

  const activeUid = authStatus === 'masuk' ? pengguna?.uid ?? null : null;
  const role = pengguna?.role;
  const activeUidRef = useRef<string | null>(activeUid);
  useEffect(() => {
    activeUidRef.current = activeUid;
  }, [activeUid]);
  const deviceToken =
    activeUid && deviceTokenState.uid === activeUid ? deviceTokenState.token : null;
  const tokenState: TokenRegistrationState =
    activeUid && deviceTokenState.uid === activeUid ? deviceTokenState.state : 'idle';
  const statusMessage =
    activeUid && deviceTokenState.uid === activeUid ? deviceTokenState.message : null;
  const notifications = useMemo(
    () =>
      activeUid && notificationFeed.uid === activeUid ? notificationFeed.items : [],
    [activeUid, notificationFeed],
  );
  const readIds = useMemo(
    () => (activeUid && readState.uid === activeUid ? readState.ids : new Set<string>()),
    [activeUid, readState],
  );

  const handledResponseIdsRef = useRef<Set<string>>(new Set());
  const receivedNotificationIdsRef = useRef<Set<string>>(new Set());
  const pendingRouteRef = useRef<{ route: string; payment: boolean; recipientUid: unknown } | null>(null);
  const initialSnapshotLoadedRef = useRef(false);
  const knownAuditIdsRef = useRef<Set<string>>(new Set());

  const navigateFromNotification = useCallback(
    (
      data:
        | Partial<NotificationDataPayload>
        | Record<string, unknown>
        | null
        | undefined,
    ): boolean => {
      const route = resolveNotificationRoute(data);
      if (!route) return false;
      const payment = resolvePaymentNotificationRoute(data) !== null;
      const recipientUid = data && 'recipientUid' in data ? data.recipientUid : undefined;

      if (authStatus !== 'masuk') {
        pendingRouteRef.current = { route, payment, recipientUid };
        return false;
      }

      pendingRouteRef.current = null;
      if (payment && (role !== 'praktikan' ||
        (recipientUid !== undefined && recipientUid !== activeUid))) return false;
      router.push(route as Href);
      return true;
    },
    [authStatus, role, activeUid, router],
  );

  // Jalankan rute deep-link yang tertunda setelah pemulihan autentikasi selesai.
  useEffect(() => {
    if (authStatus === 'masuk' && pendingRouteRef.current) {
      const target = pendingRouteRef.current;
      pendingRouteRef.current = null;
      if (!target.payment || (role === 'praktikan' &&
        (target.recipientUid === undefined || target.recipientUid === activeUid))) {
        router.push(target.route as Href);
      }
    }
  }, [authStatus, role, activeUid, router]);

  // Setup foreground handler, Android channel, dan listener interaksi notifikasi (SRS-06 & SRS-08).
  useEffect(() => {
    configureNotificationHandler();
    setupAndroidNotificationChannel().catch(() => {});

    getNotificationPermissionStatus()
      .then((perm) => {
        setPermissionStatus(perm.status);
        setCanAskAgain(perm.canAskAgain);
      })
      .catch(() => {});

    if (Platform.OS === 'web') {
      return;
    }

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const responseId = typeof data?.notificationId === 'string'
        ? data.notificationId : response.notification.request.identifier;
      if (handledResponseIdsRef.current.has(responseId)) return;
      handledResponseIdsRef.current.add(responseId);
      if (typeof data?.notificationId === 'string') {
        const notifId = data.notificationId;
        setReadState((prev) => {
          const nextIds = new Set(prev.ids);
          nextIds.add(notifId);
          return { uid: prev.uid ?? activeUidRef.current, ids: nextIds };
        });
      }
      navigateFromNotification(data);

      if (typeof Notifications.clearLastNotificationResponse === 'function') {
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          // Abaikan bila platform belum mendukung pembersihan respons terakhir.
        }
      }
    };

    // Tangani cold-start ketika aplikasi dibuka melalui ketukan notifikasi.
    try {
      if (typeof Notifications.getLastNotificationResponse === 'function') {
        handleResponse(Notifications.getLastNotificationResponse());
      }
    } catch {
      // Abaikan kegagalan pembacaan respons awal.
    }

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (typeof data?.notificationId === 'string') {
          receivedNotificationIdsRef.current.add(data.notificationId);
        }
      },
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleResponse(response);
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [navigateFromNotification]);

  const registerCurrentUser = useCallback(
    async (uid: string, requestIfNeeded: boolean) => {
      setDeviceTokenState({
        uid,
        token: null,
        state: 'registering',
        message: null,
      });
      try {
        const result = await registerUserDeviceForNotifications(uid, {
          requestIfNeeded,
        });
        setPermissionStatus(result.permissionStatus);
        setCanAskAgain(result.canAskAgain);

        if (result.token) {
          setDeviceTokenState({
            uid,
            token: result.token,
            state: 'registered',
            message: result.reason ?? null,
          });
        } else if (result.permissionStatus === 'denied') {
          setDeviceTokenState({
            uid,
            token: null,
            state: 'denied',
            message: result.reason ?? null,
          });
        } else {
          setDeviceTokenState({
            uid,
            token: null,
            state: 'unavailable',
            message: result.reason ?? null,
          });
        }
      } catch (err) {
        setDeviceTokenState({
          uid,
          token: null,
          state: 'unavailable',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal mendaftarkan layanan notifikasi perangkat.',
        });
      }
    },
    [],
  );

  // Daftarkan token perangkat otomatis saat pengguna login (SRS-07 AC-1).
  useEffect(() => {
    if (!activeUid) {
      initialSnapshotLoadedRef.current = false;
      knownAuditIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    registerUserDeviceForNotifications(activeUid, { requestIfNeeded: true })
      .then((result) => {
        if (cancelled) return;
        setPermissionStatus(result.permissionStatus);
        setCanAskAgain(result.canAskAgain);
        setDeviceTokenState({
          uid: activeUid,
          token: result.token,
          state: result.token
            ? 'registered'
            : result.permissionStatus === 'denied'
              ? 'denied'
              : 'unavailable',
          message: result.reason ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setDeviceTokenState({
          uid: activeUid,
          token: null,
          state: 'unavailable',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal mendaftarkan layanan notifikasi perangkat.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeUid]);

  // Langganan riwayat notifikasi pengguna real-time (untuk NotificationBell + fallback lokal).
  useEffect(() => {
    if (!activeUid) {
      return;
    }

    initialSnapshotLoadedRef.current = false;
    knownAuditIdsRef.current = new Set();

    const unsubscribe = subscribeUserNotifications(
      activeUid,
      (items) => {
        setNotificationFeed({ uid: activeUid, items });

        if (!initialSnapshotLoadedRef.current) {
          initialSnapshotLoadedRef.current = true;
          knownAuditIdsRef.current = new Set(items.map((item) => item.id));
          return;
        }

        for (const item of items) {
          if (knownAuditIdsRef.current.has(item.id)) continue;
          knownAuditIdsRef.current.add(item.id);
          if (resolvePaymentNotificationRoute({ type: item.type })) continue;

          // Jika push remote belum masuk di perangkat ini (mis. emulator atau jaringan lambat),
          // tampilkan notifikasi lokal sekali saja tanpa duplikasi.
          if (
            !receivedNotificationIdsRef.current.has(item.id) &&
            item.status !== 'delivered'
          ) {
            receivedNotificationIdsRef.current.add(item.id);
            presentLocalNotification({
              title: item.title,
              body: item.body,
              data: { ...item.data, notificationId: item.id },
            }).catch(() => {});
          }
        }
      },
      () => {
        // Jangan ganggu antarmuka jika listener notifikasi sementara gagal.
      },
    );

    return unsubscribe;
  }, [activeUid]);

  const requestAndRegister = useCallback(async () => {
    if (!activeUid) return;
    await registerCurrentUser(activeUid, true);
  }, [activeUid, registerCurrentUser]);

  const openSettings = useCallback(async () => {
    await openNotificationSettings();
  }, []);

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!activeUid) return;
      setReadState((prev) => {
        const base = prev.uid === activeUid ? prev.ids : new Set<string>();
        if (base.has(notificationId)) return prev;
        const next = new Set(base);
        next.add(notificationId);
        return { uid: activeUid, ids: next };
      });
    },
    [activeUid],
  );

  const markAllAsRead = useCallback(() => {
    if (!activeUid) return;
    setReadState({
      uid: activeUid,
      ids: new Set(notifications.map((item) => item.id)),
    });
  }, [activeUid, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)).length,
    [notifications, readIds],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      permissionStatus,
      canAskAgain,
      deviceToken,
      tokenState,
      statusMessage,
      notifications: notifications.map((item) => ({
        ...item,
        read: readIds.has(item.id),
      })),
      unreadCount,
      requestAndRegister,
      openSettings,
      markAllAsRead,
      markAsRead,
      navigateFromNotification,
    }),
    [
      permissionStatus,
      canAskAgain,
      deviceToken,
      tokenState,
      statusMessage,
      notifications,
      readIds,
      unreadCount,
      requestAndRegister,
      openSettings,
      markAllAsRead,
      markAsRead,
      navigateFromNotification,
    ],
  );

  return React.createElement(NotificationContext.Provider, { value }, children);
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications harus dipakai di dalam NotificationProvider.',
    );
  }
  return context;
}
