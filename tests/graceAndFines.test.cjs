const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

function setupFirestoreHarness(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const listeners = new Map();
  let listenerSeq = 1;

  const snapshot = (ref) => ({
    id: ref.split('/').at(-1),
    exists: () => docs.has(ref),
    data: () => docs.get(ref),
  });

  const applyWrites = (pending) => {
    for (const [ref, value, merge] of pending) {
      docs.set(ref, merge ? { ...docs.get(ref), ...value } : value);
    }
  };

  let transactionQueue = Promise.resolve();

  const firestore = {
    getFirestore: () => ({}),
    doc: (_db, ...segments) =>
      segments.length ? segments.join('/') : { id: 'new-session' },
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
        .filter(
          (ref) =>
            ref.startsWith(name + '/') &&
            (!filter || docs.get(ref)[filter[0]] === filter[2]),
        )
        .map(snapshot),
    }),
    setDoc: async (ref, data, options) =>
      applyWrites([[ref, data, options?.merge]]),
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
      const baseKey =
        typeof target === 'string'
          ? target
          : target.filter
            ? `${target.name}:${target.filter[0]}=${target.filter[2]}`
            : target.name;
      const entry = { key: baseKey, id: listenerSeq++, callback };
      listeners.set(entry.id, entry);
      return () => listeners.delete(entry.id);
    },
  };

  const cache = new Map();
  function load(name, overrides = {}) {
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
      },
    }).outputText;
    const nativeRequire = createRequire(file);
    const requireSource = (id) => {
      if (overrides[id]) return overrides[id];
      if (id === 'firebase/firestore') return firestore;
      if (id === 'firebase/app') {
        return { getApps: () => [{}], getApp: () => ({}) };
      }
      if (id === 'firebase/auth') {
        return {
          getAuth: () => ({}),
          onAuthStateChanged: () => () => {},
        };
      }
      if (id === '@/config/firebase') {
        return { getFirebaseAuth: () => ({}), getFirebaseDb: () => ({}) };
      }
      return id.startsWith('@/')
        ? load(id.slice(2), overrides)
        : nativeRequire(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
      filename: file,
    })(requireSource, module, module.exports);
    return module.exports;
  }

  const emitKey = (key, paths, hasPendingWrites = false) => {
    const matches = [...listeners.values()].filter((l) => l.key === key);
    for (const entry of matches) {
      entry.callback({
        docs: paths.map(snapshot),
        metadata: { hasPendingWrites },
      });
    }
  };

  const emitDoc = (docPath, hasPendingWrites = false) => {
    const matches = [...listeners.values()].filter((l) => l.key === docPath);
    for (const entry of matches) {
      entry.callback(snapshot(docPath));
    }
    return hasPendingWrites;
  };

  const activeListenerKeys = () =>
    [...listeners.values()].map((entry) => entry.key);

  return {
    docs,
    load,
    emitKey,
    emitDoc,
    activeListenerKeys,
  };
}

const labCoordinates = { latitude: -7.0518, longitude: 110.4404 };
const labTarget = {
  labId: 'lab-ppk-a',
  labNama: 'Lab PPK A',
  coordinates: labCoordinates,
  radiusMeters: 30,
};
const validGeo = {
  latitude: -7.0518,
  longitude: 110.4404,
  accuracy: 5,
  distanceMeters: 0,
  geofenceStatus: 'in_radius',
};

const praktikanA = {
  id: 'uid-praktikan-a',
  peran: 'praktikan',
  nama: 'Praktikan A',
  nim: '245150200111001',
  kelasId: 'lab-ppk-a',
  kelasIds: ['lab-ppk-a'],
};

const praktikanB = {
  id: 'uid-praktikan-b',
  peran: 'praktikan',
  nama: 'Praktikan B',
  nim: '245150200111002',
  kelasId: 'lab-ppk-a',
  kelasIds: ['lab-ppk-a'],
};

const asprakA = {
  id: 'uid-asprak-a',
  peran: 'asprak',
  nama: 'Rina Asprak',
  nip: '225150200111010',
  assignedLabIds: ['lab-ppk-a'],
};

