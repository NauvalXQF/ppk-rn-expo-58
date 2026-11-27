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

const tokenRegistryModule = loadSource(
  'services/notifications/tokenRegistryService',
);
const dispatcherModule = loadSource(
  'services/notifications/notificationDispatcher',
);

test('dispatcher routes only recognized payment events to the correct Denda tab', () => {
  for (const [type, tab] of [['fine_created', 'aktif'], ['payment_success', 'riwayat'], ['payment_failed', 'riwayat']]) {
    assert.equal(dispatcherModule.resolveNotificationRoute({ type, screen: 'presensi', tab: 'attacker' }), '/denda?tab=' + tab);
  }
  assert.equal(dispatcherModule.resolveNotificationRoute({ type: 'invalid', screen: 'denda' }), null);
  assert.equal(dispatcherModule.resolveNotificationRoute({ type: 'leave_decided' }), '/(tabs)/izin');
});

test('frontend audit subscription presents legacy notifications but never publishes payment alerts', () => {
  const effects = [];
  let snapshot;
  const presented = [];
  const routes = [];
  const provider = loadSource('hooks/useNotifications', {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      createElement: (_type, props) => props.value,
      useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn), useMemo: (fn) => fn(),
      useRef: (current) => ({ current }), useState: (value) => [value, () => {}],
    },
    'react-native': { Platform: { OS: 'web' } },
    'expo-notifications': {},
    'expo-router': { useRouter: () => ({ push: (route) => routes.push(route) }) },
    '@/contexts/AuthContext': { useAuth: () => ({ status: 'masuk', pengguna: { uid: 'student', role: 'praktikan' } }) },
    '@/services/notifications/notificationDispatcher': {
      resolveNotificationRoute: dispatcherModule.resolveNotificationRoute,
      subscribeUserNotifications: (_uid, onSnapshot) => { snapshot = onSnapshot; return () => {}; },
    },
    '@/services/notifications/notificationService': {
      configureNotificationHandler() {},
      setupAndroidNotificationChannel: async () => {},
      getNotificationPermissionStatus: async () => ({}),
      registerUserDeviceForNotifications: async () => ({}),
      presentLocalNotification: async ({ data }) => presented.push(data.notificationId),
    },
  }).NotificationProvider({});
  for (const effect of effects) effect();
  snapshot([]);
  const fixtures = ['fine_created', 'payment_success', 'payment_failed', 'leave_decided']
    .map((type) => ({ type, id: type, data: { type }, status: 'sent' }));
  snapshot(fixtures);
  snapshot(fixtures);
  assert.deepEqual(presented, ['leave_decided']);
  assert.equal(provider.navigateFromNotification({ type: 'fine_created', recipientUid: 'other' }), false);
  assert.equal(provider.navigateFromNotification({ type: 'fine_created', recipientUid: 'student' }), true);
  assert.deepEqual(routes, ['/denda?tab=aktif']);
});

const {
  createInMemoryTokenRegistry,
  encodeDeviceTokenDocId,
  getUserDeviceTokens,
  getUsersDeviceTokens,
  isExpoPushToken,
  isValidPushToken,
  registerDeviceToken,
  unregisterDeviceToken,
} = tokenRegistryModule;

const {
  buildLeaveDecidedPayload,
  buildScheduleChangedPayload,
  buildSessionOpenedPayload,
  createInMemoryNotificationStore,
  notifyLeaveDecided,
  notifyScheduleChanged,
  notifySessionOpened,
  resolveNotificationRoute,
  sendExpoPushMessages,
} = dispatcherModule;

test('validates push tokens and sanitizes Firestore device document IDs', () => {
  assert.equal(isValidPushToken('ExponentPushToken[abc123XYZ]'), true);
  assert.equal(isValidPushToken('ExpoPushToken[device-99]'), true);
  assert.equal(isValidPushToken(''), false);
  assert.equal(isValidPushToken('   '), false);
  assert.equal(isValidPushToken('abc'), false);
  assert.equal(isValidPushToken(null), false);

  assert.equal(isExpoPushToken('ExponentPushToken[abc123XYZ]'), true);
  assert.equal(isExpoPushToken('ExpoPushToken[device-99]'), true);
  assert.equal(isExpoPushToken('raw-fcm-token-not-expo'), false);

  assert.equal(
    encodeDeviceTokenDocId('ExponentPushToken[abc123XYZ]'),
    'ExponentPushToken[abc123XYZ]',
  );
  assert.equal(encodeDeviceTokenDocId('tok/with/slash').includes('/'), false);
  assert.throws(() => encodeDeviceTokenDocId('   '));
});

