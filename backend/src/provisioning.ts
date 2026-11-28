import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Router } from 'express';
import { HttpError } from './middleware/errorHandler.ts';
import { verifyFirebaseToken, type AuthenticatedUser } from './middleware/verifyFirebaseToken.ts';
import type { FirebaseIdentityAdapter } from './config/firebaseAdmin.ts';

type Row = { rowId: string; role: 'praktikan' | 'asprak'; email: string; nama: string; identity: string };
type Account = { uid: string; email?: string; disabled?: boolean };
type Profile = { uid: string; role: string; email: string; nama: string; nim?: string; nip?: string;
  provisioningActivationPending?: boolean };
type Result = { rowId: string; outcome: 'created' | 'existing' | 'conflict' | 'error'; uid?: string; code?: string };
type ScopeError = 'COURSE_NOT_FOUND' | 'COURSE_INACTIVE'
  | 'LAB_UNAVAILABLE' | 'LAB_INACTIVE' | 'CLASS_UNAVAILABLE' | 'CLASS_INVALID';
interface ProvisioningStore {
  validateScope(courseId: string, labId: string): Promise<ScopeError | undefined>;
  findAccount(email: string): Promise<Account | undefined>;
  readProfile(uid: string): Promise<Partial<Profile> | undefined>;
  identityInUse(row: Row, uid?: string): Promise<boolean>;
  reserve(row: Row, existingUid?: string): Promise<string | undefined>;
  createAccount(uid: string, row: Row): Promise<Account>;
  createProfile(uid: string, profile: Profile): Promise<void>;
  enableAccount(uid: string): Promise<void>;
  completeActivation(uid: string): Promise<void>;
}

export function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function docId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[/\\\x00-\x1f]/.test(value)
    && value !== '.' && value !== '..' && !/^__.*__$/.test(value);
}

function parseRow(input: Record<string, unknown>, rowId: string): Row | undefined {
  const { role } = input;
  if (role !== 'praktikan' && role !== 'asprak') return;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
  const raw = role === 'praktikan' ? input.nim : input.nip;
  const identity = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || nama.length < 2 || nama.length > 120 || !/^[A-Za-z0-9-]{2,32}$/.test(identity)) return;
  return { rowId, role, email, nama, identity };
}

async function provisionRow(row: Row, store: ProvisioningStore, allowCreate: boolean): Promise<Result> {
  const { rowId, email, identity, role, nama } = row;
  const field = role === 'praktikan' ? 'nim' : 'nip';
  const account = await store.findAccount(email);
  const profile = account && await store.readProfile(account.uid);
  if (account && profile) {
    if (profile.uid !== account.uid || account.email?.toLowerCase() !== email || profile.email?.toLowerCase() !== email) {
      return { rowId, outcome: 'conflict', code: 'PROFILE_REVIEW_REQUIRED' };
    }
    if (profile.role !== role && !(profile.role === 'asisten' && role === 'asprak')) {
      return { rowId, outcome: 'conflict', code: 'ROLE_MISMATCH' };
    }
    const currentIdentity = profile[field];
    if (currentIdentity == null || (typeof currentIdentity === 'string' && !currentIdentity.trim())) {
      // Baris CSV dan alamat email saja tidak membuktikan identitas akademik akun lama.
      return { rowId, outcome: 'conflict', code: 'IDENTITY_REVIEW_REQUIRED' };
    }
    if (currentIdentity !== identity) {
      return { rowId, outcome: 'conflict', code: 'IDENTITY_MISMATCH' };
    }
    if (await store.identityInUse(row, account.uid)) {
      return { rowId, outcome: 'conflict', code: 'IDENTITY_IN_USE' };
    }
    if (profile.provisioningActivationPending !== true) {
      return account.disabled
        ? { rowId, outcome: 'conflict', code: 'ACCOUNT_DISABLED' }
        : { rowId, outcome: 'existing', uid: account.uid };
    }
  }
  if (!allowCreate) return { rowId, outcome: 'error', code: account ? 'PROFILE_REVIEW_REQUIRED' : 'ACCOUNT_CREATION_DISABLED' };
  if (await store.identityInUse(row, account?.uid)) return { rowId, outcome: 'conflict', code: 'IDENTITY_IN_USE' };
  const uid = await store.reserve(row, account?.uid);
  if (!uid || (account && (account.uid !== uid || account.email?.toLowerCase() !== email))) {
    return { rowId, outcome: 'conflict', code: 'ACCOUNT_RESERVATION_CONFLICT' };
  }
  const created = account ?? await store.createAccount(uid, row);
  if (created.uid !== uid || created.email?.toLowerCase() !== email) {
    return { rowId, outcome: 'conflict', code: 'ACCOUNT_RESERVATION_CONFLICT' };
  }
  if (!profile) await store.createProfile(uid, { uid, role, email, nama, [field]: identity,
    provisioningActivationPending: true });
  if (created.disabled) await store.enableAccount(uid);
  await store.completeActivation(uid);
  return { rowId, outcome: 'created', uid };
}

