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
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
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
  PermissionAuthorizationError,
  PermissionValidationError,
  createInMemoryPermissionRepository,
  decideLeaveRequest,
  fromFirestoreLeaveRequestDoc,
  submitLeaveRequest,
  subscribeAsistenLeaves,
  subscribePraktikanLeaves,
  validateLeaveReason,
} = loadSource('services/permissionService');
const { mapPenggunaToPermissionActor, mapSesiToLeaveOptions } = loadSource(
  'features/permissions/adapters',
);
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

test('validateLeaveReason rejects empty, whitespace, and oversized reasons', () => {
  assert.throws(() => validateLeaveReason(''), PermissionValidationError);
  assert.throws(() => validateLeaveReason('   \n\t  '), PermissionValidationError);
  assert.throws(
    () => validateLeaveReason('a'.repeat(501)),
    PermissionValidationError,
  );
  assert.equal(validateLeaveReason('  Sakit demam tinggi  '), 'Sakit demam tinggi');
});

test('aiService parses valid classification and handles failures without throwing', async () => {
  const missingUrl = await classifyLeaveReason('Demam sejak semalam', {
    endpointUrl: '',
  });
  assert.equal(missingUrl.status, 'failed');
  assert.equal(missingUrl.category, null);
  assert.ok(missingUrl.errorMessage);

  const okResult = await classifyLeaveReason('Demam dan dirawat di klinik', {
    endpointUrl: 'https://ai.example.test/classify',
    now: () => new Date('2026-10-21T08:00:00.000Z'),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://ai.example.test/classify');
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), {
        reason: 'Demam dan dirawat di klinik',
      });
      return new Response(
        JSON.stringify({ category: 'Sakit', confidence: 0.92 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  assert.equal(okResult.status, 'completed');
  assert.equal(okResult.category, 'Sakit');
  assert.equal(okResult.confidence, 0.92);
  assert.equal(okResult.classifiedAt, '2026-10-21T08:00:00.000Z');
  assert.equal(okResult.errorMessage, null);

  const serverError = await classifyLeaveReason('Izin keluarga', {
    endpointUrl: 'https://ai.example.test/classify',
    fetchImpl: async () => new Response('Server error', { status: 500 }),
  });
  assert.equal(serverError.status, 'failed');
  assert.equal(serverError.category, null);
  assert.match(serverError.errorMessage, /500/);

  const invalidJson = await classifyLeaveReason('Izin keluarga', {
    endpointUrl: 'https://ai.example.test/classify',
    fetchImpl: async () => new Response('not-json', { status: 200 }),
  });
  assert.equal(invalidJson.status, 'failed');

  const malformedShape = await classifyLeaveReason('Izin keluarga', {
    endpointUrl: 'https://ai.example.test/classify',
    fetchImpl: async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });
  assert.equal(malformedShape.status, 'failed');

  const aborted = await classifyLeaveReason('Izin keluarga', {
    endpointUrl: 'https://ai.example.test/classify',
    timeoutMs: 15,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  });
  assert.equal(aborted.status, 'failed');
  assert.match(aborted.errorMessage, /timeout/i);
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
  const result = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: '  Sakit demam sejak pagi  ',
    },
    {
      repository,
      now: () => new Date('2026-10-21T07:30:00.000Z'),
      aiConfig: {
        endpointUrl: 'https://ai.example.test/classify',
        now: () => new Date('2026-10-21T07:30:01.000Z'),
        fetchImpl: async () =>
          new Response(JSON.stringify({ category: 'Sakit', confidence: 0.95 }), {
            status: 200,
          }),
      },
    },
  );

  assert.equal(result.aiWarning, null);
  assert.equal(result.request.uid, praktikanActor.uid);
  assert.equal(result.request.sessionId, sampleSession.id);
  assert.equal(result.request.reason, 'Sakit demam sejak pagi');
  assert.equal(result.request.status, 'pending');
  assert.equal(result.request.decidedBy, null);
  assert.equal(result.request.aiClassification.status, 'completed');
  assert.equal(result.request.aiClassification.category, 'Sakit');
});

test('submitLeaveRequest still saves pending request when AI API fails', async () => {
  const repository = createInMemoryPermissionRepository();
  const result = await submitLeaveRequest(
    {
      actor: praktikanActor,
      session: sampleSession,
      reason: 'Ada urusan keluarga mendadak',
    },
    {
      repository,
      aiConfig: {
        endpointUrl: 'https://ai.example.test/classify',
        fetchImpl: async () => {
          throw new Error('Network down');
        },
      },
    },
  );

  assert.ok(result.aiWarning);
  assert.equal(result.request.status, 'pending');
  assert.equal(result.request.aiClassification.status, 'failed');
  assert.equal(result.request.aiClassification.category, null);
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

test('decideLeaveRequest enforces asisten role and updates praktikan real-time listener', async () => {
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
    { repository, aiConfig: { endpointUrl: '' } },
  );

  assert.equal(praktikanSnapshots.length, countBeforeUnsub);
});

test('fromFirestoreLeaveRequestDoc and Sprint 1 adapters normalize safely', () => {
  const doc = fromFirestoreLeaveRequestDoc('req-1', {
    uid: 'u1',
    sessionId: 's1',
    reason: 'Sakit',
    aiClassification: { status: 'completed', category: 'Sakit' },
    status: 'rejected',
  });
  assert.equal(doc.id, 'req-1');
  assert.equal(doc.status, 'rejected');
  assert.equal(doc.aiClassification.category, 'Sakit');

  const actor = mapPenggunaToPermissionActor(initialState.pengguna[1]);
  assert.equal(actor.role, 'praktikan');
  assert.deepEqual(actor.classIds, ['kelas-a']);

  const options = mapSesiToLeaveOptions(initialState.sesi, initialState.kelas);
  assert.equal(options.length, initialState.sesi.length);
  assert.equal(options[0].className, 'PPK A');
});