const aslabUser = {
  id: 'uid-aslab-1',
  peran: 'aslab',
  nama: 'Koordinator Aslab',
  nip: '19990001',
  managedCourseIds: ['praktikum-ppk'],
};

test('T-18: attendance at or before exact grace deadline is on_time with zero fine', async () => {
  const scheduledStart = new Date('2026-11-25T10:00:00+07:00');
  const openedAt = new Date(scheduledStart.getTime() - 5 * 60_000).toISOString();
  const exactDeadline = new Date(scheduledStart.getTime() + 15 * 60_000).toISOString();

  const { docs, load } = setupFirestoreHarness({
    'sessions/sesi-1': {
      classId: 'lab-ppk-a',
      courseId: 'praktikum-ppk',
      labId: 'lab-ppk-a',
      labNama: 'Lab PPK A',
      labCoordinates,
      radiusMeters: 30,
      gracePeriodMinutes: 15,
      lateFineAmount: 10000,
      topik: 'Grace Period Test',
      ruang: 'Lab PPK A',
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      status: 'open',
      openedAt,
      closedAt: null,
      archived: false,
    },
  });

  const { submitAttendanceToFirestore } = load('services/attendanceService');
  const withinGrace = await submitAttendanceToFirestore(praktikanB, {
    sesiId: 'sesi-1',
    praktikanId: praktikanB.id,
    waktuPresensi: new Date(scheduledStart.getTime() + 10 * 60_000).toISOString(),
    geo: validGeo,
    labTarget,
  });
  assert.equal(withinGrace.lateStatus, 'on_time');
  assert.equal(withinGrace.fineId, null);
  assert.equal(docs.has(`fines/sesi-1_${praktikanB.id}`), false);

  const saved = await submitAttendanceToFirestore(praktikanA, {
    sesiId: 'sesi-1',
    praktikanId: praktikanA.id,
    waktuPresensi: exactDeadline,
    geo: validGeo,
    labTarget,
  });

  assert.equal(saved.lateStatus, 'on_time');
  assert.equal(saved.lateMinutes, 0);
  assert.equal(saved.fineId, null);

  const attDoc = docs.get(`sessions/sesi-1/attendances/${praktikanA.id}`);
  assert.equal(attDoc.status, 'hadir');
  assert.equal(attDoc.lateStatus, 'on_time');
  assert.equal(attDoc.lateMinutes, 0);
  assert.equal(attDoc.fineId, null);
  assert.equal(docs.has(`fines/sesi-1_${praktikanA.id}`), false);
});

test('T-19 & T-21: late attendance after grace deadline creates single deterministic fine linked to uid, sessionId, and attendanceId', async () => {
  const scheduledStart = new Date('2026-11-25T10:00:00+07:00');
  const openedAt = scheduledStart.toISOString();
  const lateTime = new Date(scheduledStart.getTime() + 16 * 60_000 + 5_000).toISOString();

  const { docs, load } = setupFirestoreHarness({
    'sessions/sesi-1': {
      classId: 'lab-ppk-a',
      courseId: 'praktikum-ppk',
      labId: 'lab-ppk-a',
      labNama: 'Lab PPK A',
      labCoordinates,
      radiusMeters: 30,
      gracePeriodMinutes: 15,
      lateFineAmount: 10000,
      topik: 'Grace Period Late Test',
      ruang: 'Lab PPK A',
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      status: 'open',
      openedAt,
      closedAt: null,
      archived: false,
    },
  });

  const { registerFineCreatedNotifier } = load('services/fines/fineCalculationService');
  const notified = [];
  registerFineCreatedNotifier((payload) => {
    notified.push(payload);
  });

  const { submitAttendanceToFirestore } = load('services/attendanceService');
  const saved = await submitAttendanceToFirestore(praktikanB, {
    sesiId: 'sesi-1',
    praktikanId: praktikanB.id,
    waktuPresensi: lateTime,
    geo: validGeo,
    labTarget,
  });

  const expectedFineId = `sesi-1_${praktikanB.id}`;
  assert.equal(saved.lateStatus, 'late');
  assert.equal(saved.lateMinutes, 2);
  assert.equal(saved.fineId, expectedFineId);

  const fineDoc = docs.get(`fines/${expectedFineId}`);
  assert.ok(fineDoc, 'Fine document must be created');
  assert.equal(fineDoc.id, expectedFineId);
  assert.equal(fineDoc.uid, praktikanB.id);
  assert.equal(fineDoc.sessionId, 'sesi-1');
  assert.equal(fineDoc.attendanceId, `sessions/sesi-1/attendances/${praktikanB.id}`);
  assert.equal(fineDoc.courseId, 'praktikum-ppk');
  assert.equal(fineDoc.labId, 'lab-ppk-a');
  assert.equal(fineDoc.lateMinutes, 2);
  assert.equal(fineDoc.amount, 10000);
  assert.equal(fineDoc.status, 'unpaid');

  assert.equal(notified.length, 1);
  assert.equal(notified[0].fineId, expectedFineId);
  assert.equal(notified[0].amount, 10000);
  registerFineCreatedNotifier(null);
});

