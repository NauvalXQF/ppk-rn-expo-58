const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
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
  runInThisContext(`(function(module, exports, require, __DEV__) { ${code}\n })`, { filename: file })(
    module, module.exports, requireSource, false,
  );
  return module.exports;
}

function jsxElements(node) {
  if (Array.isArray(node)) return node.flatMap(jsxElements);
  return node?.props ? [node, ...jsxElements(node.props.children)] : [];
}

const laboratories = loadMapsSource('services/maps/laboratories');
const labActivity = loadMapsSource('services/maps/labActivity');
const protocol = loadMapsSource('features/maps/mapProtocol', { '../../services/maps/laboratories': laboratories });
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

test('a session from another class does not suppress a linked upcoming schedule', () => {
  const schedule = { id: 'shared', labId: 'lab-a', classId: 'kelas-a', start: now + hour, end: now + 2 * hour };
  const foreignSession = session('foreign', 'dijadwalkan', schedule.start, schedule.end, {
    scheduleId: schedule.id, classId: 'kelas-b', labId: 'lab-b',
  });
  const result = getLabActivities([foreignSession], [schedule], now);
  assert.deepEqual(result.get('lab-a')?.upcoming, [schedule]);
  assert.equal(result.get('lab-b')?.upcoming[0].id, foreignSession.id);
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

test('activity replaces scoped listeners when membership, focus, or account changes', () => {
  const state = [];
  const memo = [];
  const effects = [];
  const memberships = [];
  const subscriptions = [];
  let index = 0;
  let effectsToRun;
  const sameDeps = (a, b) => a?.length === b.length && b.every((value, i) => Object.is(value, a[i]));
  const { useMapsActivity: renderMapsActivity } = loadMapsSource('features/maps/useMapsData', {
    react: {
      useState: (initial) => {
        const slot = index++;
        if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
        return [state[slot], (next) => { state[slot] = typeof next === 'function' ? next(state[slot]) : next; }];
      },
      useMemo: (compute, deps) => {
        const slot = index++;
        if (!sameDeps(memo[slot]?.deps, deps)) memo[slot] = { deps, value: compute() };
        return memo[slot].value;
      },
      useEffect: (setup, deps) => {
        const slot = index++;
        if (!sameDeps(effects[slot]?.deps, deps)) effectsToRun.push(() => {
          effects[slot]?.cleanup?.();
          effects[slot] = { deps, cleanup: setup() };
        });
      },
    },
    '@/services/maps/laboratoryService': {},
    '@/services/maps/labActivity': { getLabActivities },
    '@/services/maps/labActivityService': {
      subscribeActiveClassIds: (uid, emit) => {
        const item = { uid, emit, stopped: false };
        memberships.push(item);
        return () => { item.stopped = true; };
      },
      subscribeLabActivity: (classId, callbacks) => {
        const item = { classId, callbacks, stopped: false };
        subscriptions.push(item);
        return () => { item.stopped = true; };
      },
    },
  });
  function render(uid = 'student', focused = true) {
    index = 0;
    effectsToRun = [];
    const result = renderMapsActivity(uid, false, focused);
    effectsToRun.forEach((run) => run());
    return result;
  }

  try {
    assert.equal(render().loading, true);
    assert.equal(subscriptions.length, 0);
    memberships[0].emit(['kelas-a']);
    render();
    const first = subscriptions[0];
    assert.equal(first.classId, 'kelas-a');
    const start = Date.now() - hour;
    first.callbacks.onSessions({ items: [session('real', 'dibuka', start, start + hour)], fromCache: false });
    first.callbacks.onSchedules({ items: [], fromCache: false });
    assert.equal(render().activities.get(lab.id).ongoing.id, 'real');
    const nextStart = Date.now() + hour;
    first.callbacks.onSchedules({
      items: [{ id: 'next', classId: 'kelas-a', labId: lab.id, start: nextStart, end: nextStart + hour }],
      fromCache: false,
    });
    assert.equal(render().activities.get(lab.id).upcoming[0].id, 'next');
    first.callbacks.onSessions({
      items: [session('real', 'ditutup', start, start + hour, { closedTime: Date.now() })], fromCache: false,
    });
    const closed = render().activities.get(lab.id);
    assert.equal(closed.ongoing, undefined);
    assert.equal(closed.lastCompleted.id, 'real');
    first.callbacks.onSchedules({ items: [], fromCache: false });
    assert.deepEqual(render().activities.get(lab.id).upcoming, []);
    memberships[0].emit(['kelas-a']);
    render();
    assert.equal(subscriptions.length, 1);

    memberships[0].emit([]);
    assert.equal(render().activities.size, 0);
    assert.equal(first.stopped, true);
    memberships[0].emit(['kelas-a']);
    assert.equal(render().activities.size, 0);
    const second = subscriptions[1];
    first.callbacks.onSessions({ items: [session('late', 'dibuka', start, start + hour)], fromCache: false });
    assert.equal(render().activities.size, 0);

    assert.equal(render('student', false).activities.size, 0);
    assert.equal(second.stopped, true);
    assert.equal(memberships[0].stopped, true);
    assert.equal(render().loading, true);
    assert.equal(subscriptions.length, 2);
    assert.equal(memberships[1].uid, 'student');
    memberships[1].emit(['kelas-a']);
    render();
    assert.equal(subscriptions.length, 3);

    assert.equal(render('other').activities.size, 0);
    assert.equal(subscriptions[2].stopped, true);
    assert.equal(subscriptions.length, 3);
    assert.equal(memberships[1].stopped, true);
    assert.equal(memberships[2].uid, 'other');
  } finally {
    effects.forEach((effect) => effect.cleanup?.());
  }
});

test('the native map entry defers load failures to the render boundary', async () => {
  const moduleError = new Error('RNCWebViewModule could not be found');
  const loaders = [];
  const entries = loadMapsSource('features/maps/LaboratoryMap.native.tsx', {
    react: { ...require('react'), lazy: (load) => { loaders.push(load); return 'lazy'; } },
    'react-native': { StyleSheet: { create: (styles) => styles }, View: 'view', Text: 'text', ActivityIndicator: 'spinner' },
    get './LaboratoryMapRenderer.native'() { throw moduleError; },
    '@/constants/theme': { Colors: {}, Spacing: {} },
  });
  assert.equal(typeof entries.default, 'function');
  assert.equal(typeof entries.LabPreview, 'function');
  assert.equal(typeof entries.LabPickerMap, 'function');
  assert.equal(loaders.length, 3);
  await assert.rejects(loaders[0], moduleError);
  await assert.rejects(loaders[1], moduleError);
  await assert.rejects(loaders[2], moduleError);
  const element = entries.default({}).props.children;
  const boundary = new element.type(element.props);
  boundary.state = element.type.getDerivedStateFromError(moduleError);
  assert.match(boundary.render().props.children, /Peta native gagal dimuat/);
});

test('the map bridge accepts only current, ordered, validated messages within its size limit', () => {
  const { encodeMapMessage, readMapCommand, readMapEvent, mapLabs, mapLocation, mapUpdates } = protocol;
  const labs = mapLabs([lab, { ...lab, id: 'archived', aktif: false }, { ...lab, id: 'bad', radiusMeters: 9 }],
    new Set([lab.id]));
  assert.deepEqual(labs.map(({ id, ongoing }) => [id, ongoing]), [[lab.id, true]]);
  const location = mapLocation({ latitude: 0, longitude: 0, heading: Infinity }, true);
  assert.deepEqual(location, { latitude: 0, longitude: 0, heading: null, assistant: true });
  const state = { labs, location, selection: lab.id };
  const [snapshot] = mapUpdates(undefined, state);
  const encoded = encodeMapMessage(snapshot, '42', 1);
  assert.deepEqual(readMapCommand(encoded, '42', 0)?.data, state);
  assert.equal(readMapCommand(encoded, '43', 0), undefined);
  assert.equal(readMapCommand(encoded, '42', 1), undefined);
  assert.equal(readMapCommand(encoded.replace('"version":1', '"version":2'), '42', 0), undefined);
  assert.equal(readMapCommand('invalid JSON', '42', 0), undefined);
  assert.equal(readMapCommand(encoded.padEnd(600000), '42', 0), undefined);
  assert.equal(encodeMapMessage({ type: 'labSelected', id: 'x'.repeat(600000) }, '42', 1), undefined);
  for (const command of [
    { type: 'navigate', data: '/presensi' },
    { type: 'labs', data: [{ ...labs[0], radiusMeters: 501 }] },
    { type: 'labs', data: [labs[0], labs[0]] },
    { type: 'location', data: { ...location, heading: 361 } },
    { type: 'recenter', data: { latitude: 91, longitude: 0 } },
    { type: 'selection', data: 'invalid/id' },
  ]) {
    assert.equal(readMapCommand(encodeMapMessage(command, '42', 1), '42', 0), undefined);
  }
  assert.equal(readMapEvent(encodeMapMessage({ type: 'labSelected', id: lab.id }, '42', 1), '42', 0).id, lab.id);
  assert.equal(readMapEvent(encodeMapMessage({ type: 'labSelected', id: ' ' }, '42', 1), '42', 0), undefined);
  assert.equal(readMapEvent(encodeMapMessage({ type: 'mapError', code: 'unknown' }, '42', 1), '42', 0), undefined);
  const latest = { ...state, location: { ...location, latitude: 1 } };
  assert.deepEqual(mapUpdates(state, latest), [{ type: 'location', data: latest.location }]);
  assert.deepEqual(mapUpdates(latest, latest), []);
});

test('the local Leaflet document ships its runtime with a matching content-security hash', () => {
  const { default: html } = loadMapsSource('features/maps/leafletHtml.generated');
  const script = html.match(/<script>([\s\S]+)<\/script>/)[1];
  const hash = createHash('sha256').update(script).digest('base64');
  assert.ok(html.includes(`script-src 'sha256-${hash}'`));
  assert.match(html, /Leaflet 1\.9\.4/);
  assert.match(html, /BSD 2-Clause License/);
  assert.match(html, /img-src https:\/\/tile\.openstreetmap\.org data:/);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=|<link[^>]*\bhref=/i);
  assert.doesNotThrow(() => new (require('node:vm').Script)(script));
});

test('the document side handles the two message targets, deduplicates commands and cleans up', () => {
  const sent = [];
  const applied = [];
  let disposed = 0;
  const browser = new EventTarget();
  const document = new EventTarget();
  browser.ReactNativeWebView = { postMessage: (packet) => sent.push(JSON.parse(packet)) };
  const { startNativeMap } = loadMapsSource('features/maps/nativeMapDocument', {
    './leafletMap': { createLeafletMap: () => ({
      apply: (message) => applied.push(message),
      dispose: () => disposed++,
    }) },
    './mapProtocol': protocol,
  });
  startNativeMap(browser, { ownerDocument: document, dataset: { instance: '42' } });
  assert.equal(sent[0].type, 'ready');
  const recenter = { type: 'recenter', data: { latitude: -7.052, longitude: 110.44 } };
  for (const [target, sequence] of [[document, 1], [browser, 1], [browser, 2]]) {
    target.dispatchEvent(new MessageEvent('message', { data: protocol.encodeMapMessage(recenter, '42', sequence) }));
  }
  assert.deepEqual(applied.map(({ sequence }) => sequence), [1, 2]);
  browser.dispatchEvent(new Event('pagehide'));
  document.dispatchEvent(new MessageEvent('message', { data: protocol.encodeMapMessage(recenter, '42', 3) }));
  assert.equal(applied.length, 2);
  assert.equal(disposed, 1);
});

test('Leaflet reuses lab layers and keeps camera state as radius and GPS change', () => {
  const listeners = new Map();
  const markers = [];
  const circles = [];
  const camera = [];
  const selected = [];
  function element() {
    return { setAttribute() {}, classList: { toggle() {} }, style: {}, append() {} };
  }
  function layer(list) {
    const node = element();
    const record = {
      addTo: () => record,
      setLatLng: (point) => { record.position = point; },
      setRadius: (radius) => { record.radius = radius; },
      setIcon: (icon) => { record.icon = icon; },
      getElement: () => node,
      bindPopup: (label) => { record.popup = label; },
      setPopupContent: (label) => { record.popup = label; },
      closePopup() {},
      on: (_event, click) => { record.click = click; },
      getBounds: () => ({}),
      remove: () => { record.removed = true; },
    };
    list.push(record);
    return record;
  }
  const tileLayer = {
    on: (name, callback) => listeners.set(name, callback),
    off: () => listeners.clear(),
    addTo() {},
  };
  const map = {
    fitBounds: () => camera.push('fit'),
    setView: () => camera.push('initial'),
    flyTo: (point) => camera.push(point),
    invalidateSize() {},
    hasLayer: () => false,
    remove: () => camera.push('dispose'),
  };
  const L = {
    map: () => map, tileLayer: () => tileLayer, marker: () => layer(markers), circle: () => layer(circles),
    latLngBounds: () => ({ extend() {} }), divIcon: ({ html }) => html,
  };
  const container = { clientWidth: 600, clientHeight: 400, ownerDocument: { createElement: element } };
  const { createLeafletMap } = loadMapsSource('features/maps/leafletMap', { './mapProtocol': protocol });
  const tileFailures = [];
  const renderer = createLeafletMap(L, container, {
    preview: false, onSelect: (id) => selected.push(id), onTileStatus: (failed) => tileFailures.push(failed),
  });
  const [firstLab] = protocol.mapLabs([lab], new Set());
  renderer.apply({ type: 'snapshot', data: { labs: [firstLab], location: null, selection: null } });
  renderer.apply({ type: 'labs', data: [{ ...firstLab, latitude: -7, radiusMeters: 70, nama: '<b>Lab</b>' }] });
  assert.equal(markers.length, 1);
  assert.equal(circles.length, 1);
  assert.deepEqual(markers[0].position, [-7, lab.longitude]);
  assert.equal(circles[0].radius, 70);
  assert.equal(markers[0].popup.textContent, '<b>Lab</b> · Gedung A');
  markers[0].click();
  assert.deepEqual(selected, [lab.id]);
  renderer.apply({ type: 'selection', data: lab.id });
  const user = { latitude: -7, longitude: 110, heading: 0, assistant: false };
  renderer.apply({ type: 'location', data: user });
  renderer.apply({ type: 'location', data: { ...user, longitude: 111 } });
  assert.equal(markers.length, 2);
  assert.deepEqual(markers[1].position, [-7, 111]);
  assert.deepEqual(camera, ['initial', 'fit']);
  renderer.apply({ type: 'recenter', data: user });
  assert.deepEqual(camera.at(-1), [-7, 110]);
  renderer.apply({ type: 'labs', data: [] });
  assert.equal(markers[0].removed, true);
  assert.equal(circles[0].removed, true);
  listeners.get('loading')();
  listeners.get('tileerror')();
  listeners.get('load')();
  assert.deepEqual(tileFailures, [true]);
  renderer.dispose();
  renderer.dispose();
  assert.equal(listeners.size, 0);
  assert.deepEqual(camera, ['initial', 'fit', [-7, 110], 'dispose']);
});

test('the Maps web location watcher reports denied or unavailable and ignores callbacks after cleanup', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const reported = [];
  const cleared = [];
  let runEffect;
  let position;
  let error;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true, navigator: { geolocation: {
      watchPosition: (onPosition, onError, options) => {
        position = onPosition;
        error = onError;
        assert.equal(options.timeout, 15000);
        return 0;
      },
      clearWatch: (id) => cleared.push(id),
    } } },
  });
  try {
    const { useUserLocation } = loadMapsSource('features/maps/useUserLocation', {
      react: {
        useEffect: (effect) => { runEffect = effect; },
        useRef: (current) => ({ current }),
        useState: (initial) => [initial, (state) => reported.push(state)],
      },
      'react-native': { Platform: { OS: 'web' } },
      'expo-location': {},
      '@/services/maps/laboratories': laboratories,
    });
    useUserLocation(false);
    assert.equal(runEffect(), undefined);
    assert.equal(position, undefined);
    useUserLocation(true);
    const cleanup = runEffect();
    error({ code: 1 });
    assert.deepEqual(reported.at(-1), { status: 'denied', canAskAgain: true });
    error({ code: 3 });
    assert.deepEqual(reported.at(-1), { status: 'unavailable' });
    position({ coords: { latitude: 0, longitude: 0 } });
    assert.equal(reported.at(-1).status, 'located');
    cleanup();
    error({ code: 2 });
    assert.equal(reported.at(-1).status, 'located');
    assert.deepEqual(cleared, [0]);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete globalThis.window;
  }
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
    onSessions: ({ items }) => assert.deepEqual(items.map(({ id, labId }) => [id, labId]), [
      ['valid', 'lab-a'], ['missing-lab', ''], ['space-padded-lab', ' lab-a '], ['invalid-path', ''],
    ]),
    onSchedules: ({ items }) => assert.deepEqual(items.map(({ id }) => id), ['valid', 'weekly']),
  });
  try {
    listeners.sessions(snapshot([
      ['valid', { ...details, status: 'closed' }],
      ['missing-lab', { ...details, labId: undefined, ruang: 'Lab A', status: 'open' }],
      ['space-padded-lab', { ...details, labId: ' lab-a ', status: 'open' }],
      ['invalid-path', { ...details, labId: 'laboratories/lab-a', status: 'open' }],
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
      ['missing-lab', { ...details, labId: undefined, ruang: 'Lab A' }],
      ['invalid-path', { ...details, labId: 'laboratories/lab-a' }],
    ]));
  } finally {
    unsubscribe();
  }
});

