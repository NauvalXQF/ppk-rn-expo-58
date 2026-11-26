import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Router } from 'express';
import { docId, object } from './provisioning.ts';
import { HttpError } from './middleware/errorHandler.ts';
import { verifyFirebaseToken } from './middleware/verifyFirebaseToken.ts';
import type { FirebaseIdentityAdapter } from './config/firebaseAdmin.ts';
import { snapPageMs, verifyWebhook, type Checkout, type Gateway, type ProviderStatus } from './midtrans.ts';
import { approvedLeaveExists, readFineEvidence } from './paymentEvidence.ts';
import { enqueuePaymentEvent, paymentEventId } from './paymentEvents.ts';

export function mapProviderStatus(data: ProviderStatus) {
  if (data.status === 'settlement' || (data.status === 'capture' && data.fraud === 'accept')) return 'success';
  if (data.status === 'pending' || (data.status === 'capture' && data.fraud === 'challenge')) return 'pending';
  if (['expire', 'cancel', 'deny', 'failure'].includes(data.status)) return 'failed';
  return 'anomaly';
}

function terminalFailure(data: ProviderStatus) {
  return data.status === 'expire' || data.status === 'cancel';
}

function assertProviderMatch(data: ProviderStatus, orderId: string, amount: number) {
  if (data.orderId !== orderId || data.amount !== amount) throw new HttpError('PAYMENT_CONFLICT');
}

function metadata(value: unknown) { return typeof value === 'string' ? value : ''; }

