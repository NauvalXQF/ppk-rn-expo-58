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

// Load services with mock dependencies
const bulkCsvService = loadSource('services/aslab/bulkCsvService', {
  'react-native': {
    Platform: { OS: 'node' },
    Share: { share: async () => ({ action: 'sharedAction' }) },
  },
});

const dashboardService = loadSource('services/aslab/dashboardService', {
  '@/config/firebase': { getFirebaseDb: () => ({}) },
  'firebase/firestore': {
    collection: () => ({}),
    getDocs: async () => ({ docs: [] }),
    query: () => ({}),
    where: () => ({}),
  },
});

const authService = loadSource('services/authService', {
  '@/config/firebase': { getFirebaseAuth: () => ({}), getFirebaseDb: () => ({}) },
  'firebase/auth': {},
  'firebase/firestore': {
    doc: () => ({}),
    getDoc: async () => ({ exists: () => false }),
    onSnapshot: () => () => {},
    runTransaction: async () => {},
    serverTimestamp: () => 'server-time',
  },
});

const {
  getBulkCsvTemplate,
  getBulkCsvFilename,
  parseRawCsv,
  parseBulkLaboratoriumCsv,
  parseBulkPraktikanCsv,
  parseBulkAsprakCsv,
} = bulkCsvService;

const {
  getDateRange,
  isDateWithinRange,
  calculateDashboardMetrics,
} = dashboardService;

const {
  isAslab,
  isAsprak,
  isPraktikan,
  kePenggunaAplikasi,
} = authService;

// ============================================================================
// 1. Role & Auth Normalization (T-01)
// ============================================================================
test('T-01: identifies aslab, asprak, and praktikan roles with backward compatibility', () => {
  const aslabProfile = { uid: 'u1', email: 'aslab@univ.ac.id', nama: 'Budi Aslab', role: 'aslab' };
  const asprakProfile = { uid: 'u2', email: 'asprak@univ.ac.id', nama: 'Dewi Asprak', role: 'asprak' };
  const legacyProfile = { uid: 'u3', email: 'asisten@univ.ac.id', nama: 'Rudi Asisten', role: 'asisten' };
  const praktikanProfile = { uid: 'u4', email: 'mhs@univ.ac.id', nama: 'Siti Praktikan', role: 'praktikan' };

  assert.equal(isAslab(aslabProfile), true);
  assert.equal(isAslab(asprakProfile), false);
  assert.equal(isAslab(praktikanProfile), false);

  assert.equal(isAsprak(asprakProfile), true);
  assert.equal(isAsprak(legacyProfile), true); // Backward compatible
  assert.equal(isAsprak(aslabProfile), false);
  assert.equal(isAsprak(praktikanProfile), false);

  assert.equal(isPraktikan(praktikanProfile), true);
  assert.equal(isPraktikan(aslabProfile), false);
  assert.equal(isPraktikan(asprakProfile), false);

  const aslabApp = kePenggunaAplikasi(aslabProfile);
  assert.equal(aslabApp.peran, 'aslab');
  assert.equal(aslabApp.nama, 'Budi Aslab');

  const asprakApp = kePenggunaAplikasi(asprakProfile);
  assert.equal(asprakApp.peran, 'asprak');

  const legacyApp = kePenggunaAplikasi(legacyProfile);
  assert.equal(legacyApp.peran, 'asprak');
});

// ============================================================================
// 2. Bulk Templates & File Generation (T-02)
// ============================================================================
test('T-02: generates three distinct CSV templates with correct headers', () => {
  const labTemplate = getBulkCsvTemplate('laboratorium');
  const praktikanTemplate = getBulkCsvTemplate('praktikan');
  const asprakTemplate = getBulkCsvTemplate('asprak');

  assert.equal(getBulkCsvFilename('laboratorium'), 'template-bulk-laboratorium.csv');
  assert.equal(getBulkCsvFilename('praktikan'), 'template-bulk-praktikan.csv');
  assert.equal(getBulkCsvFilename('asprak'), 'template-bulk-asprak.csv');

  assert.ok(labTemplate.includes('nama,kode,gedung,latitude,longitude,radiusMeters,gracePeriodMinutes,lateFineAmount,kapasitas'));
  assert.ok(praktikanTemplate.includes('nim,nama,email'));
  assert.ok(asprakTemplate.includes('nip,nama,email'));

  assert.notEqual(labTemplate, praktikanTemplate);
  assert.notEqual(praktikanTemplate, asprakTemplate);
});

