import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationWorker } from '../src/notificationWorker.ts';

function fixture(deviceCount = 1, readFails = false) {
  const event = 'payment_success_fixture';
  const now = { toMillis: () => 0 };
  let job = { state: 'queued', nextAt: now, recipientUid: 'learner', title: 'Done', body: '',
    data: { notificationId: event } };
  let auditStatus = 'sent';
  const ref = { id: event };
  let writes = Promise.resolve();
  const db = {
    doc(path) { return { path }; },
    collection(path) {
      if (path === 'notificationOutbox') return {
        where: () => ({ limit: () => ({ get: async () => ({ docs: [{ ref }] }) }) }),
      };
      assert.equal(path, 'users/learner/devices');
      return { get: async () => {
        if (readFails) { readFails = false; throw new Error('transient registry read'); }
        return { docs: Array.from({ length: deviceCount }, (_, i) => ({
          id: 'device-' + i, get: () => 'ExpoPushToken[synthetic-' + i + ']',
        })) };
      } };
    },
    runTransaction(fn) {
      const next = writes.then(() => fn({
        get: async () => ({ data: () => job }),
        update(target, patch) {
          if (target === ref) job = { ...job, ...patch };
          else auditStatus = patch.status;
        },
      }));
      writes = next.catch(() => {});
      return next;
    },
  };
  return { db, event, job: () => job, ready: () => { job.nextAt = now; }, audit: () => auditStatus };
}

test('two workers claim one push, retain its audit ID and process the receipt', async () => {
  const { db, event, job, ready, audit } = fixture();
  let pushes = 0;
  const send = async (path, body) => {
    if (path === 'send') {
      pushes++;
      assert.equal(body[0].data.notificationId, event);
      return { limited: false, data: [{ status: 'ok', id: 'ticket-fixture' }] };
    }
    assert.deepEqual(body, { ids: ['ticket-fixture'] });
    return { limited: false, data: { 'ticket-fixture': { status: 'ok' } } };
  };
  const first = notificationWorker(db, send);
  const second = notificationWorker(db, send);
  await Promise.all([first.poll(), second.poll()]);
  assert.equal(pushes, 1);
  assert.equal(job().state, 'receipt');
  ready();
  await second.poll();
  assert.equal(job().state, 'done');
  assert.equal(audit(), 'delivered');
});

test('a registry read failure does not discard a job that never reached Expo', async () => {
  const { db, job, ready } = fixture(1, true);
  let pushes = 0;
  const worker = notificationWorker(db, async () => {
    pushes++;
    return { limited: false, data: [{ status: 'ok', id: 'ticket' }] };
  });
  await worker.poll();
  assert.equal(job().state, 'queued');
  assert.equal(pushes, 0);
  ready();
  await worker.poll();
  assert.equal(job().state, 'receipt');
  assert.equal(pushes, 1);
});

test('429 after an accepted chunk retries only devices that were not accepted', async () => {
  const { db, job, ready } = fixture(101);
  const batches = [];
  const worker = notificationWorker(db, async (_path, body) => {
    batches.push(body.map((item) => item.to));
    if (batches.length === 2) return { limited: true };
    return { limited: false, data: body.map((item) => ({ status: 'ok', id: item.to })) };
  });
  await worker.poll();
  assert.deepEqual(job().remainingDeviceIds, ['device-100']);
  assert.equal(job().receipts.length, 100);
  ready();
  await worker.poll();
  assert.deepEqual(batches.map((chunk) => chunk.length), [100, 1, 1]);
  assert.deepEqual(batches[2], batches[1]);
  assert.equal(job().receipts.length, 101);
});
