import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import {
  ANDROID_NOTIFICATION_CHANNEL_ID,
} from '@/services/notifications/notificationDispatcher';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '@/services/notifications/tokenRegistryService';
import type {
  DevicePlatform,
  NotificationPermissionStatus,
  PushNotificationPayload,
} from '@/types/notification';

const REGISTERED_TOKEN_STORAGE_KEY = '@ppk/registered_push_token_v1';

interface StoredTokenEntry {
  uid: string;
  token: string;
}

export interface NotificationPermissionResult {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
}

export interface DeviceTokenAcquisitionResult {
  token: string | null;
  platform: DevicePlatform;
  deviceName: string | null;
  permissionStatus: NotificationPermissionStatus;
  canAskAgain: boolean;
  reason?: string;
}

let handlerConfigured = false;
let channelConfigured = false;
let activeRegisteredToken: StoredTokenEntry | null = null;

function resolvePlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'web') return 'web';
  return 'android';
}

function resolveEasProjectId(): string | undefined {
  const fromExpoConfig = (
    Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined
  )?.eas?.projectId;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
    return fromExpoConfig.trim();
  }
  const fromEasConfig = (
    Constants as { easConfig?: { projectId?: unknown } }
  ).easConfig?.projectId;
  if (typeof fromEasConfig === 'string' && fromEasConfig.trim()) {
    return fromEasConfig.trim();
  }
  return undefined;
}

function mapPermissionStatus(
  status: Notifications.PermissionStatus | string | undefined,
): NotificationPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

