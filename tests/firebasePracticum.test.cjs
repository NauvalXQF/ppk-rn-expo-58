const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const asisten = { id: 'auth-asisten', peran: 'asisten', nama: 'Asisten Uji' };
const praktikan = { id: 'auth-praktikan', peran: 'praktikan', nama: 'Praktikan Uji', kelasId: '' };
const inputSesi = {
  kelasId: 'kelas-a', scheduleId: 'jadwal-a', topik: 'React Native',
  ruang: 'Lab 3', tanggal: '2026-11-25', jamMulai: '10:00', jamSelesai: '12:00',
};

function setup(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const listeners = new Map();
  const user = { uid: praktikan.id, email: 'uji@example.test', displayName: null };
  const snapshot = (ref) => ({
    id: ref.split('/').at(-1),
    exists: () => docs.has(ref),
    data: () => docs.get(ref),
  });
  let transactionQueue = Promise.resolve();
  const applyWrites = (pending) => {
    for (const [ref, value, merge] of pending) {
      docs.set(ref, merge ? { ...docs.get(ref), ...value } : value);
    }
  };
  const firestore = {
    getFirestore: () => ({}),
    doc: (_db, ...segments) => segments.length ? segments.join('/') : { id: 'new-session' },
    collection: (_db, name) => name,
    where: (...params) => params,
    limit: (count) => count,
    query: (name, filter) => ({ name, filter }),
    getDocsFromServer: async ({ name }) => ({
      empty: ![...docs.keys()].some((ref) => ref.startsWith(name + '/')),
    }),
    getDoc: async (ref) => snapshot(ref),
    getDocs: async ({ name, filter }) => ({
      docs: [...docs.keys()]
        .filter((ref) => ref.startsWith(name + '/') && docs.get(ref)[filter[0]] === filter[2])
        .map(snapshot),
    }),
    setDoc: async (ref, data, options) => applyWrites([[ref, data, options?.merge]]),
    updateDoc: async (ref, data) => applyWrites([[ref, data, true]]),
    serverTimestamp: () => 'server-time',
    runTransaction: (_db, work) => {
      const result = transactionQueue.then(async () => {
        const pending = [];
        const get = async (ref) => {
          assert.equal(pending.length, 0, 'Firestore reads must precede writes');
          return snapshot(ref);
        };
        const tx = {
          get,
          set: (ref, data) => pending.push([ref, data]),
          update: (ref, data) => pending.push([ref, data, true]),
        };
        const value = await work(tx);
        applyWrites(pending);
        return value;
      });
      transactionQueue = result.catch(() => {});
      return result;
    },
    onSnapshot: (target, ...args) => {
      const [callback] = typeof args[0] === 'function' ? args : args.slice(1);
      listeners.set(target.name ?? target, callback);
      return () => listeners.delete(target.name ?? target);
    },
  };

  function load(name) {
    const file = path.resolve('src', name + '.ts');
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    const nativeRequire = createRequire(file);
    const requireSource = (id) => {
      if (id === 'firebase/firestore') return firestore;
      if (id === 'firebase/app') return { getApps: () => [{}], getApp: () => ({}) };
      if (id === 'firebase/auth') {
        return {
          createUserWithEmailAndPassword: async () => ({ user }),
          updateProfile: async (current, fields) => Object.assign(current, fields),
        };
      }
      if (id === '@/config/firebase') return { getFirebaseAuth: () => ({}), getFirebaseDb: () => ({}) };
      return id.startsWith('@/') ? load(id.slice(2)) : nativeRequire(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(
      requireSource, module, module.exports,
    );
    return module.exports;
  }

  const emit = (collection, paths, hasPendingWrites = false) => listeners.get(collection)({
    docs: paths.map(snapshot),
    metadata: { hasPendingWrites },
  });
  return { docs, emit, listeners, user, load, service: load('services/practicumService') };
}

test('first and concurrent seed creates only initial classes, schedules and sessions', async () => {
  const { docs, service } = setup();
  await assert.rejects(() => service.seedInitialDataToFirestore(praktikan), /asisten/i);
  await Promise.all([
    service.seedInitialDataToFirestore(asisten, { onlyWhenSessionsEmpty: true }),
    service.seedInitialDataToFirestore(asisten),
  ]);
  assert.ok(docs.has('classes/kelas-a'));
  assert.ok(docs.has('schedules/jadwal-a'));
  assert.equal(docs.get('sessions/sesi-1').asistenUid, asisten.id);
  assert.equal(docs.get('sessions/sesi-1').status, 'closed');
  assert.equal([...docs.keys()].filter((ref) => ref.startsWith('sessions/')).length, 5);
  assert.ok([...docs.keys()].every((ref) => !ref.startsWith('classMembers/')));
});

test('automatic initialization skips a database with an existing session, including archived sessions', async () => {
  const existing = { 'sessions/sesi-existing': { status: 'closed', archived: true } };
  const { docs, service } = setup(existing);
  await service.seedInitialDataToFirestore(asisten, { onlyWhenSessionsEmpty: true });
  assert.deepEqual(Object.fromEntries(docs), existing);
});

test('seed preserves existing documents and does not recreate missing data after initialization', async () => {
  const existing = {
    'classes/kelas-a': { nama: 'Kelas Existing' },
    'schedules/jadwal-a': { classId: 'kelas-a', ruang: 'Existing' },
    'sessions/sesi-1': { status: 'closed', archived: true, closedAt: 'existing' },
    'classMembers/kelas-a_auth-praktikan': { active: false },
  };
  const { docs, service } = setup(existing);
  await service.seedInitialDataToFirestore(asisten);
  for (const [ref, value] of Object.entries(existing)) assert.deepEqual(docs.get(ref), value);
  assert.ok(docs.has('sessions/sesi-2'));
  docs.delete('sessions/sesi-2');
  const initialized = [...docs];
  await service.seedInitialDataToFirestore(asisten);
  assert.deepEqual([...docs], initialized);
});

test('initialization skips absent child fixtures under archived classes and schedules', async () => {
  const { docs, service } = setup({
    'classes/kelas-a': { archived: true },
    'schedules/jadwal-b': { classId: 'kelas-b', archived: true },
  });
  await service.seedInitialDataToFirestore(asisten);
  assert.equal(docs.has('schedules/jadwal-a'), false);
  assert.equal(docs.has('sessions/sesi-1'), false);
  assert.equal(docs.has('sessions/sesi-4'), false);
  assert.deepEqual(docs.get('schedules/jadwal-b'), { classId: 'kelas-b', archived: true });
});

test('assistant session listener emits empty results and waits on pending writes', () => {
  const { service, emit } = setup({ 'sessions/sesi-1': { ...inputSesi, status: 'open' } });
  const seen = [];
  const noop = () => {};
  service.subscribePracticumRealtime(asisten, {
    onSessions: (sessions) => seen.push(sessions),
    onClasses: noop, onSchedules: noop, onMembers: noop,
  });
  emit('sessions', ['sessions/sesi-1'], true);
  assert.deepEqual(seen, []);
  emit('sessions', ['sessions/sesi-1']);
  emit('sessions', []);
  assert.equal(seen[0][0].id, 'sesi-1');
  assert.deepEqual(seen[1], []);
});

test('membership requires a registered student and active class, with no self-enrollment', async () => {
  const { docs, service } = setup({
    'classes/kelas-a': { archived: false },
    'classes/kelas-b': { archived: true },
    'users/auth-praktikan': { uid: praktikan.id, role: 'praktikan' },
  });
  const input = { id: praktikan.id, nama: praktikan.nama, kelasId: 'kelas-a' };
  await assert.rejects(() => service.saveClassMemberToFirestore(praktikan, input), /asisten/i);
  await assert.rejects(() => service.saveClassMemberToFirestore(asisten, { ...input, id: undefined }));
  await assert.rejects(() => service.saveClassMemberToFirestore(asisten, { ...input, id: 'unknown' }));
  await assert.rejects(() => service.saveClassMemberToFirestore(asisten, { ...input, kelasId: 'kelas-b' }));
  await service.saveClassMemberToFirestore(asisten, input);
  const ref = 'classMembers/kelas-a_auth-praktikan';
  assert.equal(docs.get(ref).uid, praktikan.id);
  assert.equal(docs.get(ref).createdAt, 'server-time');
  await service.deleteClassMemberFromFirestore(asisten, praktikan.id, 'kelas-a');
  assert.equal(docs.get(ref).active, false);
});

test('membership listener opens class subscriptions only for canonical active records and revokes them', () => {
  const ref = 'classMembers/kelas-a_auth-praktikan';
  const { docs, service, listeners, emit } = setup({
    [ref]: { uid: praktikan.id, classId: 'kelas-a' },
    'classMembers/wrong-id': { uid: praktikan.id, classId: 'kelas-b', active: true },
  });
  const noop = () => {};
  const sessions = [];
  service.subscribePracticumRealtime(praktikan, {
    onMembers: noop,
    onClasses: noop,
    onSchedules: noop,
    onSessions: (snapshot) => sessions.push(snapshot),
  });
  emit('classMembers', [ref, 'classMembers/wrong-id']);
  assert.equal(listeners.has('sessions'), false);
  assert.deepEqual(sessions.at(-1), []);
  docs.set(ref, { ...docs.get(ref), active: true });
  emit('classMembers', [ref]);
  assert.equal(listeners.has('sessions'), true);
  docs.set(ref, { ...docs.get(ref), active: false });
  emit('classMembers', [ref]);
  assert.equal(listeners.has('sessions'), false);
  assert.deepEqual(sessions.at(-1), []);
});

test('registration and auth observer converge on the real UID without enrolling the account', async () => {
  const { docs, user, load } = setup();
  const { daftarPraktikan, kePenggunaAplikasi, pastikanProfil } = load('services/authService');
  const registered = { nama: 'Nama Registrasi', email: user.email, password: 'password-uji' };
  await Promise.all([pastikanProfil(user), daftarPraktikan(registered)]);
  const profile = docs.get('users/' + user.uid);
  assert.equal(profile.uid, user.uid);
  assert.equal(profile.nama, registered.nama);
  assert.equal(profile.role, 'praktikan');
  assert.equal(kePenggunaAplikasi({ ...profile, kelasId: 'kelas-a' }).kelasId, '');
  assert.deepEqual([...docs.keys()], ['users/' + user.uid]);
});

test('assistant session lifecycle preserves relations, audit history and archived data', async () => {
  const { docs, service } = setup({
    'classes/kelas-a': { archived: false },
    'schedules/jadwal-a': { classId: 'kelas-a', archived: false },
  });
  await assert.rejects(() => service.saveSessionToFirestore(praktikan, inputSesi), /asisten/i);
  const { id } = await service.saveSessionToFirestore(asisten, { ...inputSesi, scheduleId: undefined });
  const ref = 'sessions/' + id;
  await service.saveSessionToFirestore(asisten, { ...inputSesi, id, tanggal: '2026-11-26' });
  await assert.rejects(() => service.saveSessionToFirestore(asisten, { ...inputSesi, id, kelasId: 'kelas-b' }));
  await assert.rejects(() => service.saveSessionToFirestore(asisten, { ...inputSesi, id, scheduleId: 'jadwal-b' }));
  await service.updateSessionStatusInFirestore(asisten, id, 'open');
  await assert.rejects(() => service.deleteSessionFromFirestore(asisten, id));
  await assert.rejects(() => service.saveSessionToFirestore(asisten, { ...inputSesi, id }));
  await service.saveSessionToFirestore({ ...asisten, id: 'other-assistant' }, {
    ...inputSesi, id, scheduleId: undefined, tanggal: '2026-11-26', topik: 'Topik Baru',
  });
  await service.updateSessionStatusInFirestore(asisten, id, 'closed');
  await assert.rejects(() => service.updateSessionStatusInFirestore(asisten, id, 'open'));
  docs.set(ref + '/attendances/' + praktikan.id, { uid: praktikan.id });
  await service.deleteSessionFromFirestore(asisten, id);
  assert.equal(docs.get(ref).topik, 'Topik Baru');
  assert.equal(docs.get(ref).classId, 'kelas-a');
  assert.equal(docs.get(ref).scheduleId, 'jadwal-a');
  assert.equal(docs.get(ref).asistenUid, asisten.id);
  assert.equal(docs.get(ref).openedAt, 'server-time');
  assert.equal(docs.get(ref).closedAt, 'server-time');
  assert.equal(docs.get(ref).archived, true);
  assert.ok(docs.has(ref + '/attendances/' + praktikan.id));
  await assert.rejects(() => service.saveSessionToFirestore(asisten, { ...inputSesi, id }));
});