test('membership requires a server-confirmed active document for the current UID', () => {
  let emit;
  let stopped = false;
  const updates = [];
  const { subscribeActiveClassIds } = loadMapsSource('services/maps/labActivityService', {
    'firebase/firestore': {
      collection: (_db, name) => name,
      where: (...args) => args,
      query: (...args) => args,
      onSnapshot: (target, options, callback) => {
        assert.deepEqual(target, ['classMembers', ['uid', '==', 'student']]);
        emit = typeof options === 'function' ? options : callback;
        return () => { stopped = true; };
      },
    },
    '@/config/firebase': { getFirebaseDb: () => ({}) },
    '@/services/practicumService': {},
    './labActivity': labActivity,
  });
  const unsubscribe = subscribeActiveClassIds('student', (ids) => updates.push(ids), assert.fail);
  const rows = [
    ['kelas-a_student', 'kelas-a', 'student', true],
    ['kelas-b_student', 'kelas-b', 'student', false],
    ['kelas-c_other', 'kelas-c', 'other', true],
    ['wrong-id', 'kelas-d', 'student', true],
  ];
  const docs = rows.map(([id, classId, uid, active]) => ({ id, data: () => ({ classId, uid, active }) }));
  emit({ docs, metadata: { fromCache: true, hasPendingWrites: false } });
  emit({ docs, metadata: { fromCache: false, hasPendingWrites: true } });
  emit({ docs, metadata: { fromCache: false, hasPendingWrites: false } });
  emit({
    docs: [
      { id: 'kelas-c_student', data: () => ({ classId: 'kelas-c', uid: 'student', active: true }) },
      { id: 'kelas-a_student', data: () => ({ classId: 'kelas-a', uid: 'student', active: true }) },
    ],
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  emit({ docs: [], metadata: { fromCache: false, hasPendingWrites: false } });
  assert.deepEqual(updates, [undefined, undefined, ['kelas-a'], ['kelas-a', 'kelas-c'], []]);
  unsubscribe();
  assert.equal(stopped, true);
});

test('lab listener ignores optimistic archives and publishes the confirmed active list', () => {
  let emit;
  let stopped = false;
  const updates = [];
  const { subscribeLaboratories } = loadMapsSource('services/maps/laboratoryService', {
    'firebase/firestore': {
      collection: (_db, name) => name,
      onSnapshot: (target, options, callback) => {
        assert.equal(target, 'laboratories');
        assert.equal(options.includeMetadataChanges, true);
        emit = callback;
        return () => { stopped = true; };
      },
    },
    '@/config/firebase': { getFirebaseDb: () => ({}) },
    './laboratories': laboratories,
  });
  const unsubscribe = subscribeLaboratories((snapshot) => updates.push(snapshot), assert.fail);
  const archived = { ...lab, aktif: false };
  const emitLab = (item, hasPendingWrites, fromCache = false) => emit({
    docs: [{ id: item.id, data: () => item }], size: 1, metadata: { fromCache, hasPendingWrites },
  });
  emitLab(lab, false, true);
  emitLab(lab, false);
  emitLab(archived, true);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].fromCache, true);
  assert.deepEqual(activeLaboratories(updates.at(-1).laboratories), [lab]);
  emitLab(archived, false);
  assert.deepEqual(activeLaboratories(updates.at(-1).laboratories), []);
  unsubscribe();
  assert.equal(stopped, true);
});