async function persistRegisteredToken(entry: StoredTokenEntry | null): Promise<void> {
  activeRegisteredToken = entry;
  try {
    if (!entry) {
      await AsyncStorage.removeItem(REGISTERED_TOKEN_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(
        REGISTERED_TOKEN_STORAGE_KEY,
        JSON.stringify(entry),
      );
    }
  } catch {
    // Abaikan kegagalan cache lokal; memori proses tetap menyimpan entry aktif.
  }
}

async function loadPersistedRegisteredToken(): Promise<StoredTokenEntry | null> {
  if (activeRegisteredToken) return activeRegisteredToken;
  try {
    const raw = await AsyncStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTokenEntry>;
    if (typeof parsed.uid === 'string' && typeof parsed.token === 'string') {
      activeRegisteredToken = { uid: parsed.uid, token: parsed.token };
      return activeRegisteredToken;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Mengonfigurasi foreground notification handler sesuai Expo SDK 58
 * agar notifikasi tetap tampil berupa banner, daftar, suara, dan badge.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  } catch {
    // Hindari crash di lingkungan yang belum mendukung modul native notifikasi.
  }
}

/**
 * Mengonfigurasi Android Notification Channel dengan suara, getaran, dan prioritas tinggi.
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (channelConfigured || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(
      ANDROID_NOTIFICATION_CHANNEL_ID,
      {
        name: 'Kegiatan Praktikum',
        description:
          'Pemberitahuan pembukaan sesi praktikum, perubahan jadwal, dan keputusan izin.',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1A56DB',
        sound: 'default',
        enableVibrate: true,
      },
    );
    channelConfigured = true;
  } catch {
    // Jangan gagalkan startup aplikasi bila channel belum tersedia.
  }
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', canAskAgain: false };
  }
  try {
    const result = await Notifications.getPermissionsAsync();
    return {
      status: mapPermissionStatus(result.status),
      canAskAgain: Boolean(result.canAskAgain),
    };
  } catch {
    return { status: 'unsupported', canAskAgain: false };
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', canAskAgain: false };
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      return { status: 'granted', canAskAgain: Boolean(existing.canAskAgain) };
    }
    const requested = await Notifications.requestPermissionsAsync();
    return {
      status: mapPermissionStatus(requested.status),
      canAskAgain: Boolean(requested.canAskAgain),
    };
  } catch {
    return { status: 'unsupported', canAskAgain: false };
  }
}

export async function acquireDevicePushToken(
  options: { requestIfNeeded?: boolean } = {},
): Promise<DeviceTokenAcquisitionResult> {
  const platform = resolvePlatform();
  const deviceName =
    Device.deviceName ?? Device.modelName ?? (platform === 'web' ? 'Web Browser' : null);

  if (Platform.OS === 'web') {
    return {
      token: null,
      platform,
      deviceName,
      permissionStatus: 'unsupported',
      canAskAgain: false,
      reason:
        'Push notification native hanya tersedia pada perangkat Android/iOS.',
    };
  }

  await setupAndroidNotificationChannel();

  const perm = options.requestIfNeeded
    ? await requestNotificationPermission()
    : await getNotificationPermissionStatus();

  if (perm.status !== 'granted') {
    return {
      token: null,
      platform,
      deviceName,
      permissionStatus: perm.status,
      canAskAgain: perm.canAskAgain,
      reason:
        perm.status === 'denied'
          ? 'Izin notifikasi ditolak oleh pengguna.'
          : 'Izin notifikasi belum diberikan.',
    };
  }

  if (!Device.isDevice) {
    return {
      token: null,
      platform,
      deviceName,
      permissionStatus: 'granted',
      canAskAgain: perm.canAskAgain,
      reason:
        'Emulator/simulator tidak menyediakan Expo Push Token; notifikasi in-app lokal tetap aktif.',
    };
  }

  try {
    const projectId = resolveEasProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse?.data?.trim() || null;
    if (!token) {
      return {
        token: null,
        platform,
        deviceName,
        permissionStatus: 'granted',
        canAskAgain: perm.canAskAgain,
        reason: 'Token push perangkat tidak tersedia dari layanan Expo.',
      };
    }
    return {
      token,
      platform,
      deviceName,
      permissionStatus: 'granted',
      canAskAgain: perm.canAskAgain,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Gagal mengambil token push.';
    return {
      token: null,
      platform,
      deviceName,
      permissionStatus: 'granted',
      canAskAgain: perm.canAskAgain,
      reason: detail,
    };
  }
}

/**
 * Mendaftarkan token push perangkat ke Firestore (`users/{uid}/devices/{token}`)
 * saat pengguna login atau saat pengguna mengaktifkan izin notifikasi.
 */
export async function registerUserDeviceForNotifications(
  uid: string,
  options: { requestIfNeeded?: boolean } = { requestIfNeeded: true },
): Promise<DeviceTokenAcquisitionResult> {
  const cleanUid = uid.trim();
  const acquired = await acquireDevicePushToken(options);

  if (!cleanUid || !acquired.token) {
    return acquired;
  }

  try {
    // Jika sebelumnya perangkat terdaftar pada akun berbeda, bersihkan terlebih dahulu
    const previous = await loadPersistedRegisteredToken();
    if (previous && previous.uid !== cleanUid && previous.token === acquired.token) {
      await unregisterDeviceToken(previous.uid, previous.token).catch(() => {});
    }

    await registerDeviceToken({
      uid: cleanUid,
      token: acquired.token,
      platform: acquired.platform,
      deviceName: acquired.deviceName,
    });
    await persistRegisteredToken({ uid: cleanUid, token: acquired.token });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : 'Gagal menyimpan token perangkat ke Firestore.';
    return {
      ...acquired,
      reason: detail,
    };
  }

  return acquired;
}

/**
 * Menghapus token perangkat dari Firestore (`users/{uid}/devices/{token}`)
 * sebelum sesi Firebase Auth dicabut saat logout (SRS-07 AC-3).
 */
export async function unregisterUserDeviceForNotifications(
  uid?: string | null,
): Promise<void> {
  try {
    const stored = await loadPersistedRegisteredToken();
    const targetUid = uid?.trim() || stored?.uid || '';
    const targetToken = stored?.token || '';

    if (targetUid && targetToken) {
      await unregisterDeviceToken(targetUid, targetToken).catch(() => {});
    }
  } finally {
    await persistRegisteredToken(null);
  }
}

/**
 * Menampilkan notifikasi lokal instan pada perangkat native (sebagai fallback
 * foreground/emulator ketika event masuk dari Firestore dan belum ditampilkan remote push).
 */
export async function presentLocalNotification(
  payload: PushNotificationPayload,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const perm = await getNotificationPermissionStatus();
    if (perm.status !== 'granted') return;

    await setupAndroidNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: { ...payload.data },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Jangan sebabkan unhandled rejection saat penjadwalan lokal gagal.
  }
}

export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Abaikan jika OS tidak mendukung pembukaan halaman pengaturan.
  }
}
