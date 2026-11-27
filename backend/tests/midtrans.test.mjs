import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { verifyWebhook, sandboxGateway, resolveWebhookKey } from '../src/midtrans.ts';
import { createApp } from '../src/app.ts';
import { registerPayments } from '../src/payments.ts';

test('chooses one webhook key at startup and never retries a rejected signature with the API key', () => {
  const apiKey = 'synthetic-api-key';
  const secret = 'synthetic-signature-secret';
  const order_id = 'FINE-9da389c4-5a8e-4b51-866f-ccfd24b5c1e0';
  const sign = (key) => ({
    order_id, status_code: '200', gross_amount: '10000.00', transaction_id: 'fixture',
    signature_key: createHash('sha512').update(order_id + '20010000.00' + key).digest('hex'),
  });
  assert.equal(verifyWebhook(sign(secret), resolveWebhookKey(secret, apiKey)).amount, 10000);
  assert.throws(() => verifyWebhook(sign(apiKey), resolveWebhookKey(secret, apiKey)), { code: 'FORBIDDEN' });
  for (const missing of [undefined, '', '   ']) {
    assert.equal(verifyWebhook(sign(apiKey), resolveWebhookKey(missing, apiKey)).amount, 10000);
  }
  assert.equal(resolveWebhookKey(), undefined);
});

test('preserves the signed amount, rejects a different digest and treats 404 as unknown', async () => {
  const secret = 'synthetic-signature-secret';
  const order_id = 'FINE-9da389c4-5a8e-4b51-866f-ccfd24b5c1e0';
  const signature_key = createHash('sha512').update(order_id + '20010000.00' + secret).digest('hex');
  const payload = { order_id, status_code: '200', gross_amount: '10000.00', transaction_id: 'fixture', signature_key };
  assert.equal(verifyWebhook(payload, secret).amount, 10000);
  assert.throws(() => verifyWebhook({ ...payload, gross_amount: '10000' }, secret), { code: 'FORBIDDEN' });
  const gateway = sandboxGateway('synthetic-api-key', async (url, options) => {
    assert.equal(url, 'https://api.sandbox.midtrans.com/v2/' + order_id + '/status');
    assert.equal(options.redirect, 'error');
    return new Response('{"status_code":"404"}', { status: 404 });
  });
  assert.equal(await gateway.status(order_id), null);
});

test('public webhook rejects a wrong signature without calling Firestore or Midtrans', async () => {
  const notExpected = () => { throw new Error('A verified webhook is required before I/O'); };
  const app = createApp((router) => registerPayments(router, {}, { doc: notExpected },
    { status: notExpected }, 'synthetic-signature-secret'));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/payments/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'FINE-9da389c4-5a8e-4b51-866f-ccfd24b5c1e0', transaction_id: 'fixture',
        gross_amount: '10000.00', status_code: '200', signature_key: '0'.repeat(128) }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'FORBIDDEN');
  } finally {
    await new Promise((done) => server.close(done));
  }
});