test('effectiveStart = max(scheduledStart, openedAt) uses openedAt when session opens late', () => {
  const { load } = setupFirestoreHarness();
  const { evaluateAttendanceLateness } = load('services/fines/fineCalculationService');

  const scheduledStart = new Date('2026-11-25T10:00:00+07:00');
  const openedLate = new Date(scheduledStart.getTime() + 10 * 60_000).toISOString();
  const at1020 = new Date(scheduledStart.getTime() + 20 * 60_000);
  const at1026 = new Date(scheduledStart.getTime() + 26 * 60_000);

  const onTimeEval = evaluateAttendanceLateness({
    session: {
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      openedAt: openedLate,
      gracePeriodMinutes: 15,
      lateFineAmount: 15000,
    },
    recordedAt: at1020,
  });
  assert.equal(onTimeEval.lateStatus, 'on_time');
  assert.equal(onTimeEval.lateMinutes, 0);
  assert.equal(onTimeEval.shouldCreateFine, false);

  const lateEval = evaluateAttendanceLateness({
    session: {
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      openedAt: openedLate,
      gracePeriodMinutes: 15,
      lateFineAmount: 15000,
    },
    recordedAt: at1026,
  });
  assert.equal(lateEval.lateStatus, 'late');
  assert.equal(lateEval.lateMinutes, 1);
  assert.equal(lateEval.shouldCreateFine, true);
  assert.equal(lateEval.fineAmount, 15000);
});

test('T-20 & T-22: fine creation is idempotent and paid status leaves attendance record immutable', async () => {
  const scheduledStart = new Date('2026-11-25T10:00:00+07:00');
  const lateTime = new Date(scheduledStart.getTime() + 20 * 60_000).toISOString();
  const fineKey = `fines/sesi-1_${praktikanB.id}`;

  const { docs, load } = setupFirestoreHarness({
    'sessions/sesi-1': {
      classId: 'lab-ppk-a',
      courseId: 'praktikum-ppk',
      labId: 'lab-ppk-a',
      labNama: 'Lab PPK A',
      labCoordinates,
      radiusMeters: 30,
      gracePeriodMinutes: 15,
      lateFineAmount: 10000,
      topik: 'Idempotency Test',
      ruang: 'Lab PPK A',
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      status: 'open',
      openedAt: scheduledStart.toISOString(),
      closedAt: null,
      archived: false,
    },
    [fineKey]: {
      id: `sesi-1_${praktikanB.id}`,
      uid: praktikanB.id,
      sessionId: 'sesi-1',
      amount: 10000,
      status: 'paid',
    },
  });

  const { submitAttendanceToFirestore } = load('services/attendanceService');
  await submitAttendanceToFirestore(praktikanB, {
    sesiId: 'sesi-1',
    praktikanId: praktikanB.id,
    waktuPresensi: lateTime,
    geo: validGeo,
    labTarget,
  });

  assert.equal(docs.get(fineKey).status, 'paid');
  assert.equal(
    docs.get(`sessions/sesi-1/attendances/${praktikanB.id}`).status,
    'hadir',
  );
  assert.equal(
    docs.get(`sessions/sesi-1/attendances/${praktikanB.id}`).lateStatus,
    'late',
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanB, {
        sesiId: 'sesi-1',
        praktikanId: praktikanB.id,
        waktuPresensi: lateTime,
        geo: validGeo,
        labTarget,
      }),
    /Presensi ganda ditolak/,
  );
});