test('lab CRUD persists the master schema and waits for acknowledgements or errors', async () => {
  const writes = [];
  const pending = [];
  const write = (method) => (ref, payload) => {
    writes.push({ method, ref, payload });
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  };
  const { saveLaboratory, archiveLaboratory } = loadMapsSource('services/maps/laboratoryService', {
    'firebase/firestore': {
      collection: (_db, name) => name,
      doc: (ref, ...path) => ({ id: path.at(-1) ?? 'generated-id', collection: typeof ref === 'string' ? ref : path[0] }),
      serverTimestamp: () => 'server-time',
      setDoc: write('create'),
      updateDoc: write('update'),
    },
    '@/config/firebase': { getFirebaseDb: () => ({}) },
    './laboratories': laboratories,
  });
  const actor = { uid: 'assistant', role: 'aslab' };
  const student = { uid: 'student', role: 'praktikan' };
  await assert.rejects(saveLaboratory(student, lab), /Hanya aslab/);
  await assert.rejects(archiveLaboratory(student, lab.id), /Hanya aslab/);
  await assert.rejects(saveLaboratory(actor, { ...lab, radiusMeters: 5 }), /Radius/);
  assert.deepEqual(writes, []);

  let confirmed = false;
  const creating = saveLaboratory(actor, { ...lab, nama: ' Lab A ' }).then(() => { confirmed = true; });
  await flushAsyncWork();
  assert.equal(confirmed, false);
  assert.deepEqual(writes[0], {
    method: 'create', ref: { collection: 'laboratories', id: 'generated-id' },
    payload: { ...lab, id: 'generated-id', updatedAt: 'server-time', updatedBy: actor.uid, createdBy: actor.uid, createdAt: 'server-time' },
  });
  pending[0].resolve();
  await flushAsyncWork();
  assert.deepEqual(writes[1], {
    method: 'create', ref: { collection: 'classes', id: 'generated-id' },
    payload: {
      id: 'generated-id',
      nama: lab.nama,
      praktikumId: 'praktikum-ppk',
      labId: 'generated-id',
      aktif: true,
      createdAt: 'server-time',
      updatedAt: 'server-time',
    },
  });
  pending[1].resolve();
  await creating;
  assert.equal(confirmed, true);

  const updated = { ...lab, latitude: -7.06, longitude: 110.45, radiusMeters: 50 };
  const updating = saveLaboratory(actor, updated, lab.id);
  assert.deepEqual(writes[2], {
    method: 'update', ref: { collection: 'laboratories', id: lab.id },
    payload: {
      nama: lab.nama, kode: lab.kode, gedung: lab.gedung, kapasitas: lab.kapasitas,
      latitude: -7.06, longitude: 110.45, radiusMeters: 50, updatedAt: 'server-time', updatedBy: actor.uid,
    },
  });
  pending[2].reject(Object.assign(new Error('offline'), { code: 'unavailable' }));
  await assert.rejects(updating, { code: 'unavailable' });

  const archiving = archiveLaboratory(actor, lab.id);
  assert.deepEqual(writes[3], {
    method: 'update', ref: { collection: 'laboratories', id: lab.id },
    payload: { aktif: false, updatedAt: 'server-time', updatedBy: actor.uid },
  });
  pending[3].resolve();
  await archiving;
});

