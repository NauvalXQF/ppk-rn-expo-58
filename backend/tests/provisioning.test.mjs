import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provisionUsers } from '../src/provisioning.ts';

test('uses Auth UID, reports conflicting rows and resumes a partial creation', async () => {
  const row = { role: 'praktikan', rowId: 'a', nama: 'Test Account', email: 'TEST@example.test', nim: '1234' };
  const request = { courseId: 'course', labId: 'lab', users: [row, { ...row, rowId: 'b' }] };
  const actor = { uid: 'admin', role: 'aslab', managedCourseIds: ['course'] };
  let account;
  let profile;
  let writes = 0;
  const adapter = {
    async validLab() { return true; },
    async findAccount() { return account; },
    async readProfile() { return profile; },
    async identityInUse() { return false; },
    async reserve() { return 'firebase-generated-uid'; },
    async createAccount(uid, input) { return account = { uid, email: input.email }; },
    async createProfile(_uid, input) {
      if (++writes === 1) throw new Error('interrupted');
      profile = input;
    },
  };
  const first = await provisionUsers(actor, request, adapter, true);
  assert.deepEqual(first.map((result) => result.outcome), ['error', 'conflict']);
  const retry = await provisionUsers(actor, { ...request, users: [row] }, adapter, true);
  assert.equal(retry[0].uid, 'firebase-generated-uid');
  const existing = await provisionUsers(actor, { ...request, users: [row] }, adapter);
  assert.equal(existing[0].outcome, 'existing');
  await assert.rejects(provisionUsers({ ...actor, managedCourseIds: [] }, request, adapter), { code: 'FORBIDDEN' });
});