test('T-23: approved leave produces excused absence (izin), keeps jumlahHadir excluded, and waives unpaid fine', async () => {
  const { docs, load } = setupFirestoreHarness({
    'fines/sesi-1_uid-praktikan-a': {
      id: 'sesi-1_uid-praktikan-a',
      uid: praktikanA.id,
      sessionId: 'sesi-1',
      status: 'unpaid',
      amount: 10000,
    },
    'fines/sesi-2_uid-praktikan-a': {
      id: 'sesi-2_uid-praktikan-a',
      uid: praktikanA.id,
      sessionId: 'sesi-2',
      status: 'paid',
      amount: 10000,
    },
  });

  const {
    createInMemoryPermissionRepository,
    decideLeaveRequest,
    submitLeaveRequest,
  } = load('services/permissionService');
  const { waiveUnpaidFineInFirestore } = load(
    'services/fines/fineCalculationService',
  );
  const selectors = load('store/selectors');

  const repo = createInMemoryPermissionRepository();
  const actorPraktikan = {
    uid: praktikanA.id,
    role: 'praktikan',
    displayName: praktikanA.nama,
    nim: praktikanA.nim,
    classIds: ['lab-ppk-a'],
  };

  const leave1 = await submitLeaveRequest(
    {
      actor: actorPraktikan,
      session: {
        id: 'sesi-1',
        classId: 'lab-ppk-a',
        className: 'Lab PPK A',
        topic: 'Topik 1',
        date: '2026-11-25',
        startTime: '10:00',
        endTime: '12:00',
        status: 'dijadwalkan',
      },
      reason: 'Sakit demam tinggi sejak pagi',
    },
    { repository: repo },
  );

  const leave2 = await submitLeaveRequest(
    {
      actor: actorPraktikan,
      session: {
        id: 'sesi-2',
        classId: 'lab-ppk-a',
        className: 'Lab PPK A',
        topic: 'Topik 2',
        date: '2026-11-26',
        startTime: '10:00',
        endTime: '12:00',
        status: 'dijadwalkan',
      },
      reason: 'Izin lomba nasional kampus',
    },
    { repository: repo },
  );

  const actorAsprak = {
    uid: asprakA.id,
    role: 'asprak',
    displayName: asprakA.nama,
    nip: asprakA.nip,
    assignedLabIds: ['lab-ppk-a'],
  };

  await decideLeaveRequest(
    { actor: actorAsprak, requestId: leave1.request.id, decision: 'approved' },
    { repository: repo, onApproveWaiveFine: waiveUnpaidFineInFirestore },
  );
  await decideLeaveRequest(
    { actor: actorAsprak, requestId: leave2.request.id, decision: 'approved' },
    { repository: repo, onApproveWaiveFine: waiveUnpaidFineInFirestore },
  );

  assert.equal(docs.get('fines/sesi-1_uid-praktikan-a').status, 'waived');
  assert.equal(docs.get('fines/sesi-2_uid-praktikan-a').status, 'paid');
  assert.equal(docs.has(`sessions/sesi-1/attendances/${praktikanA.id}`), false);

  const state = {
    currentUser: praktikanA,
    pengguna: [praktikanA, praktikanB],
    praktikum: [{ id: 'praktikum-ppk', nama: 'PPK', kode: 'PPK' }],
    kelas: [{ id: 'lab-ppk-a', nama: 'Lab PPK A', praktikumId: 'praktikum-ppk' }],
    sesi: [
      {
        id: 'sesi-1',
        praktikumId: 'praktikum-ppk',
        kelasId: 'lab-ppk-a',
        asistenId: asprakA.id,
        topik: 'Topik 1',
        ruang: 'Lab PPK A',
        tanggal: '2026-11-25',
        jamMulai: '10:00',
        jamSelesai: '12:00',
        status: 'ditutup',
      },
    ],
    presensi: [
      {
        id: `pres-sesi-1-${praktikanB.id}`,
        sesiId: 'sesi-1',
        praktikanId: praktikanB.id,
        waktuPresensi: '2026-11-25T10:18:00.000Z',
        lateStatus: 'late',
        lateMinutes: 3,
      },
    ],
    approvedLeaves: [
      {
        id: leave1.request.id,
        uid: praktikanA.id,
        sessionId: 'sesi-1',
        classId: 'lab-ppk-a',
        praktikanName: praktikanA.nama,
        praktikanNim: praktikanA.nim,
        reason: leave1.request.reason,
      },
    ],
  };

  const riwayatA = selectors.selectRiwayatPraktikan(state, praktikanA.id);
  assert.equal(riwayatA[0].status, 'izin');

  const rekapDetail = selectors.selectRekapSesiDetail(state, 'sesi-1');
  assert.equal(rekapDetail.jumlahHadir, 1);
  assert.equal(rekapDetail.jumlahTerlambat, 1);
  assert.equal(rekapDetail.jumlahIzin, 1);
  assert.equal(rekapDetail.barisIzin[0].uid, praktikanA.id);
});