// ============================================================================
// 3. Raw CSV Parser with Quotes & CRLF
// ============================================================================
test('parseRawCsv handles CRLF, LF, quotes and commas correctly', () => {
  const raw = 'nama,gedung\r\n"Lab PPK A","Gedung F, Lt. 3"\n"Lab PPK B","Gedung G"';
  const rows = parseRawCsv(raw);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['nama', 'gedung']);
  assert.deepEqual(rows[1], ['Lab PPK A', 'Gedung F, Lt. 3']);
  assert.deepEqual(rows[2], ['Lab PPK B', 'Gedung G']);
});

// ============================================================================
// 4. Bulk Laboratorium CSV Validation & Parsing (T-03)
// ============================================================================
test('T-03: parses bulk lab CSV and flags missing or invalid fields correctly', () => {
  const csv = `nama,kode,gedung,latitude,longitude,radiusMeters,gracePeriodMinutes,lateFineAmount,kapasitas
Lab A,A,Gedung A,-7.95,112.61,30,15,10000,35
Lab B,B,Gedung B,-7.95,112.61,,15,10000,35
Lab C,C,Gedung C,-95.0,112.61,30,15,10000,35
Lab D,D,Gedung D,-7.95,112.61,30,-5,10000,35`;

  const parsed = parseBulkLaboratoriumCsv(csv);
  assert.equal(parsed.length, 4);

  // Row 1: Valid
  assert.equal(parsed[0].isValid, true);
  assert.equal(parsed[0].status, 'accepted');
  assert.equal(parsed[0].data.nama, 'Lab A');

  // Row 2: Empty radius -> uses default 30
  assert.equal(parsed[1].data.radiusMeters, '30');
  assert.equal(parsed[1].isValid, true);

  // Row 3: Latitude out of range (-95)
  assert.equal(parsed[2].isValid, false);
  assert.ok(parsed[2].errors.latitude);

  // Row 4: Negative grace period (-5)
  assert.equal(parsed[3].isValid, false);
  assert.ok(parsed[3].errors.gracePeriodMinutes);
});

// ============================================================================
// 5. Bulk Praktikan & Asprak Validation & Accept/Deny Logic (T-04, T-05)
// ============================================================================
test('T-04 & T-05: parses bulk praktikan/asprak and enforces valid email & name', () => {
  const csvPraktikan = `nim,nama,email
245150200111001,Andi Pratama,andi@student.ac.id
245150200111002,A,siti@student.ac.id
245150200111003,Budi Santoso,invalid-email`;

  const parsed = parseBulkPraktikanCsv(csvPraktikan);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].isValid, true);

  // Row 2: Short name (< 2 chars)
  assert.equal(parsed[1].isValid, false);
  assert.ok(parsed[1].errors.nama);

  // Row 3: Invalid email
  assert.equal(parsed[2].isValid, false);
  assert.ok(parsed[2].errors.email);

  // Simulate toggle Deny on row 1
  parsed[0].status = 'denied';
  assert.equal(parsed[0].status, 'denied');

  // Asprak CSV
  const csvAsprak = `nip,nama,email
225150200111010,Rina Kusuma,rina@student.ac.id
,Doni Saputra,doni@student.ac.id`;

  const parsedAsprak = parseBulkAsprakCsv(csvAsprak);
  assert.equal(parsedAsprak.length, 2);
  assert.equal(parsedAsprak[0].isValid, true);
  assert.equal(parsedAsprak[1].isValid, false); // Missing NIP
  assert.ok(parsedAsprak[1].errors.nip);
});

