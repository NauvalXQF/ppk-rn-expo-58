import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Konfigurasi Firebase diambil dari environment variable EXPO_PUBLIC_*.
 * Salin `.env.example` menjadi `.env` lalu isi nilainya.
 * Nilai konfigurasi klien Firebase bukan rahasia; keamanan data dijaga
 * oleh Authentication dan Security Rules (firestore.rules).
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

const PESAN_CONFIG =
  'Firebase belum dikonfigurasi. Salin .env.example menjadi .env lalu isi nilainya.';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

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

  db = getFirestore(app);
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error(PESAN_CONFIG);
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) throw new Error(PESAN_CONFIG);
  return db;
}
