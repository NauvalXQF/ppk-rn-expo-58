const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const moduleFixture = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync('src/services/payments/paymentData.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
new Function('exports', outputText)(moduleFixture.exports);
const { isSandboxCheckout, isSandboxCheckoutNavigation, isPaymentId, resolvePaymentApiOrigin, resolvePaymentNotificationRoute, toIso } = moduleFixture.exports;

test('P3 checkout trusts the exact Sandbox host and HTTPS only', () => {
  assert.equal(isSandboxCheckout('https://app.sandbox.midtrans.com/snap/v2/checkout'), true);
  assert.equal(isSandboxCheckout('https://app.sandbox.midtrans.com.example.test/snap/checkout'), false);
  assert.equal(isSandboxCheckout('http://app.sandbox.midtrans.com/snap/checkout'), false);
  assert.equal(isSandboxCheckout('https://app.midtrans.com/snap/checkout'), false);
  assert.equal(isSandboxCheckout('javascript:fixture'), false);
});

test('P3 allows only exact HTTPS Sandbox redirect origins and keeps the initial Snap URL strict', () => {
  for (const host of ['api.sandbox.midtrans.com', 'card.sandbox.midtrans.com', 'api.sandbox.veritrans.co.id',
    'simulator.sandbox.midtrans.com', 'simulator.midtrans.com']) {
    assert.equal(isSandboxCheckoutNavigation('https://' + host + '/fixture'), true);
    assert.equal(isSandboxCheckout('https://' + host + '/snap/fixture'), false);
    assert.equal(isSandboxCheckoutNavigation('https://' + host + '.example.test/fixture'), false);
  }
  for (const url of ['https://card.midtrans.com/3ds', 'https://simulator.midtrans.com:8443/',
    'https://user:pass@simulator.midtrans.com/', 'http://simulator.midtrans.com/', 'file:///tmp/fixture']) {
    assert.equal(isSandboxCheckoutNavigation(url), false);
  }
});

test('P3 FCM config is optional and preserves the team Android and Expo settings', () => {
  const source = readFileSync('app.config.js', 'utf8');
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  for (const present of [false, true]) {
    const configModule = { exports: {} };
    const mocks = {
      'node:fs': { existsSync: (location) => {
        assert.equal(location, path.join(process.cwd(), 'google-services.json'));
        return present;
      } },
      'node:path': path,
    };
    new Function('require', 'module', '__dirname', source)((id) => mocks[id], configModule, process.cwd());
    const config = configModule.exports({ config: app });
    assert.equal(config.android.googleServicesFile, present ? './google-services.json' : undefined);
    assert.equal(config.android.package, app.android.package);
    assert.equal(config.owner, app.owner);
    assert.equal(config.extra.eas.projectId, app.extra.eas.projectId);
  }
});

test('P3 payment notification screen targets are fixed and IDs cannot inject routes', () => {
  assert.equal(resolvePaymentNotificationRoute({ type: 'fine_created', screen: 'evil' }), '/denda?tab=aktif');
  assert.equal(resolvePaymentNotificationRoute({ type: 'payment_success' }), '/denda?tab=riwayat');
  assert.equal(resolvePaymentNotificationRoute({ type: 'payment_failed' }), '/denda?tab=riwayat');
  assert.equal(resolvePaymentNotificationRoute({ type: 'leave_decided' }), null);
  assert.equal(isPaymentId('../other'), false);
  assert.equal(isPaymentId('session_abcd'), true);
});

test('P3 persisted Firestore timestamps can be displayed after rehydrating history', () => {
  const observed = { toDate: () => new Date('2026-11-25T03:20:00Z') };
  assert.equal(toIso(observed), '2026-11-25T03:20:00.000Z');
  assert.equal(toIso(null), '');
});

test('P3 never sends Firebase bearer tokens over cleartext LAN', () => {
  assert.equal(resolvePaymentApiOrigin('http://10.0.2.2:3000', true), 'http://10.0.2.2:3000');
  assert.equal(resolvePaymentApiOrigin('http://127.0.0.1:3000', true), 'http://127.0.0.1:3000');
  assert.equal(resolvePaymentApiOrigin('http://10.0.2.2:3000', false), null);
  assert.equal(resolvePaymentApiOrigin('http://192.168.1.10:3000', true), null);
  assert.equal(resolvePaymentApiOrigin('https://sandbox-proxy.example.test', false), 'https://sandbox-proxy.example.test');
});

test('P3 fine notice queued during an outage is replayed after process restart only for its owner', async () => {
  const values = new Map();
  const store = {
    setItem: async (key, value) => values.set(key, value),
    getAllKeys: async () => [...values.keys()],
    removeItem: async (key) => values.delete(key),
  };
  const queueModule = { exports: {} };
  const code = ts.transpileModule(readFileSync('src/services/payments/fineCreatedQueue.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mocks = {
    '@react-native-async-storage/async-storage': { default: store },
    'react-native': {},
    '@/services/payments/paymentService': { PaymentRequestError: class extends Error {} },
    '@/services/payments/paymentData': moduleFixture.exports,
  };
  new Function('require', 'exports', code)((id) => mocks[id], queueModule.exports);
  const { createFineCreatedQueue } = queueModule.exports;
  await createFineCreatedQueue(store, async () => { throw new Error('offline'); }).enqueue('owner', 'session_owner');
  assert.equal(values.size, 1);
  const sent = [];
  const restarted = createFineCreatedQueue(store, async (uid, id) => sent.push([uid, id]));
  await restarted.drain('other');
  assert.equal(sent.length, 0);
  await Promise.all([restarted.drain('owner'), restarted.drain('owner')]);
  assert.deepEqual(sent, [['owner', 'session_owner']]);
  assert.equal(values.size, 0);
});