test('T-14, T-16, T-07: asprak is strictly scoped to active labAssignments and blocked from class/member management', async () => {
  const { docs, load, emitKey, activeListenerKeys } = setupFirestoreHarness({
    'classes/lab-ppk-a': { nama: 'Lab PPK A', archived: false },
    'classes/lab-ppk-b': { nama: 'Lab PPK B', archived: false },
    'schedules/jadwal-a': { classId: 'lab-ppk-a', archived: false },
    'schedules/jadwal-b': { classId: 'lab-ppk-b', archived: false },
    'laboratories/lab-ppk-a': {
      courseId: 'praktikum-ppk',
      gracePeriodMinutes: 10,
      lateFineAmount: 15000,
    },
    [`labAssignments/lab-ppk-a_${asprakA.id}`]: {
      labId: 'lab-ppk-a',
      uid: asprakA.id,
      active: true,
    },
    [`labAssignments/lab-ppk-b_${asprakA.id}`]: {
      labId: 'lab-ppk-b',
      uid: asprakA.id,
      active: false,
    },
    'users/uid-praktikan-a': { uid: praktikanA.id, role: 'praktikan' },
  });

  const practicum = load('services/practicumService');
  const selectors = load('store/selectors');
  const { appReducer } = load('store/app-context');
  const {
    createInMemoryPermissionRepository,
    subscribeAsistenLeaves,
  } = load('services/permissionService');

  // 1. Asprak cannot manage classes, members, or demo seeding (SRS-03 AC-4 / T-16)
  await assert.rejects(
    () => practicum.saveClassToFirestore(asprakA, { nama: 'Kelas Baru' }),
    /Aslab/,
  );
  await assert.rejects(
    () => practicum.deleteClassFromFirestore(asprakA, 'lab-ppk-a'),
    /Aslab/,
  );
  await assert.rejects(
    () =>
      practicum.saveClassMemberToFirestore(asprakA, {
        id: praktikanA.id,
        nama: praktikanA.nama,
        kelasId: 'lab-ppk-a',
      }),
    /Aslab/,
  );
  await assert.rejects(
    () => practicum.seedInitialDataToFirestore(asprakA),
    /Aslab/,
  );

  // 2. Asprak can create & open sessions on assigned lab-ppk-a (inheriting lab policy),
  //    but is rejected on unassigned lab-ppk-b
  const createdSession = await practicum.saveSessionToFirestore(asprakA, {
    kelasId: 'lab-ppk-a',
    scheduleId: 'jadwal-a',
    labId: 'lab-ppk-a',
    topik: 'Sesi Lab A',
    ruang: 'Lab PPK A',
    tanggal: '2026-11-25',
    jamMulai: '10:00',
    jamSelesai: '12:00',
  });
  assert.equal(createdSession.gracePeriodMinutes, 10);
  assert.equal(createdSession.lateFineAmount, 15000);
  await practicum.updateSessionStatusInFirestore(asprakA, createdSession.id, 'open');
  assert.equal(docs.get(`sessions/${createdSession.id}`).status, 'open');

  await assert.rejects(
    () =>
      practicum.saveSessionToFirestore(asprakA, {
        kelasId: 'lab-ppk-b',
        scheduleId: 'jadwal-b',
        topik: 'Sesi Lab B',
        ruang: 'Lab PPK B',
        tanggal: '2026-11-25',
        jamMulai: '13:00',
        jamSelesai: '15:00',
      }),
    /tanggung jawab Anda/,
  );

  // 3. Realtime listener subscribes only to active assignment and reacts to transfer (T-07)
  const seenLabs = [];
  const seenSessions = [];
  const noop = () => {};
  const unsub = practicum.subscribePracticumRealtime(asprakA, {
    onClasses: noop,
    onMembers: noop,
    onSchedules: noop,
    onSessions: (s) => seenSessions.push(s),
    onAssignedLabs: (labs) => seenLabs.push(labs),
    onError: noop,
  });

  emitKey(`labAssignments:uid=${asprakA.id}`, [
    `labAssignments/lab-ppk-a_${asprakA.id}`,
    `labAssignments/lab-ppk-b_${asprakA.id}`,
  ]);
  assert.deepEqual(seenLabs.at(-1), ['lab-ppk-a']);
  assert.ok(activeListenerKeys().includes('sessions:classId=lab-ppk-a'));
  assert.equal(
    activeListenerKeys().includes('sessions:classId=lab-ppk-b'),
    false,
  );

  // Transfer Asprak A from Lab A -> Lab B
  docs.set(`labAssignments/lab-ppk-a_${asprakA.id}`, {
    labId: 'lab-ppk-a',
    uid: asprakA.id,
    active: false,
  });
  docs.set(`labAssignments/lab-ppk-b_${asprakA.id}`, {
    labId: 'lab-ppk-b',
    uid: asprakA.id,
    active: true,
  });
  emitKey(`labAssignments:uid=${asprakA.id}`, [
    `labAssignments/lab-ppk-a_${asprakA.id}`,
    `labAssignments/lab-ppk-b_${asprakA.id}`,
  ]);
  assert.deepEqual(seenLabs.at(-1), ['lab-ppk-b']);
  assert.equal(
    activeListenerKeys().includes('sessions:classId=lab-ppk-a'),
    false,
  );
  assert.ok(activeListenerKeys().includes('sessions:classId=lab-ppk-b'));
  unsub();

  // 4. Selectors, leave queue, and reducer enforce Asprak isolation (T-14)
  const scopedState = {
    currentUser: asprakA,
    pengguna: [asprakA],
    praktikum: [{ id: 'praktikum-ppk', nama: 'PPK', kode: 'PPK' }],
    kelas: [
      { id: 'lab-ppk-a', nama: 'Lab PPK A', praktikumId: 'praktikum-ppk' },
      { id: 'lab-ppk-b', nama: 'Lab PPK B', praktikumId: 'praktikum-ppk' },
    ],
    jadwal: [
      {
        id: 'jadwal-a',
        praktikumId: 'praktikum-ppk',
        kelasId: 'lab-ppk-a',
        asistenId: asprakA.id,
        hari: 'Rabu',
        jamMulai: '10:00',
        jamSelesai: '12:00',
        ruang: 'Lab A',
        topik: 'A',
      },
      {
        id: 'jadwal-b',
        praktikumId: 'praktikum-ppk',
        kelasId: 'lab-ppk-b',
        asistenId: aslabUser.id,
        hari: 'Kamis',
        jamMulai: '13:00',
        jamSelesai: '15:00',
        ruang: 'Lab B',
        topik: 'B',
      },
    ],
    sesi: [
      {
        id: 'sesi-a',
        praktikumId: 'praktikum-ppk',
        kelasId: 'lab-ppk-a',
        asistenId: asprakA.id,
        topik: 'A',
        ruang: 'Lab A',
        tanggal: '2026-11-25',
        jamMulai: '10:00',
        jamSelesai: '12:00',
        status: 'dijadwalkan',
      },
      {
        id: 'sesi-b',
        praktikumId: 'praktikum-ppk',
        kelasId: 'lab-ppk-b',
        asistenId: aslabUser.id,
        topik: 'B',
        ruang: 'Lab B',
        tanggal: '2026-11-25',
        jamMulai: '13:00',
        jamSelesai: '15:00',
        status: 'dijadwalkan',
      },
    ],
    presensi: [],
  };

  assert.deepEqual(
    selectors.selectJadwalUntukPengguna(scopedState).map((j) => j.id),
    ['jadwal-a'],
  );
  assert.deepEqual(
    selectors.selectSesiUntukPengguna(scopedState).map((s) => s.id),
    ['sesi-a'],
  );
  assert.equal(
    appReducer(scopedState, {
      type: 'TAMBAH_KELAS',
      kelas: { id: 'lab-x', nama: 'X', praktikumId: 'praktikum-ppk' },
    }),
    scopedState,
  );
  assert.equal(
    appReducer(scopedState, { type: 'BUKA_SESI', sesiId: 'sesi-b' }),
    scopedState,
  );

  const leaveRepo = createInMemoryPermissionRepository([
    {
      id: 'leave-a',
      uid: praktikanA.id,
      praktikanName: praktikanA.nama,
      sessionId: 'sesi-a',
      sessionTopic: 'A',
      classId: 'lab-ppk-a',
      className: 'Lab A',
      sessionDate: '2026-11-25',
      reason: 'Sakit',
      aiClassification: {
        status: 'completed',
        category: 'kesehatan',
        confidence: 0.9,
        classifiedAt: '2026-11-25T09:00:00Z',
        errorMessage: null,
      },
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      createdAt: '2026-11-25T09:00:00Z',
      updatedAt: '2026-11-25T09:00:00Z',
    },
    {
      id: 'leave-b',
      uid: 'uid-other',
      praktikanName: 'Lain',
      sessionId: 'sesi-b',
      sessionTopic: 'B',
      classId: 'lab-ppk-b',
      className: 'Lab B',
      sessionDate: '2026-11-25',
      reason: 'Urusan keluarga',
      aiClassification: {
        status: 'completed',
        category: 'keluarga',
        confidence: 0.9,
        classifiedAt: '2026-11-25T09:00:00Z',
        errorMessage: null,
      },
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      createdAt: '2026-11-25T09:00:00Z',
      updatedAt: '2026-11-25T09:00:00Z',
    },
  ]);
  const receivedLeaves = [];
  const unsubLeaves = subscribeAsistenLeaves(
    {
      uid: asprakA.id,
      role: 'asprak',
      displayName: asprakA.nama,
      assignedLabIds: ['lab-ppk-a'],
    },
    (items) => receivedLeaves.push(items),
    undefined,
    leaveRepo,
  );
  assert.deepEqual(
    receivedLeaves.at(-1).map((item) => item.id),
    ['leave-a'],
  );
  unsubLeaves();
});

