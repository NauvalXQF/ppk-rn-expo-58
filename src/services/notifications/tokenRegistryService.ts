import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

import { getDb } from '@/services/practicumService';
import type {
  DevicePlatform,
  DeviceTokenRecord,
  RegisterDeviceTokenInput,
} from '@/types/notification';

const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export interface TokenRegistryRepository {
  saveToken(input: RegisterDeviceTokenInput): Promise<DeviceTokenRecord>;
  removeToken(uid: string, token: string): Promise<void>;
  listTokens(uid: string): Promise<DeviceTokenRecord[]>;
}

export function isValidPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.trim().length >= 5;
}

export function isExpoPushToken(token: string): boolean {
  return EXPO_PUSH_TOKEN_PATTERN.test(token.trim());
}

/**
 * Mengubah token perangkat menjadi ID dokumen Firestore yang aman untuk path
 * `users/{uid}/devices/{token}`. Expo Push Token standar tidak mengandung `/`
 * sehingga tetap terbaca langsung sebagai ID dokumen.
 */
export function encodeDeviceTokenDocId(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Token perangkat tidak boleh kosong.');
  }
  const safe = trimmed.replace(/\//g, '__slash__');
  if (safe === '.' || safe === '..') {
    return `token_${encodeURIComponent(trimmed)}`;
  }
  return safe;
}

function normalizeTimestamp(raw: unknown, fallbackIso: string): string {
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
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
      return fallbackIso;
    }
  }
  return fallbackIso;
}

function normalizePlatform(raw: unknown): DevicePlatform {
  if (raw === 'android' || raw === 'ios' || raw === 'web') {
    return raw;
  }
  return 'android';
}

function mapDeviceTokenDoc(
  docId: string,
  data: Record<string, unknown>,
  nowIso: string,
): DeviceTokenRecord | null {
  const token =
    typeof data.token === 'string' && data.token.trim()
      ? data.token.trim()
      : docId.replace(/__slash__/g, '/');
  if (!isValidPushToken(token)) return null;

  return {
    token,
    platform: normalizePlatform(data.platform),
    deviceName:
      typeof data.deviceName === 'string' && data.deviceName.trim()
        ? data.deviceName.trim()
        : null,
    createdAt: normalizeTimestamp(data.createdAt, nowIso),
    lastActiveAt: normalizeTimestamp(data.lastActiveAt, nowIso),
  };
}

export function createInMemoryTokenRegistry(): TokenRegistryRepository {
  const store = new Map<string, Map<string, DeviceTokenRecord>>();

  return {
    async saveToken(input) {
      const uid = input.uid.trim();
      const token = input.token.trim();
      if (!uid) throw new Error('UID pengguna wajib diisi saat mendaftarkan token.');
      if (!isValidPushToken(token)) {
        throw new Error('Token perangkat push notification tidak valid.');
      }
      const docId = encodeDeviceTokenDocId(token);
      let userBucket = store.get(uid);
      if (!userBucket) {
        userBucket = new Map();
        store.set(uid, userBucket);
      }
      const nowIso = new Date().toISOString();
      const existing = userBucket.get(docId);
      const record: DeviceTokenRecord = {
        token,
        platform: input.platform,
        deviceName: input.deviceName?.trim() || null,
        createdAt: existing?.createdAt ?? nowIso,
        lastActiveAt: nowIso,
      };
      userBucket.set(docId, record);
      return { ...record };
    },

    async removeToken(uid, token) {
      const cleanUid = uid.trim();
      const cleanToken = token.trim();
      if (!cleanUid || !cleanToken) return;
      const userBucket = store.get(cleanUid);
      if (!userBucket) return;
      userBucket.delete(encodeDeviceTokenDocId(cleanToken));
      if (userBucket.size === 0) {
        store.delete(cleanUid);
      }
    },

    async listTokens(uid) {
      const cleanUid = uid.trim();
      if (!cleanUid) return [];
      const userBucket = store.get(cleanUid);
      if (!userBucket) return [];
      return Array.from(userBucket.values()).map((item) => ({ ...item }));
    },
  };
}