// ============================================================================
// 6. Bulk Commit to Firestore (T-03, T-04, T-05)
// ============================================================================
test('commitBulkLaboratorium, commitBulkPraktikan, commitBulkAsprak write only valid accepted rows', async () => {
  const operations = [];
  const mockDb = {};
  let failBulkChunk = false;
  let bulkChunkAttempts = 0;
  let failMemberChunk = false;
  let memberChunkAttempts = 0;

  const mockBatch = {
    set: (ref, data) => operations.push({ type: 'set', ref, data }),
    update: (ref, data) => operations.push({ type: 'update', ref, data }),
    commit: async () => {
      if (failBulkChunk && ++bulkChunkAttempts === 2) throw new Error('temporary failure');
    },
  };

  const labAssignmentService = loadSource('services/aslab/labAssignmentService', {
    '@/config/firebase': {
      getFirebaseDb: () => mockDb,
      getFirebaseAuth: () => ({ currentUser: null }),
    },
    '@/services/payments/paymentData': {
      resolvePaymentApiOrigin: () => 'http://localhost:4000',
    },
    'firebase/firestore': {
      collection: (db, name) => ({ collectionName: name }),
      doc: (dbOrColl, ...segments) => {
        const id = segments.length > 0 ? segments[segments.length - 1] : 'gen-id';
        const prefix = dbOrColl?.collectionName || 'doc';
        return { id, path: `${prefix}/${segments.join('/') || id}` };
      },
      serverTimestamp: () => 'server-time',
      writeBatch: () => mockBatch,
      runTransaction: async (_db, work) => {
        if (failMemberChunk && ++memberChunkAttempts === 2) throw new Error('temporary failure');
        return work({ get: async () => ({ exists: () => false }), set: mockBatch.set });
      },
      arrayUnion: (...items) => items,
      arrayRemove: (...items) => items,
      query: () => ({}),
      where: () => ({}),
      getDoc: async () => ({ exists: () => false }),
      getDocs: async () => ({ docs: [] }),
    },
  });

  const actorAslab = { uid: 'aslab-1', role: 'aslab', nama: 'Aslab', email: 'aslab@univ.ac.id' };
  const actorPraktikan = { uid: 'p-1', role: 'praktikan', nama: 'Praktikan', email: 'p@univ.ac.id' };

  // Denies non-aslab actor
  await assert.rejects(
    () => labAssignmentService.commitBulkLaboratorium(actorPraktikan, 'c1', 'Course 1', []),
    /Hanya Aslab/,
  );

  // Commit valid labs
  const labRows = [
    {
      id: 'r1', index: 1, status: 'accepted', isValid: true, errors: {},
      data: {
        nama: 'Lab PPK A', kode: 'PPK-A', gedung: 'Gedung F', latitude: '-7.95',
        longitude: '112.61', radiusMeters: '30', gracePeriodMinutes: '15',
        lateFineAmount: '10000', kapasitas: '35',
      },
    },
    {
      id: 'r2', index: 2, status: 'denied', isValid: true, errors: {}, // Denied by user
      data: {
        nama: 'Lab PPK B', kode: 'PPK-B', gedung: 'Gedung F', latitude: '-7.95',
        longitude: '112.61', radiusMeters: '30', gracePeriodMinutes: '15',
        lateFineAmount: '10000', kapasitas: '35',
      },
    },
  ];

  const labResult = await labAssignmentService.commitBulkLaboratorium(actorAslab, 'c1', 'PPK', labRows);
  assert.equal(labResult.successCount, 1);
  assert.equal(operations.length, 2); // 1 lab + 1 synchronized class
  assert.equal(operations[0].data.nama, 'Lab PPK A');
  assert.equal(operations[0].data.gracePeriodMinutes, 15);
  assert.equal(operations[0].data.lateFineAmount, 10000);

  failBulkChunk = true;
  const partialRows = Array.from({ length: 7 }, (_, index) => ({
    ...labRows[0], id: 'lab-' + index, index: index + 1,
  }));
  const partial = await labAssignmentService.commitBulkLaboratorium(actorAslab, 'c1', 'PPK', partialRows);
  assert.equal(partial.successCount, 6);
  assert.deepEqual(partial.committedRowIds, partialRows.slice(0, 6).map(({ id }) => id));
  assert.match(partial.errors[0], /baris 7 belum terkonfirmasi/);
  failBulkChunk = false;

  // Commit valid praktikan
  operations.length = 0;
  const praktikanRows = [
    {
      id: 'p1', index: 1, status: 'accepted', isValid: true, errors: {},
      data: { nim: '245150200111001', nama: 'Andi', email: 'andi@univ.ac.id' },
    },
    {
      id: 'p2', index: 2, status: 'accepted', isValid: false, errors: { email: 'invalid' }, // Invalid
      data: { nim: '245150200111002', nama: 'Budi', email: 'bad' },
    },
  ];

  const praktikanResult = await labAssignmentService.commitBulkPraktikan(
    actorAslab,
    'lab-1',
    praktikanRows,
    {
      courseId: 'c1',
      provisionUsers: async ({ users }) =>
        users.map((u) => ({ rowId: u.rowId, outcome: 'created', uid: 'uid-real-1' })),
    },
  );
  assert.equal(praktikanResult.successCount, 1);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].ref.id, 'lab-1_uid-real-1');
  assert.equal(operations[0].data.uid, 'uid-real-1');
  assert.equal(operations[0].data.nim, '245150200111001');
  assert.equal(operations[0].data.active, true);
  assert.deepEqual(Object.keys(operations[0].data).sort(), [
    'active',
    'classId',
    'createdAt',
    'nama',
    'nim',
    'uid',
    'updatedAt',
  ]);

  failMemberChunk = true;
  const memberRows = Array.from({ length: 16 }, (_, index) => ({
    ...praktikanRows[0], id: 'user-' + index, index: index + 1,
  }));
  const partialMembers = await labAssignmentService.commitBulkPraktikan(actorAslab, 'lab-1', memberRows, {
    courseId: 'c1',
    provisionUsers: async ({ users }) => users.map(({ rowId }) => ({ rowId, outcome: 'existing', uid: rowId })),
  });
  assert.equal(partialMembers.successCount, 15);
  assert.deepEqual(partialMembers.committedRowIds, memberRows.slice(0, 15).map(({ id }) => id));
  assert.match(partialMembers.errors[0], /baris 16 belum terkonfirmasi/);
});

