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
    async validLab() { return true; },
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
    async completeActivation() { delete profile.provisioningActivationPending; },
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
  await assert.rejects(provisionUsers({ ...actor, managedCourseIds: [] }, request, adapter), { code: 'FORBIDDEN' });
  await assert.rejects(provisionUsers({ ...actor, role: 'asprak' }, request, adapter, true), { code: 'FORBIDDEN' });
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