export function createFirestoreTokenRegistry(db: Firestore): TokenRegistryRepository {
  return {
    async saveToken(input) {
      const uid = input.uid.trim();
      const token = input.token.trim();
      if (!uid) throw new Error('UID pengguna wajib diisi saat mendaftarkan token.');
      if (!isValidPushToken(token)) {
        throw new Error('Token perangkat push notification tidak valid.');
      }

      const docId = encodeDeviceTokenDocId(token);
      const ref = doc(db, 'users', uid, 'devices', docId);
      const nowIso = new Date().toISOString();
      const cleanDeviceName = input.deviceName?.trim() || null;

      // Pertahankan `createdAt` asli saat perangkat mendaftar ulang agar sesuai data-model.md §2D.
      const existingSnap = await getDoc(ref).catch(() => null);
      const alreadyExists = Boolean(existingSnap?.exists());

      await setDoc(
        ref,
        {
          token,
          platform: input.platform,
          deviceName: cleanDeviceName,
          lastActiveAt: serverTimestamp(),
          ...(alreadyExists ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      return {
        token,
        platform: input.platform,
        deviceName: cleanDeviceName,
        createdAt: alreadyExists
          ? normalizeTimestamp(
              (existingSnap?.data() as Record<string, unknown> | undefined)
                ?.createdAt,
              nowIso,
            )
          : nowIso,
        lastActiveAt: nowIso,
      };
    },

    async removeToken(uid, token) {
      const cleanUid = uid.trim();
      const cleanToken = token.trim();
      if (!cleanUid || !cleanToken) return;
      const docId = encodeDeviceTokenDocId(cleanToken);
      const ref = doc(db, 'users', cleanUid, 'devices', docId);
      await deleteDoc(ref);
    },

    async listTokens(uid) {
      const cleanUid = uid.trim();
      if (!cleanUid) return [];
      const colRef = collection(db, 'users', cleanUid, 'devices');
      const snap = await getDocs(colRef);
      const nowIso = new Date().toISOString();
      const results: DeviceTokenRecord[] = [];
      for (const item of snap.docs) {
        const mapped = mapDeviceTokenDoc(
          item.id,
          item.data() as Record<string, unknown>,
          nowIso,
        );
        if (mapped) results.push(mapped);
      }
      return results;
    },
  };
}

export const defaultInMemoryTokenRegistry = createInMemoryTokenRegistry();

function resolveTokenRepository(
  repository?: TokenRegistryRepository,
): TokenRegistryRepository {
  if (repository) return repository;
  const db = getDb();
  return db ? createFirestoreTokenRegistry(db) : defaultInMemoryTokenRegistry;
}

export async function registerDeviceToken(
  input: RegisterDeviceTokenInput,
  repository?: TokenRegistryRepository,
): Promise<DeviceTokenRecord> {
  return resolveTokenRepository(repository).saveToken(input);
}

export async function unregisterDeviceToken(
  uid: string,
  token: string,
  repository?: TokenRegistryRepository,
): Promise<void> {
  return resolveTokenRepository(repository).removeToken(uid, token);
}

export async function getUserDeviceTokens(
  uid: string,
  repository?: TokenRegistryRepository,
): Promise<DeviceTokenRecord[]> {
  return resolveTokenRepository(repository).listTokens(uid);
}

export async function getUsersDeviceTokens(
  uids: string[],
  repository?: TokenRegistryRepository,
): Promise<Map<string, DeviceTokenRecord[]>> {
  const repo = resolveTokenRepository(repository);
  const uniqueUids = Array.from(
    new Set(uids.map((u) => u.trim()).filter(Boolean)),
  );
  const tokenMap = new Map<string, DeviceTokenRecord[]>();

  await Promise.all(
    uniqueUids.map(async (uid) => {
      try {
        const tokens = await repo.listTokens(uid);
        tokenMap.set(uid, tokens);
      } catch {
        tokenMap.set(uid, []);
      }
    }),
  );

  return tokenMap;
}
