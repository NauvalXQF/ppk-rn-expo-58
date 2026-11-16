const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const cache = new Map();
function loadSource(name, overrides = {}) {
  const file = ['.ts', '.tsx']
    .map((ext) => path.resolve('src', name + ext))
    .find(fs.existsSync);
  assert.ok(file, `Missing source module: ${name}`);
  const useCache = Object.keys(overrides).length === 0;
  if (useCache && cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  if (useCache) cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  const nativeRequire = createRequire(file);
  const requireSource = (id) =>
    overrides[id] ??
    (id.startsWith('@/') ? loadSource(id.slice(2), overrides) : nativeRequire(id));
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: file,
  })(requireSource, module, module.exports);
  return module.exports;
}

const { classifyLeaveReason, parseAiClassificationResponse } = loadSource(
  'services/aiService',
);
const {
  MAX_LEAVE_REASON_LENGTH,
  PermissionAuthorizationError,
  PermissionConflictError,
  PermissionValidationError,
  createInMemoryPermissionRepository,
  decideLeaveRequest,
  fromFirestoreLeaveRequestDoc,
  retryLeaveAiClassification,
  submitLeaveRequest,
  subscribeAsistenLeaves,
  subscribePraktikanLeaves,
  validateLeaveReason,
} = loadSource('services/permissionService');
const {
  mapPenggunaToPermissionActor,
  mapProfilToPermissionActor,
  mapSesiToLeaveOptions,
} = loadSource('features/permissions/adapters');
const { initialState } = loadSource('data/dummy');

const praktikanActor = {
  uid: 'uid-praktikan-1',
  role: 'praktikan',
  displayName: 'Budi Santoso',
  nim: '2310511001',
  classIds: ['kelas-a'],
};

const otherPraktikanActor = {
  uid: 'uid-praktikan-2',
  role: 'praktikan',
  displayName: 'Siti Rahma',
  nim: '2310511002',
  classIds: ['kelas-a'],
};

const asistenActor = {
  uid: 'uid-asisten-1',
  role: 'asisten',
  displayName: 'Nauval',
  nip: '1987654321',
};

const sampleSession = {
  id: 'sesi-2',
  classId: 'kelas-a',
  className: 'PPK A',
  topic: 'Komponen & Layout',
  date: '2026-10-21',
  startTime: '10:00',
  endTime: '12:00',
  status: 'dijadwalkan',
};

const otherClassSession = {
  id: 'sesi-5',
  classId: 'kelas-b',
  className: 'PPK B',
  topic: 'Komponen & Layout',
  date: '2026-10-22',
  startTime: '13:00',
  endTime: '15:00',
  status: 'dijadwalkan',
};

test('validateLeaveReason rejects empty, whitespace, and >1000 char reasons', () => {
  assert.equal(MAX_LEAVE_REASON_LENGTH, 1000);
  assert.throws(() => validateLeaveReason(''), PermissionValidationError);
  assert.throws(() => validateLeaveReason('   \n\t  '), PermissionValidationError);
  assert.throws(
    () => validateLeaveReason('a'.repeat(1001)),
    PermissionValidationError,
  );
  assert.equal(validateLeaveReason('a'.repeat(1000)).length, 1000);
  assert.equal(validateLeaveReason('  Sakit demam tinggi  '), 'Sakit demam tinggi');
});

