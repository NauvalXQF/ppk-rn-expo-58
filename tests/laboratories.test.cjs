const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { setImmediate: flushAsyncWork } = require('node:timers/promises');
const { runInThisContext } = require('node:vm');
const ts = require('typescript');

function loadMapsSource(name, runtimeModules = {}) {
  const file = resolve('src', /\.tsx?$/.test(name) ? name : `${name}.ts`);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const requireSource = (id) => runtimeModules[id] ?? require(id);
  runInThisContext(`(function(module, exports, require) { ${code}\n })`, { filename: file })(
    module, module.exports, requireSource,
  );
  return module.exports;
}

const laboratories = loadMapsSource('services/maps/laboratories');
const labActivity = loadMapsSource('services/maps/labActivity');
const { activeLaboratories, readLaboratory, selectLaboratories, validateLaboratory } = laboratories;
const { getLabActivities, parseActivityTime } = labActivity;

const lab = {
  id: 'lab-a', nama: 'Lab A', kode: 'A', gedung: 'Gedung A',
  latitude: -7.052, longitude: 110.44, radiusMeters: 30, kapasitas: 24, aktif: true,
};

test('validates latitude and longitude inclusively and rejects non-finite or nonnumeric coordinates', () => {
  for (const [latitude, longitude] of [[-90, -180], [90, 180], [0, 0]]) {
    assert.equal(validateLaboratory({ ...lab, latitude, longitude }), null);
  }
  for (const latitude of [-90.001, 90.001, NaN, Infinity, '0']) {
    assert.match(validateLaboratory({ ...lab, latitude }), /Latitude/);
  }
  for (const longitude of [-180.001, 180.001, NaN, -Infinity]) {
    assert.match(validateLaboratory({ ...lab, longitude }), /longitude/);
  }
});

test('validates radius inclusively and rejects empty or invalid laboratory fields', () => {
  for (const radiusMeters of [10, 30, 500]) {
    assert.equal(validateLaboratory({ ...lab, radiusMeters }), null);
  }
  for (const radiusMeters of [9.99, 500.01, '', NaN, Infinity]) {
    assert.match(validateLaboratory({ ...lab, radiusMeters }), /Radius/);
  }
  assert.match(validateLaboratory({ ...lab, nama: '  ' }), /nama/);
  assert.match(validateLaboratory({ ...lab, kapasitas: -1 }), /Kapasitas/);
});

test('reads only valid records, displays active labs, and never substitutes mock for existing documents', () => {
  const archived = { ...lab, id: 'lab-b', aktif: false };
  const mock = [{ ...lab, id: 'mock' }];
  assert.deepEqual(readLaboratory('lab-a', lab), lab);
  assert.equal(readLaboratory('lab-a', {}), null);
  assert.equal(readLaboratory('lab-a', null), null);
  assert.equal(readLaboratory('other', lab), null);
  assert.equal(readLaboratory('lab-a', { ...lab, aktif: 'true' }), null);
  assert.equal(readLaboratory('lab-a', { ...lab, latitude: 100 }), null);
  assert.deepEqual(activeLaboratories([lab, archived]), [lab]);
  assert.deepEqual(activeLaboratories([]), []);
  assert.deepEqual(selectLaboratories(0, [], mock), mock);
  assert.deepEqual(selectLaboratories(0, [], []), []);
  assert.deepEqual(selectLaboratories(2, [lab, archived], mock), [lab, archived]);
  assert.deepEqual(selectLaboratories(1, [], mock), []);
});

const now = new Date(2026, 10, 19, 10).getTime();
const hour = 60 * 60 * 1000;
function session(id, status, start, end, extra = {}) {
  return { id, labId: 'lab-a', classId: 'kelas-a', status, start, end, ...extra };
}

