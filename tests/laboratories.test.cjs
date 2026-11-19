const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { setImmediate: flushAsyncWork } = require('node:timers/promises');
const { runInThisContext } = require('node:vm');
const ts = require('typescript');

function loadMapsSource(name, runtimeModules = {}) {
  const file = resolve('src', `${name}.ts`);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const requireSource = (id) => runtimeModules[id] ?? require(id);
  runInThisContext(`(function(module, exports, require) { ${code}\n })`, { filename: file })(
    module, module.exports, requireSource,
  );
  return module.exports;
}

const { activeLaboratories, readLaboratory, selectLaboratories, validateLaboratory } = loadMapsSource('services/maps/laboratories');
const { getLabActivities, parseActivityTime } = loadMapsSource('services/maps/labActivity');

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
  ];
  const activity = getLabActivities(sessions, schedules, now);
  assert.deepEqual(activity.get('lab-a').upcoming.map(({ id }) => id), ['first', 'second', 'third']);
  assert.equal(activity.get('lab-b').upcoming[0].start, new Date(2026, 10, 26, 9).getTime());
});

test('accepts Sprint 2 local session datetime and rejects malformed dates and times', () => {
  assert.equal(parseActivityTime('2026-11-19T10:00:00'), now);
  assert.equal(parseActivityTime('2026-11-19T10:00:00+07:00'), Date.UTC(2026, 10, 19, 3));
  assert.ok(Number.isNaN(parseActivityTime('2026-02-30T10:00:00')));
  assert.ok(Number.isNaN(parseActivityTime('2026-11-19T24:00:00')));
  assert.ok(Number.isNaN(parseActivityTime('10:00')));
});

test('removes a late location subscription after backgrounding and the next watcher on tab cleanup', async () => {
  let cleanEffect;
  let changeAppState;
  let removedAppListener = 0;
  let removedWatchers = 0;
  const pending = [];
  const { useUserLocation } = loadMapsSource('features/maps/useUserLocation', {
    react: {
      useEffect: (setup) => { cleanEffect = setup(); },
      useRef: (current) => ({ current }),
      useState: (initial) => [initial, () => {}],
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
      watchPositionAsync: () => new Promise((resolve) => pending.push(resolve)),
    },
  });
  const subscription = { remove: () => removedWatchers++ };

  useUserLocation(true);
  try {
    await flushAsyncWork();
    assert.equal(pending.length, 1);
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