test('aiService enforces local-only inference and ignores remote configurations without making HTTP requests', async () => {
  const failingFetch = () => {
    throw new Error('HTTP fetch must never be called during local-only AI inference');
  };

  // 1. Pemanggilan default menggunakan model lokal (EDOM)
  const defaultResult = await classifyLeaveReason('Penjelasan asisten mudah dipahami', {
    now: () => new Date('2026-10-21T08:00:00.000Z'),
  });
  assert.equal(defaultResult.status, 'completed');
  assert.equal(defaultResult.category, 'positif');
  assert.equal(defaultResult.confidence, null);
  assert.equal(defaultResult.experimental, true);
  assert.equal(defaultResult.reportedByClient, true);
  assert.equal(defaultResult.classifiedAt, '2026-10-21T08:00:00.000Z');
  assert.equal(defaultResult.errorMessage, null);

  // 2. Konfigurasi auto tidak memicu HTTP
  const autoResult = await classifyLeaveReason('Penjelasan asisten mudah dipahami', {
    mode: 'auto',
    endpointUrl: 'https://ai.example.test/classify',
    fetchImpl: failingFetch,
  });
  assert.equal(autoResult.status, 'completed');
  assert.equal(autoResult.category, 'positif');

  // 3. Konfigurasi remote tidak memicu HTTP
  const remoteResult = await classifyLeaveReason('Penjelasan asisten mudah dipahami', {
    mode: 'remote',
    endpointUrl: 'https://ai.example.test/classify',
    fetchImpl: failingFetch,
  });
  assert.equal(remoteResult.status, 'completed');
  assert.equal(remoteResult.category, 'positif');

  // 4. Environment API yang tersedia tidak memicu HTTP
  const originalEnv = process.env.EXPO_PUBLIC_AI_API_URL;
  try {
    process.env.EXPO_PUBLIC_AI_API_URL = 'https://ai.example.test/env-endpoint';
    const envResult = await classifyLeaveReason('Penjelasan asisten mudah dipahami', {
      fetchImpl: failingFetch,
    });
    assert.equal(envResult.status, 'completed');
    assert.equal(envResult.category, 'positif');
  } finally {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_AI_API_URL;
    } else {
      process.env.EXPO_PUBLIC_AI_API_URL = originalEnv;
    }
  }

  // 5 & 6. Endpoint eksplisit & fetchFn tidak pernah dipanggil
  let fetchCalled = false;
  const explicitResult = await classifyLeaveReason('Saya sakit demam tinggi dan tidak bisa hadir', {
    endpointUrl: 'https://ai.example.test/explicit',
    fetchImpl: () => {
      fetchCalled = true;
      throw new Error('Unexpected network call');
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(explicitResult.status, 'completed');
  assert.equal(explicitResult.category, 'negatif');

  // 7 & 8. label: null tetap ditangani dan tidak dianggap netral
  const emptyResult = await classifyLeaveReason('   \n\t  ');
  assert.equal(emptyResult.status, 'failed');
  assert.equal(emptyResult.category, null);
  assert.match(emptyResult.errorMessage, /kosong/i);

  const unknownVocabResult = await classifyLeaveReason('asdfghjkl qazwsxedc');
  assert.equal(unknownVocabResult.status, 'failed');
  assert.equal(unknownVocabResult.category, null);
  assert.match(unknownVocabResult.errorMessage, /kata belum dikenali/i);

  // 9. Exception pada classifier menghasilkan respons aman tanpa throw
  const exceptionResult = await classifyLeaveReason('Penjelasan asisten', {
    localClassifier: () => {
      throw new Error('Simulated engine failure');
    },
  });
  assert.equal(exceptionResult.status, 'failed');
  assert.equal(exceptionResult.category, null);
  assert.match(exceptionResult.errorMessage, /Gagal menjalankan model AI lokal/i);
});

test('parseAiClassificationResponse supports custom response hooks and nested data', () => {
  assert.deepEqual(
    parseAiClassificationResponse({ data: { kategori: 'Acara Keluarga', score: 0.85 } }),
    { category: 'Acara Keluarga', confidence: 0.85 },
  );
  assert.equal(parseAiClassificationResponse(null), null);
});

test('submitLeaveRequest persists request with AI result and never auto-approves', async () => {
  const repository = createInMemoryPermissionRepository();
  const failingFetch = () => {
    throw new Error('HTTP fetch must never be called during leave submission');
  };

  const result = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: '  Penjelasan asisten mudah dipahami  ',
    },
    {
      repository,
      now: () => new Date('2026-10-21T07:30:00.000Z'),
      aiConfig: {
        endpointUrl: 'https://ai.example.test/legacy-endpoint',
        fetchImpl: failingFetch,
      },
    },
  );

  assert.equal(result.aiWarning, null);
  assert.equal(result.request.uid, praktikanActor.uid);
  assert.equal(result.request.sessionId, sampleSession.id);
  assert.equal(result.request.reason, 'Penjelasan asisten mudah dipahami');
  assert.equal(result.request.status, 'pending');
  assert.equal(result.request.decidedBy, null);
  assert.equal(result.request.aiClassification.status, 'completed');
  assert.equal(result.request.aiClassification.category, 'positif');
  assert.equal(result.request.aiClassification.reportedByClient, true);
  assert.equal(result.request.aiClassification.experimental, true);
});

