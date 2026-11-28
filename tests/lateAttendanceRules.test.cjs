const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectFirestoreEmulator, doc, getDocFromServer, getFirestore, runTransaction,
  serverTimestamp, setDoc, terminate, writeBatch,
} = require('firebase/firestore');

const port = Number(process.env.PPK_RULES_EMULATOR_PORT);

test('late attendance Firestore rules against the local emulator', {
  skip: !port && 'Set PPK_RULES_EMULATOR_PORT to a loopback emulator running firestore.rules',
}, async (t) => {
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const projectId = 'demo-ppk-rules';
  const sessionId = 'session-' + randomUUID();
  const uid = 'student-a';
  const classId = sessionId + '-lab';
  const sessionPath = 'sessions/' + sessionId;
  const attendancePath = (id) => sessionPath + '/attendances/' + id;
  const finePath = (id) => 'fines/' + sessionId + '_' + id;
  const clients = [];

  function client(token) {
    const app = initializeApp({ projectId }, randomUUID());
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', port, token ? { mockUserToken: token } : undefined);
    clients.push({ app, db });
    return db;
  }

  const admin = client('owner');
  const student = client({ sub: uid });
  const other = client({ sub: 'student-b' });
  const nonMember = client({ sub: 'student-c' });
  const directWriter = client({ sub: 'student-d' });
  const linkedWriter = client({ sub: 'student-e' });
  const wibStudent = client({ sub: 'student-f' });
  const assistant = client({ sub: 'assistant' });
  const anonymous = client();
  t.after(() => Promise.all(clients.map(async ({ app, db }) => {
    await terminate(db);
    await deleteApp(app);
  })));

  const session = {
    classId, labId: classId, courseId: 'course-test', status: 'open', radiusMeters: 30,
    tanggal: '2020-01-01', jamMulai: '07:00', openedAt: new Date('2020-01-01T00:00:00Z'),
    gracePeriodMinutes: 15, lateFineAmount: 10000,
  };
  const batch = writeBatch(admin);
  batch.set(doc(admin, sessionPath), session);
  for (const id of [uid, 'student-b', 'student-c', 'student-d', 'student-e', 'student-f']) {
    batch.set(doc(admin, 'users/' + id), { uid: id, role: 'praktikan' });
  }
  for (const id of [uid, 'student-b', 'student-d', 'student-e', 'student-f']) {
    batch.set(doc(admin, 'classMembers/' + classId + '_' + id), { uid: id, classId, active: true });
  }
  batch.set(doc(admin, 'users/assistant'), { uid: 'assistant', role: 'asprak' });
  batch.set(doc(admin, 'labAssignments/' + classId + '_assistant'), { active: true });
  await batch.commit();

  const attendance = (id, late, distance = 14) => ({
    uid: id, sessionId, classId, status: 'hadir', recordedAt: serverTimestamp(),
    latitude: -7.95, longitude: 112.61, accuracy: 3, distanceMeters: distance, geofenceStatus: 'in_radius',
    lateStatus: late ? 'late' : 'on_time', lateMinutes: late ? 1 : 0,
    fineId: late ? sessionId + '_' + id : null,
  });
  const fine = (id, amount = 10000) => ({
    id: sessionId + '_' + id, uid: id, sessionId, attendanceId: attendancePath(id),
    amount, status: 'unpaid', labId: classId, courseId: session.courseId, lateMinutes: 1,
  });
  async function submit(db, id, late) {
    return runTransaction(db, async (tx) => {
      const session = await tx.get(doc(db, sessionPath));
      const previous = await tx.get(doc(db, attendancePath(id)));
      const previousFine = await tx.get(doc(db, finePath(id)));
      assert.equal(session.data().status, 'open');
      if (previous.exists()) throw new Error('duplicate attendance');
      tx.set(doc(db, attendancePath(id)), attendance(id, late));
      if (late && !previousFine.exists()) tx.set(doc(db, finePath(id)), fine(id));
    });
  }

  await t.test('the owner can read the missing fine after reading the session and attendance', async () => {
    assert.equal((await getDocFromServer(doc(student, sessionPath))).exists(), true);
    assert.equal((await getDocFromServer(doc(student, attendancePath(uid)))).exists(), false);
    assert.equal((await getDocFromServer(doc(student, finePath(uid)))).exists(), false);
    await assert.rejects(getDocFromServer(doc(other, finePath(uid))), { code: 'permission-denied' });
    await assert.rejects(getDocFromServer(doc(assistant, finePath(uid))), { code: 'permission-denied' });
    await assert.rejects(getDocFromServer(doc(anonymous, finePath(uid))), { code: 'permission-denied' });
  });

  await t.test('fine for the wrong amount rolls back the attendance write', async () => {
    const invalid = writeBatch(student);
    invalid.set(doc(student, attendancePath(uid)), attendance(uid, true));
    invalid.set(doc(student, finePath(uid)), fine(uid, 1));
    await assert.rejects(invalid.commit(), { code: 'permission-denied' });
    assert.equal((await getDocFromServer(doc(admin, attendancePath(uid)))).exists(), false);
    assert.equal((await getDocFromServer(doc(admin, finePath(uid)))).exists(), false);
  });

  await t.test('a fine cannot be created without attendance evidence', async () => {
    await assert.rejects(setDoc(doc(student, finePath(uid)), fine(uid)), { code: 'permission-denied' });
    assert.equal((await getDocFromServer(doc(admin, finePath(uid)))).exists(), false);
  });

  await t.test('a valid atomic attendance and fine write passes independently of the existence read', async () => {
    const id = 'student-d';
    const writes = writeBatch(directWriter);
    writes.set(doc(directWriter, attendancePath(id)), attendance(id, true));
    writes.set(doc(directWriter, finePath(id)), fine(id));
    await writes.commit();
    assert.equal((await getDocFromServer(doc(directWriter, finePath(id)))).data().amount, 10000);
  });

  await t.test('late attendance and correct fine commit once, while clock-manipulated on_time is denied and valid on_time writes no fine', async () => {
    await submit(student, uid, true);
    assert.equal((await getDocFromServer(doc(student, attendancePath(uid)))).data().lateStatus, 'late');
    assert.equal((await getDocFromServer(doc(student, finePath(uid)))).data().amount, 10000);
    await assert.rejects(submit(student, uid, true), /duplicate attendance/);
    await assert.rejects(setDoc(doc(student, finePath(uid)), fine(uid, 10000)), { code: 'permission-denied' });
    // Manipulasi jam perangkat: mengirim on_time saat server sudah melewati batas toleransi wajib ditolak.
    await assert.rejects(submit(other, 'student-b', false), { code: 'permission-denied' });
    assert.equal((await getDocFromServer(doc(admin, attendancePath('student-b')))).exists(), false);
    // Saat sesi masih dalam masa toleransi server, on_time diterima tanpa menerbitkan denda.
    await setDoc(doc(admin, sessionPath), { ...session, openedAt: new Date(Date.now() - 60_000) });
    await submit(other, 'student-b', false);
    assert.equal((await getDocFromServer(doc(other, attendancePath('student-b')))).data().lateStatus, 'on_time');
    assert.equal((await getDocFromServer(doc(admin, finePath('student-b')))).exists(), false);
    await setDoc(doc(admin, sessionPath), session);
    await assert.rejects(getDocFromServer(doc(other, finePath(uid))), { code: 'permission-denied' });
    await assert.rejects(setDoc(doc(other, finePath(uid)), fine(uid)), { code: 'permission-denied' });
  });

  await t.test('on-time attendance cannot produce a fine', async () => {
    const id = 'student-b';
    await assert.rejects(setDoc(doc(other, finePath(id)), fine(id)), { code: 'permission-denied' });
  });

  await t.test('a fine cannot cite another student’s attendance', async () => {
    const id = 'student-e';
    const writes = writeBatch(linkedWriter);
    writes.set(doc(linkedWriter, attendancePath(id)), attendance(id, true));
    writes.set(doc(linkedWriter, finePath(id)), {
      ...fine(id), attendanceId: attendancePath(uid),
    });
    await assert.rejects(writes.commit(), { code: 'permission-denied' });
    assert.equal((await getDocFromServer(doc(admin, attendancePath(id)))).exists(), false);
    assert.equal((await getDocFromServer(doc(admin, finePath(id)))).exists(), false);
  });

  await t.test('the server clock rejects a late label within either grace window', async () => {
    const id = 'student-c';
    await setDoc(doc(admin, 'classMembers/' + classId + '_' + id), { uid: id, classId, active: true });
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60_000).toISOString();
    for (const override of [
      { openedAt: new Date(now.getTime() - 60_000) },
      { tanggal: wib.slice(0, 10), jamMulai: wib.slice(11, 16) },
    ]) {
      await setDoc(doc(admin, sessionPath), { ...session, ...override });
      const writes = writeBatch(nonMember);
      writes.set(doc(nonMember, attendancePath(id)), attendance(id, true));
      writes.set(doc(nonMember, finePath(id)), fine(id));
      await assert.rejects(writes.commit(), { code: 'permission-denied' });
      assert.equal((await getDocFromServer(doc(admin, attendancePath(id)))).exists(), false);
      assert.equal((await getDocFromServer(doc(admin, finePath(id)))).exists(), false);
    }
  });

  await t.test('outside radius, no membership, wrong role and closed session are denied', async () => {
    await setDoc(doc(admin, sessionPath), session);
    // Use a fresh class membership for the nonmember check.
    await setDoc(doc(admin, 'classMembers/' + classId + '_student-c'), { active: false }, { merge: true });
    await assert.rejects(setDoc(doc(nonMember, attendancePath('student-c')), attendance('student-c', true)), { code: 'permission-denied' });
    await assert.rejects(setDoc(doc(assistant, attendancePath('assistant')), attendance('assistant', true)), { code: 'permission-denied' });
    await setDoc(doc(admin, 'classMembers/' + classId + '_student-c'), { uid: 'student-c', classId, active: true });
    await assert.rejects(setDoc(doc(nonMember, attendancePath('student-c')), attendance('student-c', true, 31)), { code: 'permission-denied' });
    await setDoc(doc(admin, sessionPath), { status: 'closed' }, { merge: true });
    await assert.rejects(setDoc(doc(nonMember, attendancePath('student-c')), attendance('student-c', true)), { code: 'permission-denied' });
  });

  await t.test('assigned Asprak can waive and the privileged backend can settle', async () => {
    const waived = doc(assistant, finePath('student-d'));
    assert.equal((await getDocFromServer(waived)).data().status, 'unpaid');
    await setDoc(waived, { status: 'waived', updatedAt: serverTimestamp() }, { merge: true });
    assert.equal((await getDocFromServer(waived)).data().status, 'waived');
    await setDoc(doc(admin, finePath(uid)), { status: 'paid', paidAt: serverTimestamp() }, { merge: true });
    assert.equal((await getDocFromServer(doc(student, finePath(uid)))).data().status, 'paid');
  });

  await t.test('the scheduled time uses WIB when settling eligibility', async () => {
    const now = Date.now();
    const wibStart = new Date(now + (7 * 60 - 30) * 60_000).toISOString();
    await setDoc(doc(admin, sessionPath), {
      ...session, tanggal: wibStart.slice(0, 10), jamMulai: wibStart.slice(11, 16),
      openedAt: new Date(now - 30 * 60_000),
    });
    await submit(wibStudent, 'student-f', true);
    assert.equal((await getDocFromServer(doc(wibStudent, finePath('student-f')))).data().amount, 10000);
  });
});