export function paymentEngine(db: Firestore, gateway: Gateway, secret: string) {
  type Reservation = { orderId: string; amount: number; checkout?: Checkout; leaseId?: string;
    recovering?: boolean; hasProviderTransaction?: boolean; retryRevision?: number; priorTransactionId?: string };
  async function reserve(uid: string, fineId: string,
    proof?: { orderId: string; revision: number; transactionId: string }): Promise<Reservation> {
    return db.runTransaction(async (tx) => {
      const ref = db.doc('fines/' + fineId);
      const fine = (await tx.get(ref)).data();
      if (!fine || fine.uid !== uid) throw new HttpError('NOT_FOUND');
      if (fine.status !== 'unpaid' && fine.status !== 'pending_payment') throw new HttpError('PAYMENT_CONFLICT');
      const oldId = fine.latestOrderId;
      if (oldId != null && !docId(oldId)) throw new HttpError('PAYMENT_CONFLICT');
      const old = oldId ? await tx.get(db.doc('payments/' + oldId)) : undefined;
      const oldOrder = old?.data();
      if ((oldId && !oldOrder) || (fine.status === 'pending_payment' && !oldOrder)) throw new HttpError('PAYMENT_CONFLICT');
      const now = Date.now();
      if (fine.reconciliationRequired) throw new HttpError('PAYMENT_CONFLICT');
      if (proof && (proof.orderId !== oldId || oldOrder?.revision !== proof.revision
        || oldOrder.midtransTransactionId !== proof.transactionId
        || oldOrder.status !== 'failed' || oldOrder.retryable !== true)) throw new HttpError('PAYMENT_INITIALIZING');
      if (oldOrder) {
        if (oldOrder.uid !== uid || oldOrder.fineId !== fineId || oldOrder.grossAmount !== fine.amount
          || oldOrder.sessionId !== fine.sessionId
          || oldOrder.status === 'success' || oldOrder.reconciliationRequired) throw new HttpError('PAYMENT_CONFLICT');
        // The persisted backend order already vetted the amount and attendance.
        if (await approvedLeaveExists(tx, db, oldOrder.sessionId, uid)) throw new HttpError('PAYMENT_CONFLICT');
        if (oldOrder.status === 'failed' && oldOrder.retryable === true) {
          if (!proof) return { orderId: oldId, amount: fine.amount, retryRevision: oldOrder.revision,
            priorTransactionId: oldOrder.midtransTransactionId };
        } else {
          const privateRef = db.doc('paymentCheckouts/' + oldId);
          const checkout = (await tx.get(privateRef)).data();
          if (checkout && now < oldOrder.pageClosesAt) return { orderId: oldId, amount: fine.amount as number, checkout: checkout as Checkout };
          if (oldOrder.leaseUntil > now) throw new HttpError('PAYMENT_INITIALIZING');
          const leaseId = randomUUID();
          tx.update(old!.ref, { leaseUntil: now + 20_000, leaseId });
          return { orderId: oldId, amount: fine.amount as number, leaseId, recovering: true,
            hasProviderTransaction: Boolean(oldOrder.midtransTransactionId), priorTransactionId: oldOrder.midtransTransactionId };
        }
      }
      const createdAt = oldOrder ? oldOrder.fineCreatedAt : (await readFineEvidence(tx, db, fineId, uid)).createdAt;
      const orderId = 'FINE-' + randomUUID();
      const leaseId = randomUUID();
      tx.create(db.doc('payments/' + orderId), {
        orderId, fineId, uid, grossAmount: fine.amount, status: 'pending',
        praktikanNama: metadata(fine.praktikanNama), courseId: fine.courseId, labId: fine.labId,
        labNama: metadata(fine.labNama), sessionId: fine.sessionId, sessionTopik: metadata(fine.sessionTopik),
        fineCreatedAt: createdAt, paymentType: null, settledAt: null, transactionTime: null,
        midtransTransactionId: null, midtransTransactionStatus: null, retryable: false, revision: 0,
        leaseId, leaseUntil: now + 20_000,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(ref, { status: 'pending_payment', latestOrderId: orderId, updatedAt: FieldValue.serverTimestamp() });
      return { orderId, amount: fine.amount as number, leaseId, recovering: false };
    });
  }

  async function create(uid: string, fineId: string): Promise<Checkout & { orderId: string }> {
    let order = await reserve(uid, fineId);
    if (order.retryRevision !== undefined) {
      const latest = await gateway.status(order.orderId);
      if (!latest) throw new HttpError('PAYMENT_INITIALIZING');
      assertProviderMatch(latest, order.orderId, order.amount);
      if (!terminalFailure(latest) || latest.transactionId !== order.priorTransactionId) {
        throw new HttpError('PAYMENT_INITIALIZING');
      }
      order = await reserve(uid, fineId, { orderId: order.orderId, revision: order.retryRevision,
        transactionId: latest.transactionId });
    }
    if (order.checkout) return { ...order.checkout, orderId: order.orderId };
    if (order.recovering) {
      const existing = await gateway.status(order.orderId) ?? (order.priorTransactionId
        ? await gateway.status(order.orderId, order.priorTransactionId) : null);
      if (existing) {
        assertProviderMatch(existing, order.orderId, order.amount);
        // Leave successful outcomes for authenticated webhook verification.
        if (mapProviderStatus(existing) !== 'success') {
          const ref = db.doc('payments/' + order.orderId);
          const known = (await ref.get()).data();
          if (known && known.leaseId === order.leaseId) await applyStatus(existing, known.revision, false, order.leaseId);
        }
        throw new HttpError('PAYMENT_INITIALIZING');
      }
      if (order.hasProviderTransaction) throw new HttpError('PAYMENT_INITIALIZING');
    }
    // If the provider has no transaction, reissue only the same reserved order.
    const checkout = await gateway.create(order.orderId, order.amount);
    await db.runTransaction(async (tx) => {
      const ref = db.doc('payments/' + order.orderId);
      const current = (await tx.get(ref)).data();
      const fine = (await tx.get(db.doc('fines/' + fineId))).data();
      if (!current || current.leaseId !== order.leaseId || current.status === 'success'
        || current.reconciliationRequired || current.midtransTransactionId
        || fine?.status !== 'pending_payment' || fine.latestOrderId !== order.orderId) throw new HttpError('PAYMENT_CONFLICT');
      tx.set(db.doc('paymentCheckouts/' + order.orderId), checkout);
      tx.update(ref, { leaseUntil: 0, leaseId: null, pageClosesAt: Date.now() + snapPageMs + 15_000,
        updatedAt: FieldValue.serverTimestamp() });
    });
    return { orderId: order.orderId, ...checkout };
  }

  async function applyStatus(data: ProviderStatus, revision: number, signed: boolean, leaseId?: string,
    historical = false, allowRelease = true) {
    const orderRef = db.doc('payments/' + data.orderId);
    await db.runTransaction(async (tx) => {
      const order = (await tx.get(orderRef)).data();
      if (!order) throw new HttpError('NOT_FOUND');
      assertProviderMatch(data, data.orderId, order.grossAmount);
      if (order.revision !== revision || (leaseId && order.leaseId !== leaseId)) throw new HttpError('PAYMENT_UNAVAILABLE');
      const fineRef = db.doc('fines/' + order.fineId);
      const fine = (await tx.get(fineRef)).data();
      const status = mapProviderStatus(data);
      const isLatest = fine?.latestOrderId === data.orderId;
      const now = Date.now();
      const checkout = terminalFailure(data) ? await tx.get(db.doc('paymentCheckouts/' + data.orderId)) : undefined;
      // A missing checkout never left the API, which persists the token before returning it.
      const canRetry = allowRelease && terminalFailure(data) && (checkout?.exists
        ? typeof order.pageClosesAt === 'number' && now >= order.pageClosesAt
        : Boolean(leaseId) || !(order.leaseUntil > now));
      const alreadySuccessful = order.status === 'success';
      const reversal = alreadySuccessful && order.midtransTransactionId === data.transactionId
        && (data.status === 'deny' || data.status === 'cancel');
      if (alreadySuccessful && !reversal && status !== 'anomaly'
        && (status !== 'success' || order.midtransTransactionId === data.transactionId)) return;
      const excused = status === 'success' && await approvedLeaveExists(tx, db, order.sessionId, order.uid);
      const anomaly = reversal || status === 'anomaly' || !fine || fine.uid !== order.uid || fine.amount !== order.grossAmount
        || (status === 'success' && (excused || historical || !isLatest || fine.status === 'waived' || fine.status === 'paid'
          || fine.reconciliationRequired || alreadySuccessful));
      if (anomaly) {
        tx.set(db.doc('paymentReconciliation/' + data.orderId), {
          orderId: data.orderId, fineId: order.fineId, providerStatus: data.status,
          transactionId: data.transactionId, observedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (!order.reconciliationRequired) tx.update(orderRef, { reconciliationRequired: true, revision: revision + 1 });
        if (fine && fine.uid === order.uid && fine.reconciliationRequired !== true) tx.update(fineRef, { reconciliationRequired: true });
        return;
      }
      if (order.reconciliationRequired || fine.reconciliationRequired || (!signed && status === 'success')) return;
      if (!isLatest || (fine.status !== 'pending_payment' && fine.status !== 'unpaid')) return;
      if (order.retryable && status !== 'success') return;
      if (order.status === status && order.midtransTransactionId === data.transactionId
        && order.midtransTransactionStatus === data.status && order.retryable === canRetry && !leaseId) return;

      const event = status === 'success' ? 'payment_success' : status === 'failed' ? 'payment_failed' : null;
      const eventExists = event
        ? (await tx.get(db.doc('notifications/' + paymentEventId(event, order.fineId, data.orderId)))).exists : false;
      tx.update(orderRef, { status, retryable: canRetry, revision: revision + 1,
        midtransTransactionId: data.transactionId, midtransTransactionStatus: data.status,
        paymentType: data.paymentType, transactionTime: data.transactionTime,
        ...(leaseId || status === 'success' || !(order.leaseUntil > now) ? { leaseId: null, leaseUntil: 0 } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        ...(status === 'success' ? { settledAt: FieldValue.serverTimestamp() } : {}) });
      if (status === 'success') {
        tx.update(fineRef, { status: 'paid', paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      } else if (canRetry) {
        tx.update(fineRef, { status: 'unpaid', updatedAt: FieldValue.serverTimestamp() });
      }
      if (event && !eventExists) enqueuePaymentEvent(tx, db, event, order.uid, order.fineId, data.orderId);
    });
  }

  async function webhook(payload: unknown) {
    const input = verifyWebhook(payload, secret);
    const order = (await db.doc('payments/' + input.orderId).get()).data();
    if (!order) throw new HttpError('NOT_FOUND');
    if (input.amount !== order.grossAmount) throw new HttpError('PAYMENT_CONFLICT');
    let latest: ProviderStatus | null;
    try { latest = await gateway.status(input.orderId); }
    catch { latest = null; } // Some channels support only transaction-ID lookup.
    const authoritative = latest?.transactionId === input.transactionId ? latest
      : await gateway.status(input.orderId, input.transactionId);
    if (!authoritative) throw new HttpError('PAYMENT_UNAVAILABLE');
    assertProviderMatch(authoritative, input.orderId, input.amount);
    if (authoritative.transactionId !== input.transactionId) throw new HttpError('PAYMENT_UNAVAILABLE');
    const historical = Boolean(latest && latest.transactionId !== input.transactionId);
    const status = mapProviderStatus(authoritative);
    if (historical && status !== 'success' && status !== 'anomaly'
      && !(order.status === 'success' && order.midtransTransactionId === input.transactionId)) return;
    await applyStatus(authoritative, order.revision, true, undefined, historical, latest !== null);
  }

  async function check(uid: string, fineId: string) {
    const fine = (await db.doc('fines/' + fineId).get()).data();
    if (!fine || fine.uid !== uid) throw new HttpError('NOT_FOUND');
    if (fine.status !== 'pending_payment' || fine.reconciliationRequired || !docId(fine.latestOrderId)) return;
    const orderId = fine.latestOrderId;
    const order = (await db.doc('payments/' + orderId).get()).data();
    if (!order || order.uid !== uid || order.fineId !== fineId) throw new HttpError('PAYMENT_CONFLICT');
    const latest = await gateway.status(orderId);
    if (!latest) return;
    assertProviderMatch(latest, orderId, order.grossAmount);
    if (mapProviderStatus(latest) !== 'success') await applyStatus(latest, order.revision, false);
  }

  return { create, webhook, check };
}

export function registerPayments(router: Router, identity: FirebaseIdentityAdapter, db: Firestore, gateway?: Gateway, secret?: string) {
  const engine = gateway && secret ? paymentEngine(db, gateway, secret) : undefined;
  router.post('/payments/fine-created', verifyFirebaseToken(identity), async (req, res) => {
    if (res.locals.auth.role !== 'praktikan') throw new HttpError('FORBIDDEN');
    const { fineId } = object(req.body);
    if (!docId(fineId)) throw new HttpError('INVALID_INPUT');
    const uid: string = res.locals.auth.uid;
    await db.runTransaction(async (tx) => {
      await readFineEvidence(tx, db, fineId, uid, true);
      if (!(await tx.get(db.doc('notifications/' + paymentEventId('fine_created', fineId)))).exists) {
        enqueuePaymentEvent(tx, db, 'fine_created', uid, fineId);
      }
    });
    res.sendStatus(204);
  });
  router.post('/payments/create', verifyFirebaseToken(identity), async (req, res) => {
    if (res.locals.auth.role !== 'praktikan') throw new HttpError('FORBIDDEN');
    const { fineId } = object(req.body);
    if (!docId(fineId)) throw new HttpError('INVALID_INPUT');
    if (!engine) throw new HttpError('PAYMENT_UNAVAILABLE');
    res.set('Cache-Control', 'no-store').json(await engine.create(res.locals.auth.uid, fineId));
  });
  router.post('/payments/status', verifyFirebaseToken(identity), async (req, res) => {
    if (res.locals.auth.role !== 'praktikan') throw new HttpError('FORBIDDEN');
    const { fineId } = object(req.body);
    if (!docId(fineId)) throw new HttpError('INVALID_INPUT');
    if (!engine) throw new HttpError('PAYMENT_UNAVAILABLE');
    await engine.check(res.locals.auth.uid, fineId);
    res.sendStatus(204);
  });
  router.post('/payments/webhook', async (req, res) => {
    if (!engine) throw new HttpError('PAYMENT_UNAVAILABLE');
    await engine.webhook(req.body);
    res.sendStatus(204);
  });
}