test('the maps screen closes an archived marker selection and preserves the attendance shortcut for the open session', () => {
  const states = [];
  const navigations = [];
  let cursor = 0;
  let currentLabs = [lab];
  const { MapsScreen } = loadMapsSource('features/maps/MapsScreen.tsx', {
    react: {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = value; }];
      },
      useMemo: (compute) => compute(),
      useCallback: (callback) => callback,
      useRef: (current) => ({ current }),
    },
    'expo-router': {
      useIsFocused: () => true,
      useSitemap: () => ({ href: '/presensi/[sesiId]', children: [] }),
      router: { push: (href) => navigations.push(href) },
    },
    'react-native': { StyleSheet: { create: (styles) => styles }, Text: 'text', View: 'view' },
    'react-native-safe-area-context': { SafeAreaView: 'safe-area' },
    '@/components/ui/AppButton': { AppButton: 'button' },
    '@/components/ui/InfoBanner': { InfoBanner: 'banner' },
    'expo-location': {},
    '@/constants/theme': loadMapsSource('constants/theme'),
    '@/services/maps/laboratories': laboratories,
    './LabActivitySheet': { LabActivitySheet: 'activity' },
    './LabManagementModal': { LabManagementModal: 'management' },
    './LaboratoryMap': 'map',
    './MapFrame': { MapAttribution: 'attribution' },
    './simulatedLaboratories': { simulatedLaboratories: [] },
    './useMapsData': {
      useLaboratoryData: () => ({ snapshot: { laboratories: currentLabs, documentCount: currentLabs.length, fromCache: false } }),
      useMapsActivity: () => ({
        activities: getLabActivities([session('open-session', 'dibuka', now, now + hour)], [], now),
        classes: new Map(),
      }),
    },
    './useUserLocation': { useUserLocation: () => ({ state: { status: 'located' } }) },
  });
  function render() {
    cursor = 0;
    return jsxElements(MapsScreen({ actor: { uid: 'student', role: 'praktikan' } }));
  }
  const map = () => render().find(({ type }) => type === 'map');
  const sheet = () => render().find(({ type }) => type === 'activity');

  map().props.onSelect(lab.id);
  assert.equal(sheet().props.lab.id, lab.id);
  assert.equal(render().some(({ type }) => type === 'management'), false);
  sheet().props.onAttendance();
  assert.deepEqual(navigations, ['/presensi/open-session']);
  map().props.onSelect(lab.id);
  currentLabs = [{ ...lab, radiusMeters: 50 }];
  assert.equal(sheet().props.lab.radiusMeters, 50);
  currentLabs = [{ ...lab, aktif: false }];
  assert.equal(sheet(), undefined);
  assert.deepEqual(map().props.laboratories, []);
  currentLabs = [lab];
  assert.equal(sheet(), undefined);
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
    'expo-location': {},
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
      visible: true, actor: { role: 'aslab' }, laboratories: [lab], writable: true,
    });
    return jsxElements(tree);
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

