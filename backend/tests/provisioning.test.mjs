import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firebaseProvisioningStore, provisionUsers } from '../src/provisioning.ts';

test('uses Auth UID, reports conflicting rows and resumes a partial creation', async () => {
  const row = { role: 'praktikan', rowId: 'a', nama: 'Test Account', email: 'TEST@example.test', nim: '1234' };
  const request = { courseId: 'course', labId: 'lab', users: [row, { ...row, rowId: 'b' }] };
  const actor = { uid: 'admin', role: 'aslab', managedCourseIds: ['course'] };
  let account;
  let profile;
  let writes = 0;
  let activations = 0;
  const adapter = {
    async validateScope() {},
    async findAccount() { return account; },
    async readProfile() { return profile; },
    async identityInUse() { return false; },
    async reserve() { return 'firebase-generated-uid'; },
    async createAccount(uid, input) { return account = { uid, email: input.email, disabled: true }; },
    async createProfile(_uid, input) {
      if (++writes === 1) throw new Error('interrupted');
      profile = input;
    },
    async enableAccount() {
      assert.ok(profile?.provisioningActivationPending);
      if (++activations === 1) throw new Error('temporary Auth outage');
      account.disabled = false;
    },
    async completeActivation() {
      if (!profile.provisioningActivationPending) return false;
      delete profile.provisioningActivationPending;
      return true;
    },
  };
  assert.deepEqual(await provisionUsers(actor, { ...request, users: [row] }, adapter),
    [{ rowId: 'a', outcome: 'error', code: 'ACCOUNT_CREATION_DISABLED' }]);
  assert.equal(account, undefined);
  const first = await provisionUsers(actor, request, adapter, true);
  assert.deepEqual(first.map((result) => result.outcome), ['error', 'conflict']);
  assert.equal(account.disabled, true);
  const incomplete = await provisionUsers(actor, { ...request, users: [row] }, adapter, true);
  assert.deepEqual(incomplete, [{ rowId: 'a', outcome: 'error', code: 'PROVISIONING_RETRY' }]);
  assert.equal(account.disabled, true);
  assert.equal(profile.provisioningActivationPending, true);
  const retry = await provisionUsers(actor, { ...request, users: [row] }, adapter, true);
  assert.deepEqual(retry, [{ rowId: 'a', outcome: 'created', uid: 'firebase-generated-uid' }]);
  assert.equal(account.disabled, false);
  const existing = await provisionUsers(actor, { ...request, users: [row] }, adapter);
  assert.equal(existing[0].outcome, 'existing');
  assert.equal((await provisionUsers(actor, { ...request, users: [{ ...row, nim: '5678' }] }, adapter, true))[0].outcome, 'conflict');
  account.disabled = true;
  assert.equal((await provisionUsers(actor, { ...request, users: [row] }, adapter, true))[0].outcome, 'conflict');
  assert.equal(account.disabled, true);
  await assert.rejects(provisionUsers({ ...actor, managedCourseIds: [] }, request, adapter), { code: 'COURSE_FORBIDDEN' });
  await assert.rejects(provisionUsers({ ...actor, role: 'asprak' }, request, adapter, true), { code: 'FORBIDDEN' });
});

test('a course outside the actor scope is rejected before any resource lookup', async () => {
  const request = { courseId: 'outside', labId: 'unknown', users: [{ rowId: 'one' }] };
  const actor = { uid: 'admin', role: 'aslab', managedCourseIds: ['course'] };
  await assert.rejects(provisionUsers(actor, request, {
    async validateScope() { assert.fail('out-of-scope lookup'); },
  }), { code: 'COURSE_FORBIDDEN' });
});