export async function provisionUsers(actor: AuthenticatedUser, input: unknown, store: ProvisioningStore, allowCreate = false) {
  const { courseId, labId, users } = object(input);
  if (actor.role !== 'aslab') throw new HttpError('FORBIDDEN');
  if (!docId(courseId) || !docId(labId) || !Array.isArray(users) || !users.length || users.length > 100) {
    throw new HttpError('INVALID_INPUT');
  }
  if (!actor.managedCourseIds.includes(courseId)) throw new HttpError('COURSE_FORBIDDEN');
  const scopeError = await store.validateScope(courseId, labId);
  if (scopeError) throw new HttpError(scopeError);
  const rowIds = users.map((user) => object(user).rowId);
  if (rowIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 80) || new Set(rowIds).size !== users.length) {
    throw new HttpError('INVALID_INPUT');
  }
  const seen = new Set<string>();
  const results: Result[] = [];
  for (const [index, entry] of users.entries()) {
    const rowId = rowIds[index] as string;
    const row = parseRow(object(entry), rowId);
    if (!row) { results.push({ rowId, outcome: 'error', code: 'INVALID_ROW' }); continue; }
    const identityKey = row.role + ':' + row.identity;
    if (seen.has(row.email) || seen.has(identityKey)) {
      results.push({ rowId, outcome: 'conflict', code: 'DUPLICATE_ROW' });
      continue;
    }
    seen.add(row.email);
    seen.add(identityKey);
    try {
      results.push(await provisionRow(row, store, allowCreate));
    } catch (error) {
      const code = object(error).code;
      results.push(code === 'auth/email-already-exists' || code === 'auth/uid-already-exists'
        ? { rowId, outcome: 'conflict', code: 'ACCOUNT_CHANGED_RETRY' }
        : { rowId, outcome: 'error', code: 'PROVISIONING_RETRY' });
    }
  }
  return results;
}

function reservationId(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function firebaseProvisioningStore(auth: Auth, db: Firestore): ProvisioningStore {
  return {
    async validateScope(courseId, labId) {
      const course = await db.doc('courses/' + courseId).get();
      if (!course.exists) return 'COURSE_NOT_FOUND';
      if (course.get('aktif') !== true) return 'COURSE_INACTIVE';
      const lab = await db.doc('laboratories/' + labId).get();
      if (!lab.exists || lab.get('courseId') !== courseId) return 'LAB_UNAVAILABLE';
      if (lab.get('aktif') !== true) return 'LAB_INACTIVE';
      const kelas = await db.doc('classes/' + labId).get();
      if (!kelas.exists || kelas.get('praktikumId') !== courseId) return 'CLASS_UNAVAILABLE';
      if (kelas.get('archived') === true || kelas.get('aktif') === false || kelas.get('labId') !== labId) {
        return 'CLASS_INVALID';
      }
    },
    async findAccount(email) {
      try { return await auth.getUserByEmail(email); }
      catch (error) { if (object(error).code !== 'auth/user-not-found') throw error; }
    },
    async readProfile(uid) { return (await db.doc('users/' + uid).get()).data(); },
    async identityInUse(row, uid) {
      const field = row.role === 'praktikan' ? 'nim' : 'nip';
      const result = await db.collection('users').where(field, '==', row.identity).limit(2).get();
      return result.docs.some((profile) => profile.id !== uid);
    },
    async reserve(row, existingUid) {
      const email = db.doc('provisioningReservations/' + reservationId('email:' + row.email));
      const identity = db.doc('provisioningReservations/' + reservationId(row.role + ':' + row.identity));
      return db.runTransaction(async (tx) => {
        const [a, b] = await tx.getAll(email, identity);
        if (a.exists || b.exists) {
          const uid = a.get('uid');
          return typeof uid === 'string' && uid === b.get('uid') && (!existingUid || existingUid === uid) ? uid : undefined;
        }
        if (existingUid) return;
        const uid = randomUUID();
        tx.create(email, { uid, createdAt: FieldValue.serverTimestamp() });
        tx.create(identity, { uid, createdAt: FieldValue.serverTimestamp() });
        return uid;
      });
    },
    async createAccount(uid, row) {
      return auth.createUser({ uid, email: row.email, displayName: row.nama,
        password: randomBytes(32).toString('base64url'), disabled: true });
    },
    async enableAccount(uid) { await auth.updateUser(uid, { disabled: false }); },
    async completeActivation(uid) {
      await db.doc('users/' + uid).update({ provisioningActivationPending: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp() });
    },
    async createProfile(uid, profile) {
      const ref = db.doc('users/' + uid);
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists) {
          if (existing.get('uid') !== uid || existing.get('role') !== profile.role || existing.get('email') !== profile.email
            || existing.get('nim') !== profile.nim || existing.get('nip') !== profile.nip) throw new Error('Profile conflict.');
          return;
        }
        tx.create(ref, { ...profile, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
    },
  };
}

export function registerProvisioning(router: Router, identity: FirebaseIdentityAdapter, store: ProvisioningStore, allowCreate = false) {
  router.post('/admin/provisioning/users', verifyFirebaseToken(identity), async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ results: await provisionUsers(res.locals.auth, req.body, store, allowCreate) });
  });
}
