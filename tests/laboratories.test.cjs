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
  runInThisContext(`(function(module, exports, require) { ${code}\n })`, { filename: file })(
    module, module.exports, requireSource,
  );
  return module.exports;
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
  assert.equal(loaders.length, 2);
  await assert.rejects(loaders[0], moduleError);
  await assert.rejects(loaders[1], moduleError);
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