test('builds standardized payloads for session_opened, schedule_changed, and leave_decided (SRS-06)', () => {
  const sessionPayload = buildSessionOpenedPayload({
    sessionId: 'sesi-101',
    classId: 'kelas-a',
    topik: 'Komponen & Layout',
    labNama: 'Lab AI',
  });
  assert.equal(sessionPayload.title, 'Sesi Praktikum Dibuka');
  assert.match(sessionPayload.body, /Sesi Praktikum Dibuka: Komponen & Layout/);
  assert.match(sessionPayload.body, /presensi di Lab AI/i);
  assert.deepEqual(sessionPayload.data, {
    type: 'session_opened',
    screen: 'presensi',
    sessionId: 'sesi-101',
    classId: 'kelas-a',
  });

  const schedulePayload = buildScheduleChangedPayload({
    classId: 'kelas-a',
    sessionId: 'sesi-101',
    mataKuliah: 'PPK',
    topik: 'Komponen & Layout',
    ruang: 'Lab RPL',
    waktu: '2026-11-25 13:00-15:00',
  });
  assert.equal(schedulePayload.title, 'Perubahan Jadwal Praktikum');
  assert.match(schedulePayload.body, /Perubahan Jadwal Praktikum: PPK dipindahkan ke Lab RPL/);
  assert.equal(schedulePayload.data.type, 'schedule_changed');
  assert.equal(schedulePayload.data.screen, 'sesi');
  assert.equal(schedulePayload.data.sessionId, 'sesi-101');

  const scheduleOnlyPayload = buildScheduleChangedPayload({
    classId: 'kelas-b',
    scheduleId: 'jadwal-b',
    topik: 'Praktikum Reguler B',
    ruang: 'Lab Jaringan',
    waktu: 'Kamis 10:00-12:00',
  });
  assert.equal(scheduleOnlyPayload.data.screen, 'jadwal');
  assert.equal(scheduleOnlyPayload.data.scheduleId, 'jadwal-b');

  const leaveApproved = buildLeaveDecidedPayload({
    requestId: 'leave-1',
    recipientUid: 'uid-praktikan-1',
    decision: 'approved',
    sessionId: 'sesi-101',
    decisionNote: 'Disetujui, semoga lekas sembuh',
  });
  assert.equal(leaveApproved.title, 'Pengajuan Izin Disetujui');
  assert.equal(
    leaveApproved.body,
    'Pengajuan Izin Disetujui: Disetujui, semoga lekas sembuh',
  );
  assert.deepEqual(leaveApproved.data, {
    type: 'leave_decided',
    screen: 'izin',
    requestId: 'leave-1',
    sessionId: 'sesi-101',
  });

  const leaveRejected = buildLeaveDecidedPayload({
    requestId: 'leave-2',
    recipientUid: 'uid-praktikan-2',
    decision: 'rejected',
    sessionTopic: 'State Management',
  });
  assert.equal(leaveRejected.title, 'Pengajuan Izin Ditolak');
  assert.match(leaveRejected.body, /Pengajuan Izin Ditolak:/);
  assert.match(leaveRejected.body, /State Management/);
});

test('resolves deep-link routes safely for notification taps (T-26)', () => {
  assert.equal(
    resolveNotificationRoute({ screen: 'presensi', sessionId: 'sesi-2' }),
    '/presensi/sesi-2',
  );
  assert.equal(
    resolveNotificationRoute({ screen: 'sesi', sessionId: 'sesi-3' }),
    '/sesi/sesi-3',
  );
  assert.equal(resolveNotificationRoute({ screen: 'izin' }), '/(tabs)/izin');
  assert.equal(resolveNotificationRoute({ screen: 'jadwal' }), '/(tabs)/jadwal');

  // Fallback menggunakan type saat screen tidak tersedia
  assert.equal(
    resolveNotificationRoute({ type: 'session_opened', sessionId: 'sesi-9' }),
    '/presensi/sesi-9',
  );
  assert.equal(
    resolveNotificationRoute({ type: 'leave_decided' }),
    '/(tabs)/izin',
  );

  // Tolak segment berbahaya / path traversal
  assert.equal(
    resolveNotificationRoute({ screen: 'presensi', sessionId: '../admin' }),
    '/(tabs)/jadwal',
  );
  assert.equal(resolveNotificationRoute(null), null);
  assert.equal(resolveNotificationRoute({}), null);
});

