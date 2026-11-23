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

const {
  DEFAULT_LAB_LOCATIONS,
  SIMULATED_LOCATIONS,
  createSimulatedReading,
} = loadSource('services/location/mockLocation');
const {
  calculateHaversineDistanceMeters,
  classifyGpsAccuracy,
  evaluateGeofence,
  isValidCoordinate,
  resolveSessionLabTarget,
} = loadSource('services/location/geofenceService');
const { submitAttendanceToFirestore } = loadSource(
  'services/attendanceService',
  {
    'firebase/firestore': {
      collection: () => ({}),
      doc: () => ({}),
      onSnapshot: () => () => {},
      runTransaction: async () => {},
      serverTimestamp: () => 'SERVER_TIMESTAMP',
    },
    '@/services/practicumService': {
      getDb: () => null,
      toStatusSesi: (status) => (status === 'open' ? 'dibuka' : 'ditutup'),
    },
  },
);
const { initialState } = loadSource('data/dummy');
const { appReducer } = loadSource('store/app-context');

const labAi = DEFAULT_LAB_LOCATIONS[0];

test('isValidCoordinate validates latitude [-90..90] and longitude [-180..180]', () => {
  assert.equal(isValidCoordinate(labAi.coordinates), true);
  assert.equal(isValidCoordinate({ latitude: 95, longitude: 106.8 }), false);
  assert.equal(isValidCoordinate({ latitude: -6.1, longitude: -190 }), false);
  assert.equal(isValidCoordinate({ latitude: Number.NaN, longitude: 106.8 }), false);
  assert.equal(isValidCoordinate(null), false);
});

test('calculateHaversineDistanceMeters returns accurate distances in meters', () => {
  assert.equal(
    calculateHaversineDistanceMeters(labAi.coordinates, labAi.coordinates),
    0,
  );

  const inRadiusDistance = calculateHaversineDistanceMeters(
    SIMULATED_LOCATIONS.inRadiusLabAi,
    labAi.coordinates,
  );
  assert.ok(
    inRadiusDistance > 0 && inRadiusDistance <= 15,
    `Expected in-radius distance <= 15m, got ${inRadiusDistance}`,
  );

  const outRadiusDistance = calculateHaversineDistanceMeters(
    SIMULATED_LOCATIONS.outRadiusLabAi,
    labAi.coordinates,
  );
  assert.ok(
    outRadiusDistance >= 140 && outRadiusDistance <= 170,
    `Expected out-of-radius distance ~150m, got ${outRadiusDistance}`,
  );

  assert.throws(() =>
    calculateHaversineDistanceMeters(
      { latitude: 120, longitude: 106.8 },
      labAi.coordinates,
    ),
  );
});

test('evaluateGeofence distinguishes DALAM_RADIUS, boundary, LUAR_RADIUS, and weak accuracy', () => {
  const inside = evaluateGeofence(SIMULATED_LOCATIONS.inRadiusLabAi, labAi);
  assert.equal(inside.status, 'DALAM_RADIUS');
  assert.equal(inside.isWithinRadius, true);
  assert.equal(inside.isWeakAccuracy, false);
  assert.equal(inside.accuracyQuality, 'sangat_baik');
  assert.match(inside.message, /di dalam radius/i);

  // Tepat di batas radius (0 meter dari titik lab dengan radius tepat)
  const exactBoundary = evaluateGeofence(
    { ...labAi.coordinates, accuracy: 20 },
    { ...labAi, radiusMeters: 30 },
  );
  assert.equal(exactBoundary.status, 'DALAM_RADIUS');
  assert.equal(exactBoundary.accuracyQuality, 'baik');

  const outside = evaluateGeofence(SIMULATED_LOCATIONS.outRadiusLabAi, labAi);
  assert.equal(outside.status, 'LUAR_RADIUS');
  assert.equal(outside.isWithinRadius, false);
  assert.match(outside.message, /di luar radius laboratorium/i);
  assert.match(outside.message, /maksimal: 30 meter/i);

  const weak = evaluateGeofence(SIMULATED_LOCATIONS.weakSignalLabAi, labAi);
  assert.equal(weak.isWeakAccuracy, true);
  assert.equal(weak.accuracyQuality, 'lemah');
  assert.equal(classifyGpsAccuracy(75).isWeak, true);
  assert.equal(classifyGpsAccuracy(12).quality, 'sangat_baik');
});

test('resolveSessionLabTarget prioritizes session coordinates and falls back to room mapping', () => {
  const sessionWithCoords = {
    ...initialState.sesi[1],
    labId: 'custom-lab',
    labNama: 'Lab Custom',
    labCoordinates: { latitude: -6.2, longitude: 106.8 },
    radiusMeters: 45,
  };
  const resolvedCustom = resolveSessionLabTarget(sessionWithCoords);
  assert.equal(resolvedCustom.source, 'session');
  assert.equal(resolvedCustom.labNama, 'Lab Custom');
  assert.equal(resolvedCustom.radiusMeters, 45);
  assert.deepEqual(resolvedCustom.coordinates, { latitude: -6.2, longitude: 106.8 });

  const resolvedLab3 = resolveSessionLabTarget(initialState.sesi[1]);
  assert.equal(resolvedLab3.source, 'fallback');
  assert.equal(resolvedLab3.labId, 'lab-ai');
  assert.equal(resolvedLab3.radiusMeters, 30);

  const resolvedLab5 = resolveSessionLabTarget(initialState.sesi[3]);
  assert.equal(resolvedLab5.labId, 'lab-rpl');
  assert.equal(resolvedLab5.radiusMeters, 25);
});