test('submitLeaveRequest still saves pending request when AI fails and supports controlled retry', async () => {
  const repository = createInMemoryPermissionRepository();
  const allSnapshots = [];
  const unsub = subscribeAsistenLeaves(
    asistenActor,
    (items) => allSnapshots.push(items),
    undefined,
    repository,
  );

  const initial = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Penjelasan asisten mudah dipahami',
    },
    {
      repository,
      aiConfig: {
        localClassifier: () => {
          throw new Error('Simulated engine failure');
        },
      },
    },
  );

  assert.ok(initial.aiWarning);
  assert.equal(initial.request.status, 'pending');
  assert.equal(initial.request.aiClassification.status, 'failed');

  await assert.rejects(
    () => retryLeaveAiClassification(otherPraktikanActor, initial.request, { repository }),
    PermissionAuthorizationError,
  );

  const retried = await retryLeaveAiClassification(
    praktikanActor,
    initial.request,
    {
      repository,
    },
  );

  assert.equal(retried.aiWarning, null);
  assert.equal(retried.request.id, initial.request.id);
  assert.equal(retried.request.status, 'pending');
  assert.equal(retried.request.aiClassification.status, 'completed');
  assert.equal(retried.request.aiClassification.category, 'positif');
  assert.equal(allSnapshots.at(-1).length, 1);
  unsub();
});

test('submitLeaveRequest enforces praktikan role and enrolled class membership', async () => {
  const repository = createInMemoryPermissionRepository();

  await assert.rejects(
    () =>
      submitLeaveRequest(
        {
          actor: asistenActor,
          session: sampleSession,
          reason: 'Alasan asisten',
        },
        { repository },
      ),
    PermissionAuthorizationError,
  );

  await assert.rejects(
    () =>
      submitLeaveRequest(
        {
          actor: praktikanActor,
          session: otherClassSession,
          reason: 'Beda kelas',
        },
        { repository },
      ),
    PermissionAuthorizationError,
  );
});

test('decideLeaveRequest enforces asisten role, rejects double decision, and updates listeners', async () => {
  const repository = createInMemoryPermissionRepository();
  const { request } = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Sakit flu',
    },
    {
      repository,
      aiConfig: { endpointUrl: '' },
    },
  );

  await assert.rejects(
    () =>
      decideLeaveRequest(
        {
          actor: praktikanActor,
          requestId: request.id,
          decision: 'approved',
        },
        { repository },
      ),
    PermissionAuthorizationError,
  );

  const praktikanSnapshots = [];
  const otherSnapshots = [];
  const asistenSnapshots = [];

  const unsubPraktikan = subscribePraktikanLeaves(
    praktikanActor,
    (items) => praktikanSnapshots.push(items),
    undefined,
    repository,
  );
  const unsubOther = subscribePraktikanLeaves(
    otherPraktikanActor,
    (items) => otherSnapshots.push(items),
    undefined,
    repository,
  );
  const unsubAsisten = subscribeAsistenLeaves(
    asistenActor,
    (items) => asistenSnapshots.push(items),
    undefined,
    repository,
  );

  assert.equal(praktikanSnapshots.at(-1).length, 1);
  assert.equal(otherSnapshots.at(-1).length, 0);
  assert.equal(asistenSnapshots.at(-1).length, 1);

  const decided = await decideLeaveRequest(
    {
      actor: asistenActor,
      requestId: request.id,
      decision: 'approved',
      decisionNote: 'Semoga lekas sembuh',
    },
    { repository },
  );

  assert.equal(decided.status, 'approved');
  assert.equal(decided.decidedBy, asistenActor.uid);
  assert.equal(praktikanSnapshots.at(-1)[0].status, 'approved');
  assert.equal(asistenSnapshots.at(-1)[0].status, 'approved');

  // Keputusan final tidak dapat ditimpa oleh keputusan kedua
  await assert.rejects(
    () =>
      decideLeaveRequest(
        {
          actor: asistenActor,
          requestId: request.id,
          decision: 'rejected',
        },
        { repository },
      ),
    PermissionConflictError,
  );

  // Retry AI tidak boleh jalan setelah keputusan final
  await assert.rejects(
    () => retryLeaveAiClassification(praktikanActor, decided, { repository }),
    PermissionConflictError,
  );

  const countBeforeUnsub = praktikanSnapshots.length;
  unsubPraktikan();
  unsubOther();
  unsubAsisten();

  await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Izin kedua setelah unsubscribe',
    },
    { repository },
  );

  assert.equal(praktikanSnapshots.length, countBeforeUnsub);
});