test('the picker bridge validates coordinates, radius, sequence and document instance', () => {
  const { encodeMapMessage, readMapCommand, readMapEvent, mapUpdates } = protocol;
  const point = { latitude: -90, longitude: 180 };
  const message = { type: 'locationPicked', point };
  const packet = encodeMapMessage(message, 'picker', 2);
  assert.deepEqual(readMapEvent(packet, 'picker', 1).point, point);
  assert.equal(readMapEvent(packet, 'previous', 1), undefined);
  assert.equal(readMapEvent(packet, 'picker', 2), undefined);
  for (const invalid of [null, {}, { lat: -7, lng: 110 },
    { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: Infinity },
    { latitude: -91, longitude: 0 }, { latitude: 0, longitude: 181 }]) {
    assert.equal(readMapEvent(encodeMapMessage({ ...message, point: invalid }, 'picker', 3), 'picker', 2), undefined);
  }
  const state = { labs: [], location: null, selection: null, picker: { center: null, point: null, radius: 30 } };
  const snapshot = encodeMapMessage(mapUpdates(undefined, state)[0], 'picker', 1);
  assert.deepEqual(readMapCommand(snapshot, 'picker', 0).data, state);
  const picker = { ...state.picker, point, radius: 50 };
  assert.deepEqual(mapUpdates(state, { ...state, picker }), [{ type: 'picker', data: picker }]);
  for (const radius of [8, 501, '30']) {
    const invalid = encodeMapMessage({ type: 'picker', data: { ...picker, radius } }, 'picker', 2);
    assert.equal(readMapCommand(invalid, 'picker', 1), undefined);
  }
});