test('picks an open session ahead of an in-window planned session and excludes completed sessions', () => {
  const planned = session('planned', 'dijadwalkan', now - hour, now + hour);
  const opened = session('opened', 'dibuka', now - 2 * hour, now - hour);
  const closed = session('closed', 'ditutup', now - hour, now + hour);
  const otherLab = session('other', 'dibuka', now, now + hour, { labId: 'lab-b' });
  const activity = getLabActivities([planned, opened, closed, otherLab], [], now);
  assert.equal(activity.get('lab-a').ongoing.id, 'opened');
  assert.equal(activity.get('lab-b').ongoing.id, 'other');
  assert.equal(getLabActivities([planned, closed], [], now).get('lab-a').ongoing.id, 'planned');
  const afterClose = getLabActivities([planned, closed], [], now + hour).get('lab-a');
  assert.equal(afterClose.ongoing, undefined);
  assert.equal(afterClose.lastCompleted.id, 'closed');
  assert.equal(getLabActivities([closed], [], now).size, 0);
  assert.equal(getLabActivities([], [], now).size, 0);
});

test('combines sessions and schedules without duplicating a materialized slot and returns the next three', () => {
  const sessions = [
    session('later', 'dijadwalkan', now + 5 * hour, now + 6 * hour),
    session('first', 'dijadwalkan', now + hour, now + 2 * hour, { scheduleId: 'concrete' }),
    session('third', 'dijadwalkan', now + 3 * hour, now + 4 * hour),
    session('past', 'dijadwalkan', now - 2 * hour, now - hour),
    session('closed', 'ditutup', now + hour, now + 2 * hour),
    session('unlinked', 'dijadwalkan', now + hour, now + 2 * hour, { labId: '' }),
  ];
  const schedules = [
    { id: 'second', labId: 'lab-a', classId: 'kelas-a', start: now + 2 * hour, end: now + 3 * hour },
    { id: 'concrete', labId: 'lab-a', classId: 'kelas-a', start: now + hour, end: now + 2 * hour },
    { id: 'weekly', labId: 'lab-b', classId: 'kelas-a', weekday: new Date(now).getDay(), startTime: '09:00', endTime: '10:00' },
    { id: 'tomorrow', labId: 'lab-c', classId: 'kelas-a', weekday: new Date(2026, 10, 20).getDay(), startTime: '09:00', endTime: '10:00' },
  ];
  const activity = getLabActivities(sessions, schedules, now);
  assert.deepEqual(activity.get('lab-a').upcoming.map(({ id }) => id), ['first', 'second', 'third']);
  assert.equal(activity.has('lab-b'), false);
  assert.equal(activity.get('lab-c').upcoming[0].start, new Date(2026, 10, 20, 9).getTime());
  const midnight = new Date(2026, 10, 21).getTime();
  assert.equal(getLabActivities([session('outside', 'dijadwalkan', midnight, midnight + hour)], [], now).size, 0);
});

test('accepts Sprint 2 local session datetime and rejects malformed dates and times', () => {
  assert.equal(parseActivityTime('2026-11-19T10:00:00'), now);
  assert.equal(parseActivityTime('2026-11-19T10:00:00+07:00'), Date.UTC(2026, 10, 19, 3));
  assert.ok(Number.isNaN(parseActivityTime('2026-02-30T10:00:00')));
  assert.ok(Number.isNaN(parseActivityTime('2026-11-19T24:00:00')));
  assert.ok(Number.isNaN(parseActivityTime('10:00')));
  assert.ok(Number.isNaN(parseActivityTime(Number.MAX_SAFE_INTEGER)));
});

test('removes a late location subscription after backgrounding and the next watcher on tab cleanup', async () => {
  let cleanEffect;
  let changeAppState;
  let removedAppListener = 0;
  let removedWatchers = 0;
  const pending = [];
  const reported = [];
  let reportPosition;
  const { useUserLocation } = loadMapsSource('features/maps/useUserLocation', {
    '@/services/maps/laboratories': laboratories,
    react: {
      useEffect: (setup) => { cleanEffect = setup(); },
      useRef: (current) => ({ current }),
      useState: (initial) => [initial, (state) => reported.push(state)],
    },
    'react-native': {
      AppState: {
        currentState: 'active',
        addEventListener: (_event, callback) => {
          changeAppState = callback;
          return { remove: () => removedAppListener++ };
        },
      },
      Platform: { OS: 'android' },
    },
    'expo-location': {
      Accuracy: { Balanced: 3 },
      getForegroundPermissionsAsync: async () => ({ granted: true }),
      hasServicesEnabledAsync: async () => true,
      watchPositionAsync: (_options, callback) => {
        reportPosition = callback;
        return new Promise((resolve) => pending.push(resolve));
      },
    },
  });
  const subscription = { remove: () => removedWatchers++ };

  useUserLocation(true);
  try {
    await flushAsyncWork();
    assert.equal(pending.length, 1);
    reportPosition({ coords: { latitude: NaN, longitude: 110.44 } });
    assert.equal(reported.at(-1).status, 'searching');
    reportPosition({ coords: { latitude: 0, longitude: 0 } });
    assert.equal(reported.at(-1).status, 'located');
    changeAppState('background');
    pending[0](subscription);
    await flushAsyncWork();
    assert.equal(removedWatchers, 1);
    changeAppState('active');
    await flushAsyncWork();
    assert.equal(pending.length, 2);
    pending[1](subscription);
    await flushAsyncWork();
  } finally {
    cleanEffect();
  }
  assert.equal(removedWatchers, 2);
  assert.equal(removedAppListener, 1);
});

