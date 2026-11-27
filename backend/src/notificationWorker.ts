import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { object } from './provisioning.ts';

const interval = 15_000;
const receiptDelay = 15 * 60_000;
const deliveryLease = 2 * 60_000;
const recentEnough = 23 * 60 * 60_000;
const maxAttempts = 4;
const pushEndpoint = 'https://exp.host/--/api/v2/push/';
type Receipt = { id: string; deviceId: string };
type Job = {
  recipientUid: string; title: string; body: string; data: Record<string, string>;
  state: 'queued' | 'preparing' | 'sending' | 'receipt' | 'checking' | 'done';
  lease: string; attempts?: number; startedAt?: number; receipts?: Receipt[]; delivered?: boolean;
  remainingDeviceIds?: string[];
  uncertain?: boolean;
};
type ExpoResult = { status?: string; id?: string; details?: { error?: string } };

export function expoTransport(fetchFn = fetch, accessToken?: string) {
  return async (path: 'send' | 'getReceipts', data: unknown) => {
    const response = await fetchFn(pushEndpoint + path, { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(6500), headers: { 'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) }, body: JSON.stringify(data) });
    if (response.status === 429) return { limited: true as const };
    if (!response.ok) throw new Error('Expo Push request failed.');
    return { limited: false as const, data: object(await response.json()).data };
  };
}

export function notificationWorker(db: Firestore, send = expoTransport()) {
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function claim(ref: DocumentReference) {
    return db.runTransaction(async (tx) => {
      const job = (await tx.get(ref)).data();
      if (!job || job.state === 'done' || job.nextAt?.toMillis() > Date.now()) return;
      if (job.state === 'sending') {
        // A stopped process may have dispatched already. Check known receipts without replaying.
        if (job.receipts?.length) {
          tx.update(ref, { state: 'receipt', uncertain: true, nextAt: Timestamp.now() });
          return;
        }
        tx.update(ref, { state: 'done', uncertain: true, nextAt: FieldValue.delete() });
        tx.update(db.doc('notifications/' + ref.id), { status: 'failed', deliveryUncertain: true });
        return;
      }
      const lease = randomUUID();
      const state = job.state === 'queued' || job.state === 'preparing' ? 'preparing' : 'checking';
      tx.update(ref, { state, lease, nextAt: Timestamp.fromMillis(Date.now() + deliveryLease) });
      return { ...job, state, lease } as Job;
    });
  }

  async function finish(ref: DocumentReference, job: Job, change: Record<string, unknown>,
    status?: 'sent' | 'failed' | 'delivered') {
    return db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (!current || current.lease !== job.lease || current.state === 'done') return false;
      tx.update(ref, change);
      if (status) tx.update(db.doc('notifications/' + ref.id), {
        status, ...(change.uncertain ? { deliveryUncertain: true } : {}),
      });
      return true;
    });
  }

  async function deliver(ref: DocumentReference, job: Job) {
    const devices = db.collection('users/' + job.recipientUid + '/devices');
    let snapshot;
    try { snapshot = await devices.get(); }
    catch {
      const attempts = (job.attempts ?? 0) + 1;
      if (attempts < maxAttempts) await finish(ref, job, { state: 'queued', attempts,
        nextAt: Timestamp.fromMillis(Date.now() + attempts * interval) });
      else if (job.receipts?.length) await finish(ref, job, { state: 'receipt', nextAt: Timestamp.now() });
      else await finish(ref, job, { state: 'done', nextAt: FieldValue.delete() }, 'failed');
      return;
    }
    const remaining = job.remainingDeviceIds && new Set(job.remainingDeviceIds);
    const tokens = snapshot.docs.flatMap((doc) => {
      const token = doc.get('token');
      return (!remaining || remaining.has(doc.id)) && typeof token === 'string' && /^(?:ExpoPushToken|ExponentPushToken)\[[a-zA-Z0-9_-]+\]$/.test(token)
        ? [{ id: doc.id, token }] : [];
    });
    const unique = [...new Map(tokens.map((entry) => [entry.token, entry])).values()];
    const receipts: Receipt[] = [...(job.receipts ?? [])];
    const startedAt = job.startedAt ?? Date.now();
    let uncertain = job.uncertain === true;
    let offset = 0;
    let rateLimited = false;
    if (unique.length && !await finish(ref, job, { state: 'sending', nextAt: Timestamp.fromMillis(Date.now() + deliveryLease) })) return;
    while (offset < unique.length) {
      const chunk = unique.slice(offset, offset + 100);
      try {
        const response = await send('send', chunk.map(({ token }) => ({
          to: token, title: job.title, body: job.body, data: job.data,
          channelId: 'praktikum-events', sound: 'default',
        })));
        if (response.limited) { rateLimited = true; break; }
        if (!Array.isArray(response.data) || response.data.length !== chunk.length) uncertain = true;
        else {
          const tickets = response.data as ExpoResult[];
          for (const [index, ticket] of tickets.entries()) {
            if (ticket?.status === 'ok' && typeof ticket.id === 'string') receipts.push({ id: ticket.id, deviceId: chunk[index].id });
            else if (ticket?.details?.error === 'DeviceNotRegistered') await devices.doc(chunk[index].id).delete()
              .catch(() => console.error('Could not remove unregistered push token.'));
          }
        }
      } catch { uncertain = true; }
      offset += chunk.length;
    }
    const attempts = (job.attempts ?? 0) + 1;
    if (rateLimited && attempts < maxAttempts) {
      await finish(ref, job, { state: 'queued', attempts, receipts, uncertain, startedAt,
        remainingDeviceIds: unique.slice(offset).map((entry) => entry.id),
        nextAt: Timestamp.fromMillis(Date.now() + attempts * interval) });
    } else if (receipts.length) {
      await finish(ref, job, { state: 'receipt', receipts, uncertain, startedAt,
        nextAt: Timestamp.fromMillis(Date.now() + receiptDelay) });
    } else {
      await finish(ref, job, { state: 'done', uncertain, nextAt: FieldValue.delete() }, 'failed');
    }
  }

  async function check(ref: DocumentReference, job: Job) {
    const receipts = job.receipts ?? [];
    if (Date.now() - (job.startedAt ?? 0) > recentEnough || !receipts.length) {
      await finish(ref, job, { state: 'done', nextAt: FieldValue.delete() }, job.delivered ? 'delivered' : 'failed');
      return;
    }
    let delivered = job.delivered === true;
    let unresolved = receipts;
    try {
      const response = await send('getReceipts', { ids: receipts.map((receipt) => receipt.id) });
      if (!response.limited) {
        const results = object(response.data) as Record<string, ExpoResult>;
        unresolved = [];
        for (const receipt of receipts) {
          const result = results[receipt.id];
          if (!result) { unresolved.push(receipt); continue; }
          if (result.status === 'ok') delivered = true;
          if (result.details?.error === 'DeviceNotRegistered') {
            await db.doc('users/' + job.recipientUid + '/devices/' + receipt.deviceId).delete()
              .catch(() => console.error('Could not remove unregistered push token.'));
          }
        }
      }
    } catch { unresolved = receipts; }
    if (unresolved.length) await finish(ref, job, { state: 'receipt', delivered, receipts: unresolved,
      nextAt: Timestamp.fromMillis(Date.now() + receiptDelay) }, delivered ? 'delivered' : undefined);
    else await finish(ref, job, { state: 'done', delivered, nextAt: FieldValue.delete() }, delivered ? 'delivered' : 'failed');
  }

  async function tick() {
    const due = await db.collection('notificationOutbox').where('nextAt', '<=', Timestamp.now()).limit(5).get();
    for (const candidate of due.docs) {
      const job = await claim(candidate.ref);
      if (job?.state === 'preparing') await deliver(candidate.ref, job);
      if (job?.state === 'checking') await check(candidate.ref, job);
    }
  }
  function poll() {
    if (!running) running = tick().catch(() => console.error('Payment notification worker tick failed.'))
      .finally(() => { running = undefined; });
    return running;
  }
  return {
    poll,
    start() {
      if (timer) return;
      timer = setInterval(() => void poll(), interval);
      timer.unref();
    },
    async stop() {
      clearInterval(timer);
      timer = undefined;
      await running;
    },
  };
}
