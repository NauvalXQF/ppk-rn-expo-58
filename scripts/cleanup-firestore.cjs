#!/usr/bin/env node
'use strict';

/**
 * Script sanitasi koleksi `classMembers` di Firestore:
 * 1. Menandai/menghapus dokumen dummy non-UID (mis. `kelas-a_praktikan-1`, ID tidak kanonis).
 * 2. Deduplikasi keanggotaan aktif ganda agar 1 user hanya aktif di 1 kelas.
 *
 * Penggunaan:
 *   node scripts/cleanup-firestore.cjs                  # Dry-run (tidak menulis ke DB)
 *   node scripts/cleanup-firestore.cjs --apply          # Nonaktifkan (`active: false`)
 *   node scripts/cleanup-firestore.cjs --apply --delete # Hapus dokumen (khusus Admin SDK)
 *
 * Kredensial (pilih salah satu):
 *   1. Firebase Admin SDK (`firebase-admin` + `GOOGLE_APPLICATION_CREDENTIALS` atau `--service-account path/to/key.json`)
 *   2. Firebase Client SDK (`firebase` + env `.env` + `CLEANUP_ASISTEN_EMAIL` & `CLEANUP_ASISTEN_PASSWORD`)
 */

const fs = require('node:fs');
const path = require('node:path');

const DUMMY_UID_PATTERN = /^(praktikan|asisten|dummy|test)-\d+$/i;

function isDummyMemberDoc(docId, data = {}) {
  const uid = typeof data.uid === 'string' ? data.uid.trim() : '';
  const classId = typeof data.classId === 'string' ? data.classId.trim() : '';

  if (!uid || !classId) {
    return { isDummy: true, reason: 'missing_uid_or_classId' };
  }
  if (DUMMY_UID_PATTERN.test(uid)) {
    return { isDummy: true, reason: 'legacy_dummy_uid' };
  }
  if (docId !== `${classId}_${uid}`) {
    return { isDummy: true, reason: 'non_canonical_doc_id' };
  }
  return { isDummy: false, reason: null };
}

function resolvePraktikumIdForClass(classId, classesById) {
  if (!classesById) return 'praktikum-ppk';
  const entry =
    classesById instanceof Map
      ? classesById.get(classId)
      : classesById[classId];
  const raw = typeof entry === 'string' ? entry : entry?.praktikumId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'praktikum-ppk';
}

/**
 * Merencanakan operasi pembersihan `classMembers` secara deterministik.
 * Deduplikasi hanya mengarsipkan keanggotaan ganda pada `praktikumId` yang sama.
 * @param {Array<{ id: string, data: Record<string, any> }>} docs
 * @param {Map<string, Record<string, any>> | Record<string, Record<string, any> | string>} [classesById]
 */