test('does not start lab or activity subscriptions while the map tab is unfocused', () => {
  const subscriptions = [];
  const cleanups = [];
  const stopped = [];
  const updates = [];
  const callbacks = {};
  const subscribe = (name) => (...args) => {
    subscriptions.push(name);
    callbacks[name] = args;
    return () => stopped.push(name);
  };
  const { useLaboratoryData, useMapsActivity } = loadMapsSource('features/maps/useMapsData', {
    react: {
      useEffect: (setup) => cleanups.push(setup()),
      useMemo: (compute) => compute(),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, (state) => updates.push(state)],
    },
    '@/services/maps/laboratoryService': { subscribeLaboratories: subscribe('laboratories') },
    '@/services/maps/labActivity': { getLabActivities },
    '@/services/maps/labActivityService': {
      subscribeActiveClassIds: subscribe('membership'),
      subscribeLabActivity: subscribe('activity'),
    },
  });
  try {
    useLaboratoryData(false);
    useMapsActivity('assistant', true, false);
    useMapsActivity('student', false, false);
    assert.deepEqual(subscriptions, []);
    useLaboratoryData(true);
    useMapsActivity('assistant', true, true);
    useMapsActivity('student', false, true);
    assert.deepEqual(subscriptions, ['laboratories', 'activity', 'membership']);
    callbacks.activity[1].onError({ code: 'permission-denied' });
    assert.match(updates.at(-1).entries[0].error, /ditolak Firestore/);
  } finally {
    cleanups.forEach((cleanup) => cleanup?.());
  }
  assert.deepEqual(stopped, ['laboratories', 'activity', 'membership']);
  updates.length = 0;
  callbacks.laboratories[0]({ laboratories: [] });
  callbacks.membership[1](['kelas-a']);
  callbacks.activity[1].onError(new Error('late callback'));
  assert.deepEqual(updates, []);
});

test('the native map entry defers load failures to the render boundary', async () => {
  const moduleError = new Error("TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found");
  const loaders = [];
  const entries = loadMapsSource('features/maps/LaboratoryMap.native.tsx', {
    react: { ...require('react'), lazy: (load) => { loaders.push(load); return 'lazy'; } },
    'react-native': { StyleSheet: { create: (styles) => styles }, View: 'view', Text: 'text', ActivityIndicator: 'spinner' },
    get './LaboratoryMapRenderer.native'() { throw moduleError; },
    get 'react-native-maps'() { throw moduleError; },
    'expo-symbols': {},
    '@/constants/theme': { Colors: {}, Radius: {}, Spacing: {} },
    './simulatedLaboratories': {},
  });
  assert.equal(typeof entries.default, 'function');
  assert.equal(typeof entries.LabPreview, 'function');
  assert.equal(loaders.length, 2);
  await assert.rejects(loaders[0], moduleError);
  await assert.rejects(loaders[1], moduleError);
  const element = entries.default({}).props.children;
  const boundary = new element.type(element.props);
  boundary.state = element.type.getDerivedStateFromError(moduleError);
  assert.match(boundary.render().props.children, /Peta native gagal dimuat/);
});