test('T-37: firestore.rules enforces 3-role RBAC, asprak scoping, deterministic fines, and server-only payments', () => {
  const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert.match(rulesText, /function isAsprak\(\)/);
  assert.match(rulesText, /function isAslab\(\)/);
  assert.match(rulesText, /function isAssignedAsprak\((labId|targetId)\)/);
  assert.match(rulesText, /function statusKeterlambatanValid/);
  assert.match(rulesText, /request\.resource\.data\.geofenceStatus == 'in_radius'/);
  assert.doesNotMatch(rulesText, /bypass_qr/);
  assert.match(rulesText, /requestId == request\.resource\.data\.sessionId \+ '_' \+ request\.auth\.uid/);
  assert.match(rulesText, /isAnggotaKelas\(request\.resource\.data\.classId\)/);
  assert.match(rulesText, /match \/labAssignments\/\{assignmentId\}/);
  const classRules = rulesText.slice(rulesText.indexOf('match /classes/'), rulesText.indexOf('match /classMembers/'));
  assert.match(classRules, /allow create: if validClass\(request\.resource\.data\)/);
  assert.match(classRules, /allow update: if managesCourse\(resource\.data\.get\('praktikumId', null\)\)/);
  assert.match(classRules, /managesCourse\(data\.praktikumId\)/);
  assert.match(rulesText, /match \/classMembers\/\{memberId\}[\s\S]*?allow create: if managesClass\(request\.resource\.data\.classId\)/);
  assert.match(rulesText, /match \/fines\/\{fineId\}/);
  assert.match(rulesText, /fineId == request\.resource\.data\.sessionId \+ '_' \+ request\.auth\.uid/);
  assert.match(rulesText, /request\.resource\.data\.status == 'unpaid'/);
  assert.match(rulesText, /dendaSesuaiPresensi\(request\.resource\.data\)/);
  assert.match(rulesText, /let session = sesi\(fine\.sessionId\)/);
  assert.match(rulesText, /fine\.amount == session\.get\('lateFineAmount', 10000\)/);
  assert.match(rulesText, /request\.resource\.data\.status == 'waived'/);
  assert.match(rulesText, /match \/payments\/\{orderId\}[\s\S]*?allow create, update, delete: if false;/);
});

