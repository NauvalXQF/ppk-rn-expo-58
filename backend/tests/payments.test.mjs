import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { paymentEngine } from '../src/payments.ts';

const uid = 'learner';
const fineId = 'session_learner';
const finePath = 'fines/' + fineId;
const attendancePath = 'sessions/session/attendances/' + uid;
const secret = 'synthetic-signing-key';
const date = (iso) => ({ toMillis: () => Date.parse(iso) });

function fixture() {
  const createdAt = date('2026-11-25T03:20:00Z');
  const attendance = {
    uid, classId: 'lab', sessionId: 'session', status: 'hadir', lateStatus: 'late', lateMinutes: 5,
    fineId, graceDeadlineAt: '2026-11-25T03:15:00Z',
  };
  const rows = new Map([
    [finePath, { id: fineId, uid, sessionId: 'session', attendanceId: attendancePath,
      amount: 10000, status: 'unpaid', latestOrderId: null, labId: 'lab', courseId: 'course', lateMinutes: 5, createdAt }],
    ['sessions/session', { classId: 'lab', labId: 'lab', courseId: 'course', tanggal: '2026-11-25',
      jamMulai: '10:00', openedAt: date('2026-11-25T03:00:00Z'), gracePeriodMinutes: 15, lateFineAmount: 10000 }],
    [attendancePath, attendance],
  ]);
  function doc(path) {
    return { path, collection: (child) => ({ doc: (id) => doc(path + '/' + child + '/' + id) }),
      get: () => Promise.resolve(snapshot(doc(path))) };
  }
  function snapshot(ref) {
    return { ref, data: () => rows.get(ref.path), exists: rows.has(ref.path), createTime: createdAt };
  }
  let queue = Promise.resolve();
  const db = {
    doc,
    collection(name) {
      assert.equal(name, 'leaveRequests');
      const filters = {};
      const query = {
        where(field, operator, value) { assert.equal(operator, '=='); filters[field] = value; return query; },
        limit(size) { assert.equal(size, 1); return { filters }; },
      };
      return query;
    },
    runTransaction(callback) {
      const result = queue.then(async () => {
        const writes = [];
        const tx = {
          get: async (ref) => ref.filters
            ? { empty: ![...rows].some(([key, value]) => key.startsWith('leaveRequests/')
              && Object.entries(ref.filters).every(([field, filter]) => value[field] === filter)) }
            : snapshot(ref),
          getAll: async (...refs) => refs.map(snapshot),
          create(ref, data) { writes.push({ ref, data, create: true }); },
          update(ref, data) { writes.push({ ref, data, merge: true }); },
          set(ref, data, options) { writes.push({ ref, data, merge: options?.merge }); },
        };
        const value = await callback(tx);
        for (const { ref, create } of writes) if (create) assert.ok(!rows.has(ref.path), 'duplicate create');
        for (const { ref, data, merge } of writes) rows.set(ref.path, merge ? { ...rows.get(ref.path), ...data } : data);
        return value;
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const gateway = {
    calls: [],
    current: null,
    async create(orderId, amount) {
      this.calls.push({ orderId, amount });
      assert.equal(rows.get(finePath).latestOrderId, orderId);
      return { snapToken: 'fixture-snap', redirectUrl: 'https://app.sandbox.midtrans.com/snap/fixture' };
    },
    async status() { return this.current; },
  };
  return { rows, attendance, gateway, engine: paymentEngine(db, gateway, secret) };
}

function update(orderId, status, transactionId = 'provider-tx') {
  return { orderId, amount: 10000, transactionId, status, fraud: 'accept',
    paymentType: 'bank_transfer', transactionTime: '2026-11-25 10:20:00' };
}

function payload(orderId, transaction_id = 'provider-tx') {
  return { order_id: orderId, status_code: '200', gross_amount: '10000.00', transaction_id,
    signature_key: createHash('sha512').update(orderId + '20010000.00' + secret).digest('hex') };
}

test('rejects another owner, forged fee and early attendance before calling Snap', async () => {
  const { rows, gateway, engine } = fixture();
  await assert.rejects(engine.create('someone-else', fineId), { code: 'NOT_FOUND' });
  rows.get(finePath).amount = 1;
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_CONFLICT' });
  rows.get(finePath).amount = 10000;
  rows.get('sessions/session').gracePeriodMinutes = 30;
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_CONFLICT' });
  assert.deepEqual(gateway.calls, []);
});

test('concurrent create allocates one order and resume never calls Snap again', async () => {
  const { gateway, rows, engine } = fixture();
  const outcomes = await Promise.allSettled([engine.create(uid, fineId), engine.create(uid, fineId)]);
  const orderId = rows.get(finePath).latestOrderId;
  assert.ok(outcomes.some((result) => result.status === 'fulfilled'));
  assert.equal((await engine.create(uid, fineId)).orderId, orderId);
  assert.deepEqual(gateway.calls, [{ orderId, amount: 10000 }]);
});

test('resume uses the already vetted order after an authorized session policy edit', async () => {
  const { rows, engine, gateway } = fixture();
  const checkout = await engine.create(uid, fineId);
  rows.get('sessions/session').lateFineAmount = 15000;
  rows.get('sessions/session').gracePeriodMinutes = 30;
  assert.deepEqual(await engine.create(uid, fineId), checkout);
  assert.equal(gateway.calls.length, 1);
});

test('an ambiguous create and a status 404 reuse the reservation', async () => {
  const { gateway, rows, engine } = fixture();
  const create = gateway.create.bind(gateway);
  gateway.create = async () => { throw new Error('ambiguous fixture'); };
  await assert.rejects(engine.create(uid, fineId));
  const orderId = rows.get(finePath).latestOrderId;
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_INITIALIZING' });
  rows.get('payments/' + orderId).leaseUntil = 0;
  gateway.create = create;
  assert.equal((await engine.create(uid, fineId)).orderId, orderId);
  assert.deepEqual(gateway.calls, [{ orderId, amount: 10000 }]);
});

test('verified settlement is atomic, idempotent, and cannot regress after older events', async () => {
  const { gateway, rows, engine, attendance } = fixture();
  const { orderId } = await engine.create(uid, fineId);
  gateway.current = update(orderId, 'settlement');
  await engine.webhook(payload(orderId));
  await engine.webhook(payload(orderId));
  await engine.webhook({ ...payload(orderId), transaction_status: 'pending' });
  assert.equal(rows.get(finePath).status, 'paid');
  assert.ok(rows.get(finePath).paidAt);
  assert.equal(rows.get('payments/' + orderId).status, 'success');
  assert.ok(rows.get('payments/' + orderId).settledAt);
  assert.equal(rows.has('paymentReconciliation/' + orderId), false);
  assert.equal(rows.get(attendancePath), attendance);
  assert.equal([...rows.keys()].filter((key) => key.startsWith('notificationOutbox/')).length, 1);
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_CONFLICT' });
});

test('authoritative reversal keeps success immutable and records reconciliation', async () => {
  for (const [initial, later] of [['settlement', 'deny'], ['capture', 'cancel']]) {
    const { gateway, rows, engine } = fixture();
    const { orderId } = await engine.create(uid, fineId);
    gateway.current = update(orderId, initial);
    await engine.webhook(payload(orderId));
    gateway.current = update(orderId, later);
    await engine.webhook(payload(orderId));
    assert.equal(rows.get('payments/' + orderId).status, 'success');
    assert.equal(rows.get(finePath).status, 'paid');
    assert.equal(rows.get('paymentReconciliation/' + orderId).providerStatus, later);
    assert.equal(rows.get(finePath).reconciliationRequired, true);
  }
});

test('status check releases only terminal attempts after checkout expiry and retry rechecks provider', async () => {
  const { gateway, rows, engine } = fixture();
  const { orderId } = await engine.create(uid, fineId);
  gateway.current = update(orderId, 'cancel');
  await engine.webhook(payload(orderId));
  await engine.check(uid, fineId);
  assert.equal(rows.get(finePath).status, 'pending_payment');
  rows.get('payments/' + orderId).pageClosesAt = 1;
  await engine.check(uid, fineId);
  assert.equal(rows.get(finePath).status, 'unpaid');
  gateway.current = update(orderId, 'pending', 'another-attempt');
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_INITIALIZING' });
  assert.equal(gateway.calls.length, 1);
});

test('terminal status releases an unpublished checkout after an ambiguous create', async () => {
  const { gateway, rows, engine } = fixture();
  gateway.create = async () => { throw new Error('response lost'); };
  await assert.rejects(engine.create(uid, fineId));
  const orderId = rows.get(finePath).latestOrderId;
  gateway.current = update(orderId, 'expire');
  await engine.check(uid, fineId);
  assert.equal(rows.get(finePath).status, 'pending_payment');
  rows.get('payments/' + orderId).leaseUntil = 0;
  await engine.check(uid, fineId);
  assert.equal(rows.get(finePath).status, 'unpaid');
});

test('approved leave blocks create and flags any settlement received after checkout', async () => {
  const { gateway, rows, engine } = fixture();
  rows.set('leaveRequests/leave', { sessionId: 'session', uid, status: 'approved' });
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_CONFLICT' });
  rows.delete('leaveRequests/leave');
  const { orderId } = await engine.create(uid, fineId);
  rows.set('leaveRequests/leave', { sessionId: 'session', uid, status: 'approved' });
  gateway.current = update(orderId, 'settlement');
  await engine.webhook(payload(orderId));
  assert.equal(rows.get(finePath).status, 'pending_payment');
  assert.equal(rows.get(finePath).reconciliationRequired, true);
});

test('historical success beside a newer attempt is recorded instead of acknowledged silently', async () => {
  const { gateway, rows, engine } = fixture();
  const { orderId } = await engine.create(uid, fineId);
  gateway.status = async (_orderId, transactionId) => transactionId
    ? update(orderId, 'settlement', transactionId) : update(orderId, 'pending', 'new-attempt');
  await engine.webhook(payload(orderId));
  assert.equal(rows.get('paymentReconciliation/' + orderId).transactionId, 'provider-tx');
  assert.equal(rows.get(finePath).status, 'pending_payment');
});

test('retry opens a new order only after old checkout and instrument are no longer payable', async () => {
  const { gateway, rows, engine } = fixture();
  const { orderId } = await engine.create(uid, fineId);
  gateway.current = update(orderId, 'deny');
  await engine.webhook(payload(orderId));
  assert.equal(rows.get(finePath).status, 'pending_payment');
  assert.equal((await engine.create(uid, fineId)).orderId, orderId);
  gateway.current = update(orderId, 'expire');
  rows.get('payments/' + orderId).pageClosesAt = Date.now() - 1;
  await engine.webhook(payload(orderId));
  assert.equal(rows.get(finePath).status, 'unpaid');
  const order2 = (await engine.create(uid, fineId)).orderId;
  assert.notEqual(orderId, order2);
  gateway.current = update(orderId, 'settlement');
  await engine.webhook(payload(orderId));
  assert.equal(rows.get(finePath).latestOrderId, order2);
  assert.equal(rows.get(finePath).status, 'pending_payment');
  assert.ok(rows.has('paymentReconciliation/' + orderId));
  await assert.rejects(engine.create(uid, fineId), { code: 'PAYMENT_CONFLICT' });
});

test('waived fines cannot be settled automatically', async () => {
  const { gateway, rows, engine } = fixture();
  const { orderId } = await engine.create(uid, fineId);
  rows.get(finePath).status = 'waived';
  gateway.current = update(orderId, 'settlement');
  await engine.webhook(payload(orderId));
  assert.equal(rows.get(finePath).status, 'waived');
  assert.equal(rows.get('payments/' + orderId).status, 'pending');
  assert.ok(rows.has('paymentReconciliation/' + orderId));
});