test('the Firestore activity adapter excludes archived, cancelled, and malformed records', () => {
  const listeners = {};
  const { subscribeLabActivity } = loadMapsSource('services/maps/labActivityService', {
    'firebase/firestore': {
      collection: (_db, name) => name,
      onSnapshot: (name, _options, callback) => {
        listeners[name] = callback;
        return () => {};
      },
      Timestamp: class Timestamp {},
    },
    '@/config/firebase': { getFirebaseDb: () => ({}) },
    '@/services/practicumService': { toStatusSesi: () => 'dijadwalkan' },
    './labActivity': labActivity,
  });
  const details = { labId: lab.id, classId: 'kelas-a', startAt: now + hour, endAt: now + 2 * hour };
  function snapshot(rows) {
    return { docs: rows.map(([id, data]) => ({ id, data: () => data })), metadata: { fromCache: false } };
  }
  const unsubscribe = subscribeLabActivity(null, {
    onSessions: ({ items }) => assert.deepEqual(items.map(({ id }) => id), ['valid']),
    onSchedules: ({ items }) => assert.deepEqual(items.map(({ id }) => id), ['valid', 'weekly']),
  });
  try {
    listeners.sessions(snapshot([
      ['valid', { ...details, status: 'closed' }],
      ['cancelled', { ...details, status: 'cancelled' }],
      ['unknown', { ...details, status: 'unknown' }],
      ['archived', { ...details, status: 'closed', archived: true }],
    ]));
    const weekly = { ...details, startAt: '10:00', endAt: '11:00', hari: 'Jumat', jamMulai: '10:00', jamSelesai: '11:00' };
    listeners.schedules(snapshot([
      ['valid', details],
      ['weekly', weekly],
      ['cancelled', { ...details, status: 'cancelled' }],
      ['archived', { ...details, archived: true }],
      ['bad-date', { ...weekly, startAt: '2026-02-30T10:00:00' }],
    ]));
  } finally {
    unsubscribe();
  }
});

test('lab form confirms writes, prevents double-submit, and keeps the draft on failure', async () => {
  const states = [];
  const refs = new Map();
  const pending = [];
  let cursor = 0;
  const { LabManagementModal } = loadMapsSource('features/maps/LabManagementModal.tsx', {
    react: {
      useEffect: () => {},
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => {
          states[index] = typeof value === 'function' ? value(states[index]) : value;
        }];
      },
      useRef: (current) => {
        const index = cursor++;
        if (!refs.has(index)) refs.set(index, { current });
        return refs.get(index);
      },
    },
    'react-native': { StyleSheet: { create: (styles) => styles }, View: 'view', Text: 'text' },
    '@/components/ui/AppButton': { AppButton: 'button' },
    '@/components/ui/FormField': { FormField: 'field' },
    '@/components/ui/InfoBanner': { InfoBanner: 'banner' },
    '@/constants/theme': { Colors: {}, FontSize: {}, Spacing: {} },
    '@/services/maps/laboratoryService': {
      saveLaboratory: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    },
    '@/services/maps/laboratories': laboratories,
    './LaboratoryMap': { LabPreview: 'preview' },
    './MapSheet': { MapSheet: 'sheet' },
  });
  function elements() {
    cursor = 0;
    const tree = LabManagementModal({
      visible: true, actor: { role: 'asisten' }, laboratories: [lab], writable: true,
    });
    function flatten(node) {
      if (Array.isArray(node)) return node.flatMap(flatten);
      return node?.props ? [node, ...flatten(node.props.children)] : [];
    }
    return flatten(tree);
  }
  const button = (label) => elements().find((item) => item.type === 'button' && item.props.label === label);
  button('Edit').props.onPress();
  const submit = button('Simpan laboratorium').props.onPress;
  submit();
  submit();
  assert.equal(pending.length, 1);
  pending[0].reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));
  await flushAsyncWork();
  assert.ok(button('Simpan laboratorium'));
  assert.ok(elements().some((item) => item.type === 'banner' && /menolak/.test(item.props.message)));
  button('Simpan laboratorium').props.onPress();
  pending[1].resolve();
  await flushAsyncWork();
  assert.ok(button('Tambah laboratorium'));
  assert.ok(elements().some((item) => item.type === 'banner' && item.props.tone === 'success'));
});