// ============================================================================
// 7. Atomic Transfer of Praktikan & Asprak (T-06, T-07)
// ============================================================================
test('bulk provisioning requests reset only for accounts created and keeps failed email rows usable', async (t) => {
  const sent = [];
  const endpoint = process.env.EXPO_PUBLIC_API_BASE_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://backend.example.test';
  t.after(() => {
    global.fetch = previousFetch;
    if (endpoint === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = endpoint;
  });

  const service = loadSource('services/aslab/labAssignmentService', {
    '@/config/firebase': { getFirebaseAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }) },
    '@/services/payments/paymentData': { resolvePaymentApiOrigin: (origin) => origin },
    '@/services/authService': {
      kirimResetPassword: async (email) => {
        sent.push(email);
        if (email.startsWith('delay')) throw new Error('temporary reset failure');
      },
    },
  });
  global.fetch = async (url) => {
    assert.equal(url, 'https://backend.example.test/api/admin/provisioning/users');
    return { ok: true, json: async () => ({ results: [
      { rowId: '1', outcome: 'created', uid: 'new-one' },
      { rowId: '2', outcome: 'existing', uid: 'existing-one' },
      { rowId: '3', outcome: 'created', uid: 'new-two' },
      { rowId: '4', outcome: 'conflict', code: 'IDENTITY_MISMATCH' },
    ] }) };
  };
  const users = ['new', 'existing', 'delay', 'conflict'].map((name, index) => ({
    rowId: String(index + 1), email: name + '@example.test',
  }));
  const results = await service.provisionBulkUsersViaBackend({ courseId: 'course', labId: 'lab', users });
  assert.deepEqual(sent, ['new@example.test', 'delay@example.test']);
  assert.deepEqual(results[2], { rowId: '3', outcome: 'created', uid: 'new-two', activationEmailFailed: true });
  assert.deepEqual(results[3], { rowId: '4', outcome: 'conflict', code: 'IDENTITY_MISMATCH' });
});