test('supports multi-device token registration on login and cleanup on logout (T-27, T-28)', async () => {
  const repo = createInMemoryTokenRegistry();

  await registerDeviceToken(
    {
      uid: 'uid-a1',
      token: 'ExponentPushToken[phone-1]',
      platform: 'android',
      deviceName: 'Samsung Galaxy A54',
    },
    repo,
  );
  await registerDeviceToken(
    {
      uid: 'uid-a1',
      token: 'ExponentPushToken[tablet-2]',
      platform: 'ios',
      deviceName: 'iPad Air',
    },
    repo,
  );
  await registerDeviceToken(
    {
      uid: 'uid-b1',
      token: 'ExponentPushToken[phone-b1]',
      platform: 'android',
      deviceName: 'Pixel 8',
    },
    repo,
  );

  const tokensA1 = await getUserDeviceTokens('uid-a1', repo);
  assert.equal(tokensA1.length, 2);

  // Logout satu perangkat hanya menghapus token perangkat tersebut
  await unregisterDeviceToken('uid-a1', 'ExponentPushToken[phone-1]', repo);
  const remainingA1 = await getUserDeviceTokens('uid-a1', repo);
  assert.deepEqual(
    remainingA1.map((item) => item.token),
    ['ExponentPushToken[tablet-2]'],
  );

  // Pengguna lain tidak terdampak
  const tokenMap = await getUsersDeviceTokens(['uid-a1', 'uid-b1'], repo);
  assert.equal(tokenMap.get('uid-b1').length, 1);

  // Penghapusan token yang sudah tidak ada tidak menimbulkan error
  await unregisterDeviceToken('uid-a1', 'ExponentPushToken[phone-1]', repo);

  // Tolak token kosong/tidak valid
  await assert.rejects(() =>
    registerDeviceToken(
      { uid: 'uid-a1', token: '  ', platform: 'android' },
      repo,
    ),
  );
});

test('isolates session_opened and schedule_changed notifications strictly to target class members (T-22, T-23, T-24)', async () => {
  const tokenRepo = createInMemoryTokenRegistry();
  const auditStore = createInMemoryNotificationStore();

  await registerDeviceToken(
    { uid: 'uid-a1', token: 'ExponentPushToken[tok-a1]', platform: 'android' },
    tokenRepo,
  );
  await registerDeviceToken(
    { uid: 'uid-a2', token: 'ExponentPushToken[tok-a2]', platform: 'ios' },
    tokenRepo,
  );
  await registerDeviceToken(
    { uid: 'uid-b1', token: 'ExponentPushToken[tok-b1]', platform: 'android' },
    tokenRepo,
  );

  const members = [
    { id: 'uid-a1', peran: 'praktikan', nama: 'A1', nim: '001', kelasId: 'kelas-a' },
    { id: 'uid-a2', peran: 'praktikan', nama: 'A2', nim: '002', kelasId: 'kelas-a' },
    { id: 'uid-b1', peran: 'praktikan', nama: 'B1', nim: '003', kelasId: 'kelas-b' },
  ];

  const sentBatches = [];
  const fakeFetch = async (_url, init) => {
    const messages = JSON.parse(init.body);
    sentBatches.push(messages);
    return {
      ok: true,
      json: async () => ({
        data: messages.map(() => ({ status: 'ok', id: 'ticket-ok' })),
      }),
    };
  };

  const sessionResult = await notifySessionOpened(
    {
      sessionId: 'sesi-a1',
      classId: 'kelas-a',
      topik: 'Komponen & Layout',
      ruang: 'Lab AI',
    },
    {
      tokenRepository: tokenRepo,
      auditStore,
      fallbackMembers: members,
      fetchFn: fakeFetch,
    },
  );

  assert.deepEqual(sessionResult.recipientUids.sort(), ['uid-a1', 'uid-a2']);
  assert.equal(sessionResult.deliveredTokens, 2);
  assert.equal(sessionResult.failedTokens.length, 0);
  assert.equal(sessionResult.auditRecordIds.length, 2);

  // Pastikan praktikan kelas B TIDAK menerima notifikasi kelas A (T-23)
  let b1Notifications = [];
  const unsubB1 = auditStore.subscribeForUser('uid-b1', (items) => {
    b1Notifications = items;
  });
  assert.equal(b1Notifications.length, 0);
  unsubB1();

  // Event perubahan jadwal kelas B hanya diterima praktikan kelas B (T-24)
  const scheduleResult = await notifyScheduleChanged(
    {
      classId: 'kelas-b',
      sessionId: 'sesi-b1',
      topik: 'Navigation & Routing',
      ruang: 'Lab RPL',
      waktu: '2026-11-26 13:00-15:00',
    },
    {
      tokenRepository: tokenRepo,
      auditStore,
      fallbackMembers: members,
      fetchFn: fakeFetch,
    },
  );
  assert.deepEqual(scheduleResult.recipientUids, ['uid-b1']);
  assert.equal(scheduleResult.deliveredTokens, 1);
  assert.equal(sentBatches.at(-1)[0].to, 'ExponentPushToken[tok-b1]');
});