test('the native document emits locationPicked only for picker maps and keeps labSelected for ordinary maps', () => {
  const { startNativeMap } = loadMapsSource('features/maps/nativeMapDocument', {
    './leafletMap': { createLeafletMap: (_leaflet, container, options) => {
      container.onReady(options);
      return { dispose() {} };
    } },
    './mapProtocol': protocol,
  });
  const point = { latitude: -7, longitude: 110 };
  for (const picker of [false, true]) {
    const browser = new EventTarget();
    const sent = [];
    browser.ReactNativeWebView = { postMessage: (packet) => sent.push(packet) };
    let handlers;
    startNativeMap(browser, {
      ownerDocument: new EventTarget(), dataset: { instance: '42', picker: String(picker) },
      onReady: (options) => { handlers = options; },
    });
    if (picker) handlers.onLocationPicked(point);
    else {
      assert.equal(handlers.onLocationPicked, undefined);
      handlers.onSelect(lab.id);
    }
    assert.equal(protocol.readMapEvent(sent[0], '42', 0).type, 'ready');
    const event = protocol.readMapEvent(sent[1], '42', 1);
    assert.equal(event.type, picker ? 'locationPicked' : 'labSelected');
    assert.deepEqual(picker ? event.point : event.id, picker ? point : lab.id);
    browser.dispatchEvent(new Event('pagehide'));
  }
});

