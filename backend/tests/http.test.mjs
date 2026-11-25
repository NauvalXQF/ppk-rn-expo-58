import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { verifyFirebaseToken } from '../src/middleware/verifyFirebaseToken.ts';

const fixtureInternalError = 'SYNTHETIC_PRIVATE_ERROR';
const profiles = {
  student: { uid: 'student', role: 'praktikan', managedCourseIds: ['ignored-course'] },
  legacy: { uid: 'legacy', role: 'asisten', assignedLabIds: ['lab-a', 1, ''] },
  admin: { uid: 'admin', role: 'aslab', managedCourseIds: ['course-a'], assignedLabIds: ['ignored-lab'] },
  unexpected: { uid: 'unexpected', role: 'owner' },
  mismatched: { uid: 'different-user', role: 'aslab' },
};

const fakeIdentity = {
  async verifyIdToken(token) {
    const [, uid, signature] = token.split('.');
    if (uid === 'outage') throw new Error(fixtureInternalError);
    return signature === 'valid' ? { uid } : null;
  },
  async readUserProfile(uid) {
    assert.notEqual(uid, 'rejected', 'Rejected tokens must never cause a profile read.');
    return profiles[uid];
  },
};

let server;
let baseUrl;

before(async () => {
  const app = createApp((router) => {
    router.get('/fixture/identity', verifyFirebaseToken(fakeIdentity), (_req, res) => res.json(res.locals.auth));
    router.post('/fixture/body', (req, res) => res.json(req.body));
    router.get('/fixture/failure', async () => { throw new Error(fixtureInternalError); });
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

async function checkError(response, status, code) {
  assert.equal(response.status, status);
  const { error } = await response.json();
  assert.deepEqual(Object.keys(error).sort(), ['code', 'message', 'requestId']);
  assert.equal(error.code, code);
  assert.equal(error.requestId, response.headers.get('x-request-id'));
  assert.ok(error.requestId);
  assert.ok(error.message);
  assert.ok(!error.message.includes(fixtureInternalError));
}

function identityRequest(authorization) {
  const headers = authorization === undefined ? {} : { authorization };
  return fetch(baseUrl + '/api/fixture/identity', { headers });
}

test('health gives only a liveness status and a server-generated request ID', async () => {
  const url = baseUrl + '/api/health';
  const response = await fetch(url, { headers: { 'X-Request-Id': 'untrusted-fixture-id' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.has('x-powered-by'), false);
  const requestId = response.headers.get('x-request-id');
  assert.match(requestId, /^[a-f0-9-]{36}$/);
  const nextResponse = await fetch(url);
  assert.notEqual(nextResponse.headers.get('x-request-id'), requestId);
  await nextResponse.json();
});

test('unregistered routes and asynchronous errors use the sanitized error format', async () => {
  await checkError(await fetch(baseUrl + '/api/missing'), 404, 'NOT_FOUND');
  const response = await fetch(baseUrl + '/api/fixture/failure');
  const body = await response.clone().text();
  assert.ok(!body.includes(fixtureInternalError));
  assert.ok(!body.includes('stack'));
  await checkError(response, 500, 'INTERNAL_ERROR');
});

test('JSON parsing rejects malformed and oversized bodies without returning their content', async () => {
  const endpoint = baseUrl + '/api/fixture/body';
  const headers = { 'content-type': 'application/json' };
  const send = (body) => fetch(endpoint, { method: 'POST', headers, body });
  const valid = await send('{"allowed":true}');
  assert.deepEqual(await valid.json(), { allowed: true });
  const malformed = await send('{"' + fixtureInternalError);
  await checkError(malformed, 400, 'INVALID_JSON');
  await checkError(await send(JSON.stringify({ body: 'x'.repeat(16_384) })), 413, 'PAYLOAD_TOO_LARGE');
});

test('rejects missing or malformed Bearer headers and unverified tokens', async () => {
  for (const header of [undefined, 'Basic token', 'Bearer', 'Bearer opaque', 'Bearer header.rejected.invalid']) {
    const response = await identityRequest(header);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    await checkError(response, 401, 'UNAUTHENTICATED');
  }
});

test('uses the verified UID and trusted profile to supply role and scope', async () => {
  for (const profile of [
    { uid: 'student', role: 'praktikan', managedCourseIds: [], assignedLabIds: [] },
    { uid: 'legacy', role: 'asprak', managedCourseIds: [], assignedLabIds: ['lab-a'] },
    { uid: 'admin', role: 'aslab', managedCourseIds: ['course-a'], assignedLabIds: [] },
  ]) {
    const response = await identityRequest('bearer header.' + profile.uid + '.valid');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), profile);
  }
});

test('denies access for missing, unknown-role, and mismatched profiles', async () => {
  for (const uid of ['missing', 'unexpected', 'mismatched']) {
    await checkError(await identityRequest('Bearer header.' + uid + '.valid'), 403, 'FORBIDDEN');
  }
});

test('distinguishes a verifier outage from an invalid token without leaking SDK errors', async () => {
  await checkError(await identityRequest('Bearer header.outage.valid'), 500, 'INTERNAL_ERROR');
});