test('dispatches leave_decided only to applicant and handles expired/invalid tokens gracefully (T-25, SRS-07 AC-4)', async () => {
  const tokenRepo = createInMemoryTokenRegistry();
  const auditStore = createInMemoryNotificationStore();

  await registerDeviceToken(
    {
      uid: 'uid-pemohon',
      token: 'ExponentPushToken[active-device]',
      platform: 'android',
    },
    tokenRepo,
  );
  await registerDeviceToken(
    {
      uid: 'uid-pemohon',
      token: 'ExponentPushToken[expired-device]',
      platform: 'ios',
    },
    tokenRepo,
  );

  const fakeFetch = async (_url, init) => {
    const messages = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        data: messages.map((msg) =>
          msg.to.includes('expired')
            ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
            : { status: 'ok', id: 'ticket-1' },
        ),
      }),
    };
  };

  const result = await notifyLeaveDecided(
    {
      requestId: 'leave-77',
      recipientUid: 'uid-pemohon',
      decision: 'approved',
      sessionId: 'sesi-2',
      decisionNote: 'Disetujui, semoga lekas sembuh',
    },
    {
      tokenRepository: tokenRepo,
      auditStore,
      fetchFn: fakeFetch,
    },
  );

  assert.deepEqual(result.recipientUids, ['uid-pemohon']);
  assert.equal(result.attemptedTokens, 2);
  assert.equal(result.deliveredTokens, 1);
  assert.deepEqual(result.invalidTokens, ['ExponentPushToken[expired-device]']);
  assert.equal(result.auditRecordIds.length, 1);

  // Simulasi jaringan putus saat mengirim Expo Push — tidak boleh crash/throw
  const offlineSummary = await sendExpoPushMessages(
    [
      {
        to: 'ExponentPushToken[active-device]',
        title: 'Test',
        body: 'Offline test',
        data: { type: 'leave_decided', screen: 'izin' },
        sound: 'default',
        priority: 'high',
        channelId: 'praktikum-events',
      },
    ],
    async () => {
      throw new Error('Network request failed');
    },
  );
  assert.equal(offlineSummary.deliveredTokens.length, 0);
  assert.deepEqual(offlineSummary.failedTokens, [
    'ExponentPushToken[active-device]',
  ]);
});

test('firestore.rules defines Sprint 3 rules for devices, laboratories, geofence attendances, and notifications', () => {
  const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert.match(rulesText, /match \/devices\/\{token\}/);
  assert.match(rulesText, /match \/laboratories\/\{labId\}/);
  assert.match(rulesText, /match \/notifications\/\{notificationId\}/);
  assert.match(rulesText, /request\.resource\.data\.distanceMeters/);
  assert.match(rulesText, /bypass_qr/);
  assert.match(
    rulesText,
    /allow read: if isSignedIn\(\)\s*&& \(resource\.data\.recipientUid == request\.auth\.uid \|\| isAsisten\(\)\);/,
  );
});