test('late AI response arriving after assistant decision does not overwrite final status', async () => {
  const repository = createInMemoryPermissionRepository();
  const asistenSnapshots = [];
  const unsub = subscribeAsistenLeaves(
    asistenActor,
    (items) => asistenSnapshots.push(items),
    undefined,
    repository,
  );

  let resolveClassify;
  const pendingSubmission = submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Sakit perut mendadak',
    },
    {
      repository,
      aiConfig: {
        localClassifier: () =>
          new Promise((resolve) => {
            resolveClassify = resolve;
          }),
      },
    },
  );

  // Tunggu pengajuan awal tersimpan sebelum inferensi AI selesai
  await new Promise((r) => setTimeout(r, 10));
  const savedPending = asistenSnapshots.at(-1)[0];
  assert.equal(savedPending.status, 'pending');

  // Asisten memutuskan sebelum AI merespons
  const approved = await decideLeaveRequest(
    {
      actor: asistenActor,
      requestId: savedPending.id,
      decision: 'approved',
    },
    { repository },
  );
  assert.equal(approved.status, 'approved');

  // Respons AI baru tiba belakangan
  resolveClassify({
    label: 'negatif',
    status: 'predicted',
    scores: [-0.4, 0.1, -0.8],
    scoreType: 'decision_margin',
    experimental: true,
  });
  const result = await pendingSubmission;
  assert.ok(result.aiWarning);
  assert.equal(asistenSnapshots.at(-1)[0].status, 'approved');
  unsub();
});

test('fromFirestoreLeaveRequestDoc normalizes Firestore fields and Timestamp objects', () => {
  const doc = fromFirestoreLeaveRequestDoc('req-1', {
    uid: 'u1',
    sessionId: 's1',
    alasan: 'Sakit demam',
    ai: { status: 'completed', category: 'Sakit', reportedByClient: true },
    status: 'rejected',
    reviewedBy: 'asisten-uid',
    reviewedAt: { toDate: () => new Date('2026-10-21T09:15:00.000Z') },
    reviewNote: 'Surat dokter menyusul',
    createdAt: { toDate: () => new Date('2026-10-21T08:00:00.000Z') },
    updatedAt: { toDate: () => new Date('2026-10-21T09:15:00.000Z') },
  });

  assert.equal(doc.id, 'req-1');
  assert.equal(doc.reason, 'Sakit demam');
  assert.equal(doc.status, 'rejected');
  assert.equal(doc.decidedBy, 'asisten-uid');
  assert.equal(doc.decidedAt, '2026-10-21T09:15:00.000Z');
  assert.equal(doc.decisionNote, 'Surat dokter menyusul');
  assert.equal(doc.aiClassification.category, 'Sakit');
  assert.equal(doc.createdAt, '2026-10-21T08:00:00.000Z');
});