function planClassMembersCleanup(docs, classesById) {
  const dummyActions = [];
  const activeByUidAndPraktikum = new Map();

  for (const entry of docs) {
    const data = entry.data || {};
    const dummyCheck = isDummyMemberDoc(entry.id, data);
    if (dummyCheck.isDummy) {
      if (data.active !== false) {
        dummyActions.push({
          id: entry.id,
          uid: data.uid ?? null,
          classId: data.classId ?? null,
          reason: dummyCheck.reason,
          canClientDeactivate:
            typeof data.uid === 'string' &&
            typeof data.classId === 'string' &&
            entry.id === `${data.classId}_${data.uid}`,
        });
      }
      continue;
    }

    if (data.active === true) {
      const praktikumId = resolvePraktikumIdForClass(data.classId, classesById);
      const groupKey = `${data.uid}::${praktikumId}`;
      const list = activeByUidAndPraktikum.get(groupKey) || [];
      list.push({ ...entry, praktikumId });
      activeByUidAndPraktikum.set(groupKey, list);
    }
  }

  const kept = [];
  const duplicateActions = [];

  for (const entries of activeByUidAndPraktikum.values()) {
    const sorted = [...entries].sort((a, b) => {
      const classCmp = String(a.data.classId).localeCompare(String(b.data.classId));
      return classCmp !== 0 ? classCmp : a.id.localeCompare(b.id);
    });
    const primary = sorted[0];
    kept.push({
      id: primary.id,
      uid: primary.data.uid,
      classId: primary.data.classId,
      praktikumId: primary.praktikumId,
    });

    for (const dup of sorted.slice(1)) {
      duplicateActions.push({
        id: dup.id,
        uid: dup.data.uid,
        classId: dup.data.classId,
        praktikumId: dup.praktikumId,
        keptClassId: primary.data.classId,
        keptDocId: primary.id,
        reason: 'duplicate_active_membership',
        canClientDeactivate: true,
      });
    }
  }

  return {
    totalDocs: docs.length,
    dummyActions,
    duplicateActions,
    kept,
  };
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv) {
  const args = { apply: false, hardDelete: false, serviceAccount: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--delete') args.hardDelete = true;
    else if (token === '--service-account' && argv[i + 1]) {
      args.serviceAccount = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function createFirestoreClient(args) {
  let admin = null;
  try {
    admin = require('firebase-admin');
  } catch {
    admin = null;
  }

  const credPath = args.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (admin && (credPath || process.env.FIRESTORE_EMULATOR_HOST)) {
    if (admin.apps.length === 0) {
      if (credPath) {
        const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(credPath), 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        admin.initializeApp({
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
        });
      }
    }
    const db = admin.firestore();
    return {
      mode: 'admin',
      async fetchClassMembers() {
        const snap = await db.collection('classMembers').get();
        return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      },
      async fetchClasses() {
        const snap = await db.collection('classes').get();
        return new Map(snap.docs.map((d) => [d.id, d.data()]));
      },
      async deactivateDoc(id) {
        await db.collection('classMembers').doc(id).update({
          active: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      },
      async deleteDoc(id) {
        await db.collection('classMembers').doc(id).delete();
      },
    };
  }

  // Fallback ke Firebase Client SDK (sudah terpasang di dependencies proyek)
  const { initializeApp, getApps, getApp } = require('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
  const {
    collection,
    doc,
    getDocs,
    getFirestore,
    serverTimestamp,
    updateDoc,
  } = require('firebase/firestore');

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'Konfigurasi Firebase belum lengkap. Sediakan firebase-admin + service account atau isi .env EXPO_PUBLIC_FIREBASE_*.',
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const email = process.env.CLEANUP_ASISTEN_EMAIL;
  const password = process.env.CLEANUP_ASISTEN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Client SDK membutuhkan CLEANUP_ASISTEN_EMAIL & CLEANUP_ASISTEN_PASSWORD, atau gunakan firebase-admin dengan GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  const db = getFirestore(app);

  return {
    mode: 'client',
    async fetchClassMembers() {
      const snap = await getDocs(collection(db, 'classMembers'));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async fetchClasses() {
      const snap = await getDocs(collection(db, 'classes'));
      return new Map(snap.docs.map((d) => [d.id, d.data()]));
    },
    async deactivateDoc(id) {
      await updateDoc(doc(db, 'classMembers', id), {
        active: false,
        updatedAt: serverTimestamp(),
      });
    },
    async deleteDoc() {
      throw new Error(
        'Penghapusan fisik ditolak Firestore Rules (`allow delete: if false`); gunakan mode Admin SDK untuk `--delete`.',
      );
    },
  };
}

async function run() {
  loadEnvFile(path.resolve(__dirname, '..', '.env'));
  const args = parseArgs(process.argv.slice(2));
  const client = await createFirestoreClient(args);

  console.log(`[cleanup-firestore] Mode SDK: ${client.mode} | Apply: ${args.apply} | HardDelete: ${args.hardDelete}`);
  const [docs, classesById] = await Promise.all([
    client.fetchClassMembers(),
    client.fetchClasses(),
  ]);
  const plan = planClassMembersCleanup(docs, classesById);

  console.log(`[cleanup-firestore] Total dokumen classMembers: ${plan.totalDocs}`);
  console.log(`[cleanup-firestore] Dokumen dummy ditemukan (aktif): ${plan.dummyActions.length}`);
  for (const item of plan.dummyActions) {
    console.log(`  - [DUMMY] ${item.id} (uid=${item.uid}, reason=${item.reason})`);
  }

  console.log(`[cleanup-firestore] Keanggotaan ganda ditemukan: ${plan.duplicateActions.length}`);
  for (const item of plan.duplicateActions) {
    console.log(
      `  - [DUPLICATE] ${item.id} (uid=${item.uid}) -> pertahankan ${item.keptDocId}`,
    );
  }

  if (!args.apply) {
    console.log('[cleanup-firestore] Dry-run selesai. Jalankan ulang dengan `--apply` untuk mengeksekusi perubahan.');
    return;
  }

  const targets = [...plan.dummyActions, ...plan.duplicateActions];
  let updated = 0;
  let skipped = 0;

  for (const target of targets) {
    if (args.hardDelete) {
      await client.deleteDoc(target.id);
      updated += 1;
      continue;
    }
    if (client.mode === 'client' && !target.canClientDeactivate) {
      console.warn(
        `  ! Lewati ${target.id} di client mode (ID non-kanonis ditolak Rules, perlu Admin SDK).`,
      );
      skipped += 1;
      continue;
    }
    await client.deactivateDoc(target.id);
    updated += 1;
  }

  console.log(`[cleanup-firestore] Selesai. Diproses: ${updated}, Dilewati: ${skipped}.`);
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[cleanup-firestore] Gagal:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DUMMY_UID_PATTERN,
  isDummyMemberDoc,
  planClassMembersCleanup,
};