test('the native picker accepts only validated events from its current WebView', () => {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let mount;
  const picked = [];
  const { LabPickerMap } = loadMapsSource('features/maps/LaboratoryMapRenderer.native.tsx', {
    react: {
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], (value) => { state[index] = value; }];
      },
      useRef: (current) => refs[refIndex++] ??= { current },
      useMemo: (compute) => compute(),
      useCallback: (callback) => callback,
      useEffect() {},
      useImperativeHandle() {},
      useLayoutEffect: (setup) => { mount = setup; },
    },
    'react-native': { StyleSheet: { create: (styles) => styles } },
    'react-native-webview': { WebView: 'webview' },
    './leafletHtml.generated': 'data-instance="PPK_MAP_INSTANCE" data-picker="PPK_MAP_PICKER"',
    './MapFrame': { MapFrame: 'frame' },
    './mapProtocol': protocol,
  });
  const map = LabPickerMap({ center: null, point: null, radius: 30, onLocationPicked: (point) => picked.push(point) });
  const document = map.type(map.props);
  function renderDocument() {
    stateIndex = 1;
    refIndex = 0;
    return jsxElements(document.type(document.props)).find(({ type }) => type === 'webview').props;
  }

  let webview = renderDocument();
  const unmount = mount();
  const instance = webview.source.html.match(/data-instance="(\d+)"/)[1];
  assert.match(webview.source.html, /data-picker="true"/);
  const source = webview.source;
  const location = { latitude: -7, longitude: 110 };
  const deliver = (message, sequence, sender = instance) => webview.onMessage({
    nativeEvent: { data: protocol.encodeMapMessage(message, sender, sequence) },
  });
  const event = { type: 'locationPicked', point: location };
  deliver(event, 1);
  assert.deepEqual(picked, []);
  deliver({ type: 'ready' }, 2);
  webview = renderDocument();
  assert.equal(webview.source, source);
  deliver(event, 3, 'previous');
  deliver({ ...event, point: { latitude: 0, longitude: 200 } }, 3);
  deliver({ type: 'labSelected', id: lab.id }, 3);
  assert.deepEqual(picked, []);
  deliver(event, 4);
  deliver(event, 4);
  assert.deepEqual(picked, [location]);
  unmount();
  deliver(event, 5);
  assert.deepEqual(picked, [location]);
});

test('the Web picker can render on the server before Leaflet or the DOM are available', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { LabPickerMap } = loadMapsSource('features/maps/LaboratoryMap.web.tsx', {
    './leafletMap.css': {},
    './leafletVendor.generated.css': {},
    './MapFrame': { MapFrame: ({ children }) => React.createElement('section', null, children) },
    './leafletMap': { createLeafletMap: () => assert.fail('Leaflet must initialize only after mount') },
    './mapProtocol': protocol,
  });
  const markup = renderToStaticMarkup(React.createElement(LabPickerMap, {
    center: null, point: null, radius: 30, onLocationPicked: () => assert.fail('picker event during SSR'),
  }));
  assert.match(markup, /aria-label="Peta pemilihan lokasi"/);
});

test('Leaflet picker moves a single marker and meter circle without changing the camera', () => {
  const clicks = new Map();
  const views = [];
  const markers = [];
  const circles = [];
  const selections = [];
  const pickedPoints = [];
  let disposed = 0;
  let observed;
  let resizeCount = 0;
  let disconnected = false;
  const oldObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback) { this.resize = callback; }
    observe() { observed = this.resize; }
    disconnect() { disconnected = true; }
  };
  const leaf = {
    map: () => ({
      setView: (...args) => views.push(args),
      invalidateSize: () => { resizeCount++; },
      hasLayer: () => false,
      fitBounds: () => assert.fail('picker must preserve the current camera'),
      on: (name, callback) => clicks.set(name, callback),
      off: (name, callback) => { if (clicks.get(name) === callback) clicks.delete(name); },
      remove: () => { disposed++; },
    }),
    tileLayer: () => ({ on() {}, off() {}, addTo() {} }),
    circle: (position, { radius }) => layer(circles, position, radius),
    circleMarker: (position, { radius }) => layer(markers, position, radius),
  };
  function layer(list, position, radius) {
    const state = {
      position, radius,
      addTo: () => state,
      setLatLng: (next) => { state.position = next; return state; },
      setRadius: (next) => { state.radius = next; return state; },
      bringToFront() {},
      remove: () => { state.removed = true; },
    };
    list.push(state);
    return state;
  }
  const { createLeafletMap } = loadMapsSource('features/maps/leafletMap', { './mapProtocol': protocol });
  try {
    const renderer = createLeafletMap(leaf, { clientWidth: 400, clientHeight: 500 }, {
      preview: false,
      onSelect: (id) => selections.push(id),
      onLocationPicked: (point) => pickedPoints.push(point),
      onTileStatus() {},
    });
    const center = { latitude: -7.05, longitude: 110.44 };
    const picker = { center, point: null, radius: 30 };
    renderer.apply({ type: 'snapshot', data: { labs: [], location: null, selection: null, picker } });
    assert.deepEqual(views.map(([point]) => point), [[-7.052, 110.44], [-7.05, 110.44]]);
    const click = clicks.get('click');
    for (const latlng of [{ lat: Infinity, lng: 110 }, { lat: -7, lng: 181 }, { lat: -7.01, lng: 110.41 }]) click({ latlng });
    assert.deepEqual(pickedPoints, [{ latitude: -7.01, longitude: 110.41 }]);
    renderer.apply({ type: 'picker', data: { ...picker, point: pickedPoints[0], radius: null } });
    assert.equal(markers.length, 1);
    assert.equal(circles.length, 0);
    renderer.apply({ type: 'picker', data: { ...picker, point: pickedPoints[0] } });
    click({ latlng: { lat: -7.02, lng: 110.42 } });
    renderer.apply({ type: 'picker', data: { ...picker, point: pickedPoints[1], radius: 70 } });
    observed();
    assert.equal(resizeCount, 1);
    assert.equal(markers.length, 1);
    assert.equal(circles.length, 1);
    assert.deepEqual(markers[0].position, [-7.02, 110.42]);
    assert.deepEqual(circles[0].position, markers[0].position);
    assert.equal(circles[0].radius, 70);
    assert.equal(views.length, 2);
    assert.deepEqual(selections, []);
    renderer.dispose();
    renderer.dispose();
    click({ latlng: { lat: -7, lng: 110 } });
    assert.equal(pickedPoints.length, 2);
    assert.equal(clicks.size, 0);
    assert.equal(disposed, 1);
    assert.equal(disconnected, true);
  } finally {
    if (oldObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = oldObserver;
  }
});

