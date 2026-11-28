import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import {
  getFirebaseApp,
  getFirebaseDb,
  isFirebaseConfigured,
  PESAN_CONFIG,
} from '@/config/firebaseApp';

export { getFirebaseApp, getFirebaseDb, isFirebaseConfigured };

let auth: Auth | null = null;

if (isFirebaseConfigured) {
  const app = getFirebaseApp();

  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      // AsyncStorage membuat sesi login bertahan setelah aplikasi ditutup.
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Fast Refresh bisa mengeksekusi modul ini ulang; auth sudah terinisialisasi.
      auth = getAuth(app);
    }
  }
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error(PESAN_CONFIG);
  return auth;
}