test('provisioning includes JSON overhead and Unicode bytes and retains confirmed chunks after failure', async (t) => {
  const previousFetch = global.fetch;
  const previousOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://ppk.example.test';
  t.after(() => {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previousOrigin;
  });

  const reset = [];
  const service = loadSource('services/aslab/labAssignmentService', {
    '@/config/firebase': { getFirebaseAuth: () => ({ currentUser: { getIdToken: async () => 'fixture' } }) },
    '@/services/payments/paymentData': { resolvePaymentApiOrigin: (base) => base },
    '@/services/authService': { kirimResetPassword: async (email) => { reset.push(email); } },
  });
  const sent = [];
  global.fetch = async (_url, { body }) => {
    const { users } = JSON.parse(body);
    assert.ok(Buffer.byteLength(body, 'utf8') < 14_000);
    assert.ok(users.length <= 100);
    sent.push(users);
    if (sent.length === 2) throw new Error('fixture network interruption');
    return { ok: true, json: async () => ({ results: users.map(({ rowId }) => ({
      rowId, uid: rowId, outcome: 'created',
    })) }) };
  };
  const users = Array.from({ length: 102 }, (_, index) => ({
    rowId: 'row-' + index, role: 'praktikan', email: 'u' + index + '@example.test',
    nim: String(1000 + index), nama: '学'.repeat(110),
  }));
  const outcomes = await service.provisionBulkUsersViaBackend({ courseId: 'mk', labId: 'lab', users });
  assert.equal(sent.length, 2);
  assert.equal(outcomes.length, users.length);
  assert.ok(outcomes.slice(0, sent[0].length).every(({ outcome }) => outcome === 'created'));
  assert.ok(outcomes.slice(sent[0].length).every(({ code }) => code === 'PROVISIONING_RETRY'));
  assert.deepEqual(reset, sent[0].map(({ email }) => email));
});