test('confirming the picker changes only the form draft until Save and cancel retains the coordinates', async () => {
  const state = [];
  const writes = [];
  let cursor = 0;
  let location = { latitude: -8, longitude: 111, accuracy: 4 };
  const { LabManagementModal } = loadMapsSource('features/maps/LabManagementModal.tsx', {
    react: {
      useEffect() {},
      useState: (initial) => {
        const slot = cursor++;
        if (!(slot in state)) state[slot] = initial;
        return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
      },
      useRef: (current) => state[cursor++] ??= { current },
    },
    'react-native': { Keyboard: { dismiss() {} }, StyleSheet: { create: (styles) => styles }, View: 'view', Text: 'text' },
    '@/components/ui/AppButton': { AppButton: 'button' },
    '@/components/ui/FormField': { FormField: 'field' },
    '@/components/ui/InfoBanner': { InfoBanner: 'banner' },
    'expo-location': {},
    '@/constants/theme': { Colors: {}, FontSize: {}, Spacing: {} },
    '@/services/maps/laboratoryService': { saveLaboratory: async (...args) => { writes.push(args); } },
    '@/services/maps/laboratories': laboratories,
    './LaboratoryMap': { LabPreview: 'preview', LabPickerMap: 'picker' },
    './MapSheet': { MapSheet: 'sheet' },
  });
  function elements() {
    cursor = 0;
    return jsxElements(LabManagementModal({
      visible: true, actor: { role: 'aslab' }, laboratories: [lab], location, writable: true,
    }));
  }
  const button = (label) => elements().find((item) => item.type === 'button' && item.props.label === label).props;
  const item = (type) => elements().find((element) => element.type === type).props;
  const field = (label) => elements().find((element) => element.type === 'field' && element.props.label === label).props;

  button('Tambah laboratorium').onPress();
  button('Pilih Lokasi di Peta').onPress();
  assert.equal(item('sheet').fullScreen, true);
  assert.deepEqual(item('picker').center, { latitude: -8, longitude: 111 });
  assert.equal(button('Gunakan Lokasi Ini').disabled, true);
  button('Batal').onPress();
  assert.equal(field('Latitude').value, '');
  location = undefined;
  button('Pilih Lokasi di Peta').onPress();
  assert.equal(item('picker').center, null);
  item('sheet').onClose();
  button('Kembali ke daftar').onPress();

  button('Edit').onPress();
  button('Pilih Lokasi di Peta').onPress();
  assert.deepEqual(item('picker').center, { latitude: lab.latitude, longitude: lab.longitude });
  assert.equal(item('picker').radius, lab.radiusMeters);
  item('picker').onLocationPicked({ latitude: Infinity, longitude: 110 });
  assert.equal(button('Gunakan Lokasi Ini').disabled, true);
  item('picker').onLocationPicked({ latitude: -7.1, longitude: 110.4 });
  button('Batal').onPress();
  assert.equal(field('Latitude').value, String(lab.latitude));
  assert.equal(field('Longitude').value, String(lab.longitude));
  button('Pilih Lokasi di Peta').onPress();
  item('picker').onLocationPicked({ latitude: -7.12, longitude: 110.42 });
  item('picker').onLocationPicked({ latitude: -7.234567891, longitude: 110.567890123 });
  button('Gunakan Lokasi Ini').onPress();
  assert.equal(field('Latitude').value, '-7.2345679');
  assert.equal(field('Longitude').value, '110.5678901');
  assert.deepEqual(item('preview').point, { latitude: -7.2345679, longitude: 110.5678901 });
  assert.deepEqual(writes, []);
  button('Simpan laboratorium').onPress();
  await flushAsyncWork();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1].latitude, -7.2345679);
  assert.equal(writes[0][1].longitude, 110.5678901);
  assert.equal(writes[0][2], lab.id);
});
