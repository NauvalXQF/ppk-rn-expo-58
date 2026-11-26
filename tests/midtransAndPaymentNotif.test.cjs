const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
const moduleFixture = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync('src/services/payments/paymentData.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
new Function('exports', outputText)(moduleFixture.exports);
const { isSandboxCheckout, isPaymentId, resolvePaymentApiOrigin, resolvePaymentNotificationRoute, toIso } = moduleFixture.exports;

test('P3 checkout trusts the exact Sandbox host and HTTPS only', () => {
  assert.equal(isSandboxCheckout('https://app.sandbox.midtrans.com/snap/v2/checkout'), true);
  assert.equal(isSandboxCheckout('https://app.sandbox.midtrans.com.example.test/snap/checkout'), false);
  assert.equal(isSandboxCheckout('http://app.sandbox.midtrans.com/snap/checkout'), false);
  assert.equal(isSandboxCheckout('https://app.midtrans.com/snap/checkout'), false);
  assert.equal(isSandboxCheckout('javascript:fixture'), false);
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