test('T-06 & T-07: transfers praktikan and asprak atomically between labs without changing schedules', async () => {
  const operations = [];
  const mockDb = {};
  let destinationExists = false;

  const mockBatch = {
    set: (ref, data) => operations.push({ type: 'set', ref, data }),
    update: (ref, data) => operations.push({ type: 'update', ref, data }),
    commit: async () => {},
  };

  const labAssignmentService = loadSource('services/aslab/labAssignmentService', {
    '@/config/firebase': {
      getFirebaseDb: () => mockDb,
      getFirebaseAuth: () => ({ currentUser: null }),
    },
    '@/services/payments/paymentData': {
      resolvePaymentApiOrigin: () => 'http://localhost:4000',
    },
    'firebase/firestore': {
      collection: (db, name) => ({ collectionName: name }),
      doc: (dbOrColl, ...segments) => {
        const id = segments.length > 0 ? segments[segments.length - 1] : 'gen-id';
        const prefix = dbOrColl?.collectionName || 'doc';
        return { id, path: `${prefix}/${segments.join('/') || id}` };
      },
      serverTimestamp: () => 'server-time',
      writeBatch: () => mockBatch,
      runTransaction: async (_db, work) => work({
        ...mockBatch, get: async () => ({ exists: () => destinationExists }),
      }),
      arrayUnion: (...items) => items,
      arrayRemove: (...items) => items,
      query: () => ({}),
      where: () => ({}),
      getDoc: async () => ({ exists: () => false }),
      getDocs: async () => ({ docs: [] }),
    },
  });

  const actorAslab = { uid: 'aslab-1', role: 'aslab', nama: 'Aslab', email: 'aslab@univ.ac.id' };

  // Transfer Praktikan: rejects same origin and destination
  await assert.rejects(
    () => labAssignmentService.transferPraktikan(actorAslab, 'lab-a', 'lab-a', { uid: 'u1', nim: '123', nama: 'Andi' }),
    /berbeda/,
  );

  // Transfer Praktikan Lab A -> Lab B
  operations.length = 0;
  await labAssignmentService.transferPraktikan(actorAslab, 'lab-a', 'lab-b', { uid: 'u1', nim: '123', nama: 'Andi' });
  assert.equal(operations.length, 2);
  assert.equal(operations[0].type, 'update');
  assert.equal(operations[0].ref.id, 'lab-a_u1');
  assert.deepEqual(Object.keys(operations[0].data).sort(), ['active', 'updatedAt']);
  assert.equal(operations[0].data.active, false); // Deactivated in Lab A
  assert.equal(operations[1].type, 'set');
  assert.equal(operations[1].ref.id, 'lab-b_u1');
  assert.equal(operations[1].data.active, true); // Activated in Lab B
  assert.deepEqual(Object.keys(operations[1].data).sort(), [
    'active',
    'classId',
    'createdAt',
    'nama',
    'nim',
    'uid',
    'updatedAt',
  ]);
  destinationExists = true;
  operations.length = 0;
  await labAssignmentService.transferPraktikan(actorAslab, 'lab-b', 'lab-a', { uid: 'u1', nim: '123', nama: 'Andi' });
  assert.equal(operations[1].type, 'update');
  assert.equal(operations[1].data.active, true);
  assert.equal('createdAt' in operations[1].data, false);

  // Transfer Asprak Lab A -> Lab B
  operations.length = 0;
  await labAssignmentService.transferAsprak(actorAslab, 'lab-a', 'lab-b', {
    uid: 'asprak-1', nip: '999', nama: 'Rina', courseId: 'source-course',
  }, { targetCourseId: 'target-course' });
  assert.equal(operations.length, 4);
  assert.equal(operations[0].type, 'update'); // Deactivated old assignment
  assert.equal(operations[0].data.active, false);
  assert.equal(operations[1].type, 'set'); // Created new assignment
  assert.equal(operations[1].data.active, true);
  assert.equal(operations[1].data.courseId, 'target-course');
  assert.equal(operations[2].type, 'update'); // Removed from lab A asprakUids
  assert.equal(operations[3].type, 'update'); // Added to lab B asprakUids
});