test('firestorePermissionRepository complies with firestore.rules create/update field contracts', async () => {
  const createdDocs = [];
  const aiUpdates = [];
  const txUpdates = [];
  const fakeDb = { kind: 'fake-db' };
  const fakeServerTs = { __serverTimestamp: true };

  const fakeFirestore = {
    collection: (_db, name) => ({ path: name }),
    doc: (_db, name, id) => ({ path: `${name}/${id}`, id }),
    serverTimestamp: () => fakeServerTs,
    addDoc: async (_col, data) => {
      createdDocs.push(data);
      return { id: 'fs-req-1' };
    },
    updateDoc: async (_ref, data) => {
      aiUpdates.push(data);
    },
    getDoc: async (ref) => ({
      exists: () => true,
      id: ref.id,
      data: () => ({
        ...createdDocs[0],
        ...(aiUpdates[0] ?? {}),
        createdAt: { toDate: () => new Date('2026-10-21T08:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-10-21T08:01:00.000Z') },
      }),
    }),
    runTransaction: async (_db, handler) => {
      const tx = {
        get: async () => ({
          exists: () => true,
          id: 'fs-req-1',
          data: () => ({
            ...createdDocs[0],
            status: 'pending',
          }),
        }),
        update: (_ref, patch) => {
          txUpdates.push(patch);
        },
      };
      return handler(tx);
    },
    query: (...args) => ({ args }),
    where: (...args) => ({ args }),
    onSnapshot: () => () => {},
  };

  const { firestorePermissionRepository } = loadSource(
    'services/firestorePermissionRepository',
    {
      'firebase/firestore': fakeFirestore,
      '@/config/firebase': {
        getFirebaseDb: () => fakeDb,
        isFirebaseConfigured: true,
      },
    },
  );

  const created = await firestorePermissionRepository.createLeaveRequest({
    uid: 'uid-1',
    praktikanName: 'Budi',
    praktikanNim: '2310511001',
    sessionId: 'sesi-2',
    sessionTopic: 'Komponen',
    classId: 'kelas-a',
    className: 'PPK A',
    sessionDate: '2026-10-21',
    reason: 'Izin sakit',
    aiClassification: {
      status: 'pending',
      category: null,
      confidence: null,
      classifiedAt: null,
      errorMessage: null,
      reportedByClient: true,
    },
    status: 'pending',
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: '2026-10-21T08:00:00.000Z',
    updatedAt: '2026-10-21T08:00:00.000Z',
  });

  assert.equal(created.id, 'fs-req-1');
  assert.equal(createdDocs[0].alasan, 'Izin sakit');
  assert.equal(createdDocs[0].status, 'pending');
  assert.equal(createdDocs[0].reviewedBy, null);
  assert.equal(createdDocs[0].reviewedAt, null);

  await firestorePermissionRepository.updateAiClassification(
    'fs-req-1',
    {
      status: 'completed',
      category: 'Sakit',
      confidence: 0.9,
      classifiedAt: '2026-10-21T08:01:00.000Z',
      errorMessage: null,
      reportedByClient: true,
    },
    '2026-10-21T08:01:00.000Z',
  );
  // Wajib hanya mengubah key ['ai', 'updatedAt'] sesuai firestore.rules
  assert.deepEqual(Object.keys(aiUpdates[0]).sort(), ['ai', 'updatedAt']);

  await firestorePermissionRepository.updateLeaveDecision('fs-req-1', {
    status: 'approved',
    decidedBy: 'asisten-uid',
    decidedByName: 'Nauval',
    decidedAt: '2026-10-21T09:00:00.000Z',
    decisionNote: 'Disetujui',
    updatedAt: '2026-10-21T09:00:00.000Z',
  });
  // Wajib hanya mengubah 5 key sesuai whitelist firestore.rules
  assert.deepEqual(
    Object.keys(txUpdates[0]).sort(),
    ['reviewNote', 'reviewedAt', 'reviewedBy', 'status', 'updatedAt'],
  );
});

test('Sprint 1 and P1 ProfilPengguna adapters map cleanly', () => {
  const profilActor = mapProfilToPermissionActor(
    {
      uid: 'fb-uid-1',
      email: 'budi@example.com',
      nama: 'Budi',
      role: 'praktikan',
      nim: '2310511001',
      kelasId: 'kelas-a',
    },
    'kelas-b',
  );
  assert.equal(profilActor.uid, 'fb-uid-1');
  assert.deepEqual(profilActor.classIds, ['kelas-b']);

  const actor = mapPenggunaToPermissionActor(initialState.pengguna[1]);
  assert.equal(actor.role, 'praktikan');
  assert.deepEqual(actor.classIds, ['kelas-a']);

  const options = mapSesiToLeaveOptions(initialState.sesi, initialState.kelas);
  assert.equal(options.length, initialState.sesi.length);
  assert.equal(options[0].className, 'PPK A');
});

test('local EDOM sentiment model integrates as default offline AI classifier', async () => {
  const positive = await classifyLeaveReason('Penjelasan asisten mudah dipahami', {
    now: () => new Date('2026-10-21T08:05:00.000Z'),
  });
  assert.equal(positive.status, 'completed');
  assert.equal(positive.category, 'positif');
  assert.equal(positive.confidence, null);
  assert.equal(positive.experimental, true);
  assert.equal(positive.reportedByClient, true);
  assert.equal(positive.classifiedAt, '2026-10-21T08:05:00.000Z');
  assert.equal(positive.errorMessage, null);

  const unknownVocab = await classifyLeaveReason('asdfghjkl qazwsxedc');
  assert.equal(unknownVocab.status, 'failed');
  assert.equal(unknownVocab.category, null);
  assert.match(unknownVocab.errorMessage, /kata belum dikenali/i);

  const repository = createInMemoryPermissionRepository();
  const submitted = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Saya sakit demam tinggi dan tidak bisa hadir praktikum',
    },
    { repository },
  );
  assert.equal(submitted.aiWarning, null);
  assert.equal(submitted.request.status, 'pending');
  assert.equal(submitted.request.aiClassification.status, 'completed');
  assert.ok(['positif', 'netral', 'negatif'].includes(submitted.request.aiClassification.category));
  assert.equal(submitted.request.aiClassification.experimental, true);
});