test('submitAttendanceToFirestore enforces role, session state, geofence radius, note limit, and duplicates', async () => {
  const praktikanA = initialState.pengguna.find((u) => u.id === 'praktikan-1');
  const asisten = initialState.pengguna.find((u) => u.id === 'asisten-1');
  const closedSession = initialState.sesi.find((s) => s.id === 'sesi-2');
  const openSession = {
    ...closedSession,
    status: 'dibuka',
    tanggal: '2026-04-20',
    jamMulai: '10:00',
    jamSelesai: '12:00',
  };
  const validWaktuPresensi = new Date('2026-04-20T10:30:00').toISOString();

  const inRadiusGeo = {
    latitude: SIMULATED_LOCATIONS.inRadiusLabAi.latitude,
    longitude: SIMULATED_LOCATIONS.inRadiusLabAi.longitude,
    accuracy: 8,
    distanceMeters: 6,
    geofenceStatus: 'in_radius',
  };

  const outRadiusGeo = {
    latitude: SIMULATED_LOCATIONS.outRadiusLabAi.latitude,
    longitude: SIMULATED_LOCATIONS.outRadiusLabAi.longitude,
    accuracy: 10,
    distanceMeters: 155,
    geofenceStatus: 'in_radius',
  };

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(asisten, {
        sesiId: openSession.id,
        praktikanId: asisten.id,
        localSesi: openSession,
        geo: inRadiusGeo,
      }),
    /Hanya praktikan/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
      }),
    /Verifikasi lokasi GPS wajib/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: closedSession.id,
        praktikanId: praktikanA.id,
        localSesi: closedSession,
        geo: inRadiusGeo,
      }),
    /belum dibuka/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
        waktuPresensi: validWaktuPresensi,
        geo: outRadiusGeo,
      }),
    /di luar radius laboratorium/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
        waktuPresensi: validWaktuPresensi,
        alreadyAttendedLocally: true,
        geo: inRadiusGeo,
      }),
    /Presensi ganda ditolak/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
        catatan: 'x'.repeat(121),
        geo: inRadiusGeo,
      }),
    /maksimal 120 karakter/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
        waktuPresensi: new Date('2026-04-20T09:55:00').toISOString(),
        geo: inRadiusGeo,
      }),
    /belum dimulai/,
  );

  await assert.rejects(
    () =>
      submitAttendanceToFirestore(praktikanA, {
        sesiId: openSession.id,
        praktikanId: praktikanA.id,
        localSesi: openSession,
        waktuPresensi: new Date('2026-04-20T12:05:00').toISOString(),
        geo: inRadiusGeo,
      }),
    /telah berakhir/,
  );

  const saved = await submitAttendanceToFirestore(praktikanA, {
    sesiId: openSession.id,
    praktikanId: praktikanA.id,
    catatan: '  Hadir tepat waktu  ',
    localSesi: openSession,
    waktuPresensi: validWaktuPresensi,
    geo: inRadiusGeo,
  });

  assert.equal(saved.sesiId, openSession.id);
  assert.equal(saved.praktikanId, praktikanA.id);
  assert.equal(saved.catatan, 'Hadir tepat waktu');
  assert.equal(saved.latitude, inRadiusGeo.latitude);
  assert.equal(saved.longitude, inRadiusGeo.longitude);
  assert.equal(saved.accuracy, 8);
  assert.equal(saved.geofenceStatus, 'in_radius');
  assert.ok(saved.distanceMeters <= labAi.radiusMeters);

  // Reducer stores geofence metadata on CATAT_PRESENSI
  let state = structuredClone(initialState);
  state = appReducer(state, {
    type: 'PILIH_PENGGUNA',
    pengguna: state.pengguna.find((u) => u.id === 'asisten-1'),
  });
  state = appReducer(state, { type: 'BUKA_SESI', sesiId: 'sesi-2' });
  state = appReducer(state, {
    type: 'PILIH_PENGGUNA',
    pengguna: state.pengguna.find((u) => u.id === 'praktikan-1'),
  });
  const updated = appReducer(state, {
    type: 'CATAT_PRESENSI',
    sesiId: 'sesi-2',
    praktikanId: 'praktikan-1',
    catatan: saved.catatan,
    waktuPresensi: saved.waktuPresensi,
    latitude: saved.latitude,
    longitude: saved.longitude,
    accuracy: saved.accuracy,
    distanceMeters: saved.distanceMeters,
    geofenceStatus: saved.geofenceStatus,
  });
  const lastRecord = updated.presensi.at(-1);
  assert.equal(lastRecord.distanceMeters, saved.distanceMeters);
  assert.equal(lastRecord.geofenceStatus, 'in_radius');
  assert.ok(createSimulatedReading('inRadiusLabAi').timestamp > 0);
});