// ============================================================================
// 8. Dashboard Metrics & Date Filtering: Hari, Minggu, Bulan (T-09..T-13)
// ============================================================================
test('T-09..T-12: computes dashboard metrics and filters correctly for hari, minggu, and bulan', () => {
  const refDate = new Date('2026-11-25T10:00:00.000Z');

  const rangeHari = getDateRange('hari', refDate);
  const rangeMinggu = getDateRange('minggu', refDate);
  const rangeBulan = getDateRange('bulan', refDate);

  assert.ok(rangeHari.label.length > 0);
  assert.ok(rangeMinggu.label.length > 0);
  assert.ok(rangeBulan.label.length > 0);

  assert.equal(isDateWithinRange('2026-11-25', rangeHari), true);
  assert.equal(isDateWithinRange('2026-11-24', rangeHari), false);

  assert.equal(isDateWithinRange('2026-11-24', rangeMinggu), true);
  assert.equal(isDateWithinRange('2026-11-20', rangeMinggu), false); // Previous week

  assert.equal(isDateWithinRange('2026-11-05', rangeBulan), true);
  assert.equal(isDateWithinRange('2026-10-25', rangeBulan), false);

  // Sample data
  const laboratories = [
    { id: 'lab-1', nama: 'Lab PPK A', kode: 'A', gedung: 'Gedung F', latitude: -7.95, longitude: 112.61, radiusMeters: 30, kapasitas: 30, aktif: true, asprakUids: ['asprak-1'] },
    { id: 'lab-2', nama: 'Lab PPK B', kode: 'B', gedung: 'Gedung F', latitude: -7.95, longitude: 112.61, radiusMeters: 30, kapasitas: 30, aktif: true, asprakUids: [] },
  ];

  const sessions = [
    { id: 's1', labId: 'lab-1', topik: 'Sesi Hari Ini', status: 'dibuka', tanggal: '2026-11-25', jamMulai: '08:00', jamSelesai: '10:00', praktikumId: 'c1', kelasId: 'lab-1', asistenId: 'a1', ruang: 'R301' },
    { id: 's2', labId: 'lab-2', topik: 'Sesi Kemarin', status: 'ditutup', tanggal: '2026-11-24', jamMulai: '08:00', jamSelesai: '10:00', praktikumId: 'c1', kelasId: 'lab-2', asistenId: 'a1', ruang: 'R302' },
    { id: 's3', labId: 'lab-1', topik: 'Sesi Bulan Lalu', status: 'ditutup', tanggal: '2026-10-20', jamMulai: '08:00', jamSelesai: '10:00', praktikumId: 'c1', kelasId: 'lab-1', asistenId: 'a1', ruang: 'R301' },
  ];

  const classMembers = [
    { classId: 'lab-1', uid: 'm1', active: true },
    { classId: 'lab-1', uid: 'm2', active: true },
    { classId: 'lab-2', uid: 'm3', active: true },
  ];

  const fines = [
    { id: 'f1', uid: 'm1', praktikanNama: 'Andi', labId: 'lab-1', labNama: 'Lab PPK A', sessionId: 's1', sessionTopik: 'Sesi Hari Ini', sessionTanggal: '2026-11-25', amount: 10000, status: 'paid', lateMinutes: 5 },
    { id: 'f2', uid: 'm2', praktikanNama: 'Budi', labId: 'lab-1', labNama: 'Lab PPK A', sessionId: 's1', sessionTopik: 'Sesi Hari Ini', sessionTanggal: '2026-11-25', amount: 10000, status: 'unpaid', lateMinutes: 10 },
    { id: 'f3', uid: 'm3', praktikanNama: 'Citra', labId: 'lab-2', labNama: 'Lab PPK B', sessionId: 's2', sessionTopik: 'Sesi Kemarin', sessionTanggal: '2026-11-24', amount: 10000, status: 'paid', lateMinutes: 2 },
  ];

  // Test filter: 'hari'
  const metricsHari = calculateDashboardMetrics({
    laboratories, sessions, classMembers, fines, filter: 'hari', referenceDate: refDate,
  });
  assert.equal(metricsHari.totalLabs, 2);
  assert.equal(metricsHari.totalPraktikan, 3);
  assert.equal(metricsHari.ongoingSessions.length, 1);
  assert.equal(metricsHari.completedSessions.length, 0); // Yesterday's session not included
  assert.equal(metricsHari.fineTotalPaid, 10000);
  assert.equal(metricsHari.fineTotalUnpaid, 10000);
  assert.equal(metricsHari.paymentRatio, 0.5); // 10000 / 20000

  // Lab 1 should be 'Sedang Praktikum', Lab 2 should be 'Kosong'
  assert.equal(metricsHari.labStatuses[0].statusText, 'Sedang Praktikum');
  assert.equal(metricsHari.labStatuses[1].statusText, 'Kosong');

  // Test filter: 'minggu'
  const metricsMinggu = calculateDashboardMetrics({
    laboratories, sessions, classMembers, fines, filter: 'minggu', referenceDate: refDate,
  });
  assert.equal(metricsMinggu.ongoingSessions.length, 1);
  assert.equal(metricsMinggu.completedSessions.length, 1); // Yesterday included in this week
  assert.equal(metricsMinggu.fineTotalPaid, 20000); // 2 paid this week

  // Test filter: 'bulan'
  const metricsBulan = calculateDashboardMetrics({
    laboratories, sessions, classMembers, fines, filter: 'bulan', referenceDate: refDate,
  });
  assert.equal(metricsBulan.completedSessions.length, 1); // October session excluded from November
});
