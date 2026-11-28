import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Konfigurasi Firebase diambil dari environment variable EXPO_PUBLIC_*.
 * Salin `.env.example` menjadi `.env` lalu isi nilainya.
 * Nilai konfigurasi klien Firebase bukan rahasia; keamanan data dijaga
 * oleh Authentication dan Security Rules (firestore.rules).
 *
 * Modul ini sengaja bebas dari import `react-native` agar dapat dipakai bersama
 * oleh `src/config/firebase.ts`, seluruh service Firestore, serta unit test Node.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const PESAN_CONFIG =
  'Firebase belum dikonfigurasi. Salin .env.example menjadi .env lalu isi nilainya.';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function hasConfiguredFirebaseApp(): boolean {
  return isFirebaseConfigured || getApps().length > 0;
}

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }
  if (!isFirebaseConfigured) {
    throw new Error(PESAN_CONFIG);
  }
  app = initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseDb(): Firestore {
  if (db) return db;
  db = getFirestore(getFirebaseApp());
  return db;
}

if (isFirebaseConfigured) {
  getFirebaseDb();
}
