import { applicationDefault, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const appName = 'ppk-local-backend';

const invalidTokenCodes = new Set([
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export interface FirebaseIdentityAdapter {
  verifyIdToken(token: string): Promise<{ uid: string } | null>;
  readUserProfile(uid: string): Promise<unknown>;
}

export function initializeFirebaseAdmin(projectId: string) {
  const app = getApps().find((existing) => existing.name === appName)
    ?? initializeApp({ projectId, credential: applicationDefault() }, appName);
  if (app.options.projectId !== projectId) {
    throw new Error('Firebase Admin is already initialized for another project.');
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const identity: FirebaseIdentityAdapter = {
    async verifyIdToken(token) {
      try {
        const { uid } = await auth.verifyIdToken(token, true);
        return { uid };
      } catch (error) {
        if (isInvalidToken(error)) return null;
        throw error;
      }
    },
    async readUserProfile(uid) {
      const profile = await firestore.collection('users').doc(uid).get();
      return profile.data();
    },
  };

  return { auth, firestore, identity, close: () => deleteApp(app) };
}

function isInvalidToken(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' && invalidTokenCodes.has(error.code);
}