test('P1-1 & P1-3: WIB (+07:00) schedule parsing, mocked GPS blocking, and master lab sync', async () => {
  const { docs, load } = setupFirestoreHarness({
    'laboratories/lab-ppk-a': {
      nama: 'Lab PPK A Baru',
      latitude: -7.06,
      longitude: 110.45,
      radiusMeters: 40,
      aktif: true,
    },
    'sessions/sesi-sync': {
      classId: 'lab-ppk-a',
      courseId: 'praktikum-ppk',
      labId: 'lab-ppk-a',
      labNama: 'Lab PPK A Lama',
      labCoordinates: { latitude: -7.0518, longitude: 110.4404 },
      radiusMeters: 30,
      gracePeriodMinutes: 15,
      lateFineAmount: 10000,
      topik: 'Sync Lab Test',
      ruang: 'Lab PPK A Lama',
      tanggal: '2026-11-25',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      status: 'open',
      openedAt: '2026-11-25T03:00:00.000Z',
      closedAt: null,
      archived: false,
    },
  });

  const { parseScheduledStartMs } = load('services/fines/fineCalculationService');
  const { evaluateSessionScheduleWindow, parseWibDateTimeMs } = load('utils/date');
  const { submitAttendanceToFirestore } = load('services/attendanceService');

  // 10:00 WIB harus identik dengan 03:00:00Z lintas timezone
  const expectedUtcMs = Date.parse('2026-11-25T03:00:00.000Z');
  assert.equal(parseWibDateTimeMs('2026-11-25', '10:00'), expectedUtcMs);
  assert.equal(parseScheduledStartMs('2026-11-25', '10:00'), expectedUtcMs);
  assert.equal(
    evaluateSessionScheduleWindow(
      { tanggal: '2026-11-25', jamMulai: '10:00', jamSelesai: '12:00' },
      new Date('2026-11-25T03:05:00.000Z'),
    ).isWithinSchedule,
    true,
  );
  assert.equal(
    evaluateSessionScheduleWindow(
      { tanggal: '2026-11-25', jamMulai: '10:00', jamSelesai: '12:00' },
      new Date('2026-11-25T02:59:00.000Z'),
    ).status,
    'BEFORE_START',
  );

  // Fake GPS (isMocked: true) wajib ditolak
  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: 'sesi-sync',
        praktikanId: praktikanA.id,
        waktuPresensi: '2026-11-25T03:05:00.000Z',
        geo: { ...validGeo, latitude: -7.06, longitude: 110.45, isMocked: true },
        labTarget: {
          labId: 'lab-ppk-a',
          labNama: 'Lab PPK A Baru',
          coordinates: { latitude: -7.06, longitude: 110.45 },
          radiusMeters: 40,
          source: 'laboratory',
        },
      }),
    /Fake GPS|Lokasi palsu/i,
  );

  // Koordinat master lab terbaru (-7.06, 110.45) dipakai meski snapshot sesi lama masih (-7.0518, 110.4404)
  const saved = await submitAttendanceToFirestore(praktikanA, {
    sesiId: 'sesi-sync',
    praktikanId: praktikanA.id,
    waktuPresensi: '2026-11-25T03:20:00.000Z',
    geo: { ...validGeo, latitude: -7.06, longitude: 110.45, isMocked: false },
    labTarget: {
      labId: 'lab-ppk-a',
      labNama: 'Lab PPK A Baru',
      coordinates: { latitude: -7.06, longitude: 110.45 },
      radiusMeters: 40,
      source: 'laboratory',
    },
  });
  assert.equal(saved.distanceMeters, 0);
  assert.equal(saved.lateStatus, 'late');
  assert.equal(docs.get(`fines/sesi-sync_${praktikanA.id}`).classId, 'lab-ppk-a');
});