test('scope validation distinguishes scoped state and treats foreign resources as unavailable', async () => {
  const docs = new Map();
  const store = firebaseProvisioningStore({}, {
    doc(path) {
      return { async get() {
        const value = docs.get(path);
        return { exists: Boolean(value), get: (key) => value?.[key] };
      } };
    },
  });
  const validate = () => store.validateScope('course', 'lab');
  assert.equal(await validate(), 'COURSE_NOT_FOUND');
  docs.set('courses/course', { aktif: false });
  assert.equal(await validate(), 'COURSE_INACTIVE');
  docs.set('courses/course', { aktif: true });
  assert.equal(await validate(), 'LAB_UNAVAILABLE');
  docs.set('laboratories/lab', { aktif: false, courseId: 'outside' });
  assert.equal(await validate(), 'LAB_UNAVAILABLE');
  docs.set('laboratories/lab', { aktif: false, courseId: 'course' });
  assert.equal(await validate(), 'LAB_INACTIVE');
  docs.set('laboratories/lab', { aktif: true, courseId: 'course' });
  assert.equal(await validate(), 'CLASS_UNAVAILABLE');
  docs.set('classes/lab', { praktikumId: 'outside', archived: true });
  assert.equal(await validate(), 'CLASS_UNAVAILABLE');
  docs.set('classes/lab', { praktikumId: 'course', labId: 'wrong-lab' });
  assert.equal(await validate(), 'CLASS_INVALID');
  docs.set('classes/lab', { praktikumId: 'course', labId: 'lab', archived: true });
  assert.equal(await validate(), 'CLASS_INVALID');
  docs.set('classes/lab', { praktikumId: 'course', labId: 'lab', aktif: true });
  assert.equal(await validate(), undefined);
});

test('existing accounts preserve their original UID, identity and disabled state', async () => {
  const account = { uid: 'original', email: 'student@example.test', disabled: false };
  const profile = { uid: account.uid, email: account.email, role: 'praktikan', nim: '0012' };
  const store = {
    async validateScope() {},
    async findAccount() { return account; },
    async readProfile() { return profile; },
    async identityInUse() { return false; },
    async reserve() { assert.fail('existing account must not be reserved'); },
    async enableAccount() { assert.fail('existing account must not be enabled'); },
  };
  const actor = { uid: 'admin', role: 'aslab', managedCourseIds: ['course'] };
  const row = { rowId: 'a', role: 'praktikan', email: account.email, nama: 'Test User', nim: '0012' };
  const run = (currentRow = row) => provisionUsers(actor, {
    courseId: 'course', labId: 'lab', users: [currentRow],
  }, store, true);
  assert.deepEqual(await run(), [{ rowId: 'a', outcome: 'existing', uid: 'original' }]);
  assert.deepEqual(await run({ ...row, nim: '12' }), [{ rowId: 'a', outcome: 'conflict', code: 'IDENTITY_MISMATCH' }]);
  assert.deepEqual(await run({ ...row, role: 'asprak', nip: '0012' }), [{ rowId: 'a', outcome: 'conflict', code: 'ROLE_MISMATCH' }]);
  account.disabled = true;
  assert.deepEqual(await run(), [{ rowId: 'a', outcome: 'conflict', code: 'ACCOUNT_DISABLED' }]);
  for (const missing of [undefined, '', '   ']) {
    profile.nim = missing;
    assert.deepEqual(await run(), [{ rowId: 'a', outcome: 'conflict', code: 'IDENTITY_REVIEW_REQUIRED' }]);
    assert.equal(profile.nim, missing);
    assert.equal(account.disabled, true);
  }
});

test('Firebase Auth receives a distinct random password while accounts start disabled', async () => {
  const passwords = new Set();
  const store = firebaseProvisioningStore({
    async createUser({ uid, email, displayName, disabled, password }) {
      assert.equal(disabled, true);
      assert.match(password, /^[A-Za-z0-9_-]{43}$/);
      passwords.add(password);
      return { uid, email, displayName, disabled };
    },
  }, {});
  for (const uid of ['first', 'second']) {
    const account = await store.createAccount(uid, { email: uid + '@example.test', nama: 'Fixture' });
    assert.equal(account.uid, uid);
    assert.equal('password' in account, false);
  }
  assert.equal(passwords.size, 2);
});
