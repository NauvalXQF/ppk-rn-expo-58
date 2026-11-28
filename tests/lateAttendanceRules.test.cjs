const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectFirestoreEmulator, doc, getDocFromServer, getFirestore, runTransaction,
  serverTimestamp, setDoc, terminate, updateDoc, writeBatch,
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

test('scoped Firestore writes against the local emulator', {
  skip: !port && 'Set PPK_RULES_EMULATOR_PORT to a loopback emulator running firestore.rules',
}, async (t) => {
  const namespace = randomUUID();
  function client(token) {
    const app = initializeApp({ projectId: 'demo-ppk-rules' }, randomUUID());
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', port, { mockUserToken: token });
    t.after(async () => { await terminate(db); await deleteApp(app); });
    return db;
  }
  const aslabUid = namespace + '-aslab';
  const asprakUid = namespace + '-asprak';
  const studentUid = namespace + '-student';
  const otherUid = namespace + '-other';
  const admin = client('owner');
  const aslab = client({ sub: aslabUid });
  const asprak = client({ sub: asprakUid });
  const student = client({ sub: studentUid });
  const other = client({ sub: otherUid });
  const courseId = namespace + '-course-a';
  const foreignCourse = namespace + '-course-b';
  const classId = namespace + '-lab-a';
  const foreignClass = namespace + '-lab-b';
  const scheduleId = namespace + '-schedule';
  const lab = { nama: 'Lab', courseId, latitude: -7.95, longitude: 112.61, radiusMeters: 30, aktif: true };
  const kelas = { nama: 'Kelas', praktikumId: courseId, labId: classId, aktif: true };
  const waktu = { jamMulai: '08:00', jamSelesai: '10:00' };
  const schedule = { classId, praktikumId: courseId, hari: 'Senin', ruang: 'Lab', topik: 'Topik', ...waktu };
  const timestamps = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const session = {
    classId, labId: classId, courseId, praktikumId: courseId, scheduleId, status: 'closed',
    openedAt: null, closedAt: null, archived: false, topik: 'Topik', ruang: 'Lab', ...waktu,
    tanggal: '2026-11-28', startAt: '2026-11-28T08:00:00', endAt: '2026-11-28T10:00:00',
  };
  const sessionPath = (key) => 'sessions/' + namespace + '-' + key;
  const assignmentId = classId + '_' + asprakUid;
  const assignment = { uid: asprakUid, labId: classId, courseId, active: true };
  const denied = (work) => assert.rejects(work, { code: 'permission-denied' });
  const batch = writeBatch(admin);
  for (const [path, data] of Object.entries({
    ['users/' + aslabUid]: { role: 'aslab', managedCourseIds: [courseId] },
    ['users/' + asprakUid]: { role: 'asprak' },
    ['users/' + studentUid]: { role: 'praktikan' },
    ['users/' + otherUid]: { role: 'praktikan' },
    ['courses/' + courseId]: { aktif: true },
    ['courses/' + foreignCourse]: { aktif: true },
    ['laboratories/' + foreignClass]: { ...lab, courseId: foreignCourse },
    ['classes/' + foreignClass]: { ...kelas, praktikumId: foreignCourse, labId: foreignClass },
    ['laboratories/' + namespace + '-legacy']: { ...lab, courseId: null },
    ['classMembers/' + classId + '_' + studentUid]: { classId, uid: studentUid, active: true },
  })) {
    batch.set(doc(admin, path), data);
  }
  await batch.commit();

  await t.test('bulk lab and class creation is atomic with immutable course scope', async () => {
    const bulk = writeBatch(aslab);
    bulk.set(doc(aslab, 'laboratories', classId), { ...lab, ...timestamps() });
    bulk.set(doc(aslab, 'classes', classId), { ...kelas, id: classId, ...timestamps() });
    await bulk.commit();
    await updateDoc(doc(aslab, 'laboratories', classId), { nama: 'Lab baru' });
    await updateDoc(doc(aslab, 'classes', classId), { archived: false });
    await denied(updateDoc(doc(aslab, 'laboratories', foreignClass), { nama: 'Tidak boleh' }));
    await denied(updateDoc(doc(aslab, 'laboratories', foreignClass), { courseId }));
    await denied(updateDoc(doc(aslab, 'laboratories', classId), { courseId: foreignCourse }));
    await denied(updateDoc(doc(aslab, 'classes', foreignClass), { praktikumId: courseId }));
    await denied(updateDoc(doc(aslab, 'classes', classId), { praktikumId: foreignCourse }));
    await denied(updateDoc(doc(aslab, 'classes', classId), { unexpected: true }));
    const unscopedLab = { ...lab };
    delete unscopedLab.courseId;
    await denied(setDoc(doc(aslab, 'laboratories', namespace + '-unscoped'), unscopedLab));
    await denied(setDoc(doc(aslab, 'classes', namespace + '-unscoped'), { nama: 'Unscoped' }));
    await denied(setDoc(doc(aslab, 'classes', namespace + '-foreign-link'), { ...kelas, labId: foreignClass }));
    const foreignLabWithoutClass = namespace + '-other-foreign-lab';
    await setDoc(doc(admin, 'laboratories', foreignLabWithoutClass), { ...lab, courseId: foreignCourse });
    await denied(setDoc(doc(aslab, 'classes', foreignLabWithoutClass), { nama: 'Kelas', praktikumId: courseId }));
    await denied(updateDoc(doc(aslab, 'laboratories', namespace + '-legacy'), { courseId }));
    // Existing catalog reads are intentionally available to signed-in users.
    assert.equal((await getDocFromServer(doc(aslab, 'laboratories', foreignClass))).exists(), true);
    await denied(updateDoc(doc(student, 'classes', classId), { nama: 'Tidak boleh' }));
  });

  await t.test('assignments use matching lab, class, course and deterministic ID', async () => {
    await setDoc(doc(aslab, 'labAssignments', assignmentId), assignment);
    await updateDoc(doc(aslab, 'labAssignments', assignmentId), { active: false });
    await updateDoc(doc(aslab, 'labAssignments', assignmentId), { active: true });
    await denied(updateDoc(doc(aslab, 'labAssignments', assignmentId), { courseId: foreignCourse }));
    await denied(updateDoc(doc(aslab, 'labAssignments', assignmentId), { classId: foreignClass }));
    await denied(setDoc(doc(aslab, 'labAssignments', foreignClass + '_' + asprakUid), { ...assignment, labId: foreignClass }));
    await denied(setDoc(doc(aslab, 'labAssignments', classId + '_' + otherUid), { labId: classId, uid: otherUid, active: true }));
    await denied(updateDoc(doc(asprak, 'labAssignments', assignmentId), { active: false }));
  });

  await t.test('schedules require known fields and ordered HH:mm times', async () => {
    await setDoc(doc(asprak, 'schedules', scheduleId), {
      ...schedule, startAt: '08:00', endAt: '10:00', ...timestamps(),
    });
    await updateDoc(doc(aslab, 'schedules', scheduleId), { topik: 'Topik baru', updatedAt: serverTimestamp() });
    for (const patch of [
      { jamMulai: '8:00' }, { jamMulai: '10:00' }, { jamMulai: '11:00' },
      { startAt: '09:00' }, { extra: true }, { classId: foreignClass }, { labId: foreignClass },
    ]) {
      await denied(updateDoc(doc(aslab, 'schedules', scheduleId), patch));
    }
    await denied(setDoc(doc(student, 'schedules', scheduleId + '-student'), schedule));
  });

  await t.test('session creation requires an active class, matching references and server timestamps', async () => {
    await setDoc(doc(asprak, sessionPath('scheduled')), { ...session, ...timestamps() });
    await setDoc(doc(aslab, sessionPath('aslab')), { ...session, ...timestamps() });
    const forged = new Date('2020-01-01T00:00:00Z');
    for (const patch of [
      { classId: 'missing' }, { classId: foreignClass }, { scheduleId: 'missing' }, { labId: foreignClass },
      { courseId: foreignCourse }, { createdAt: forged }, { updatedAt: forged }, { jamSelesai: '07:30' },
      { tanggal: '28-11-2026' }, { startAt: '2026-11-28T06:00:00' }, { endAt: null },
    ]) {
      await denied(setDoc(doc(aslab, sessionPath('unavailable')), { ...session, ...timestamps(), ...patch }));
    }
    await denied(setDoc(doc(student, sessionPath('student')), { ...session, ...timestamps() }));
    const standaloneClassId = namespace + '-standalone';
    const standaloneScheduleId = scheduleId + '-standalone';
    const secondLabId = namespace + '-second-lab';
    await setDoc(doc(aslab, 'classes', standaloneClassId), { nama: 'Kelas', praktikumId: courseId });
    await setDoc(doc(aslab, 'laboratories', secondLabId), lab);
    await setDoc(doc(aslab, 'schedules', standaloneScheduleId), {
      ...schedule, classId: standaloneClassId, labId: classId,
    });
    const standalone = { ...session, classId: standaloneClassId, scheduleId: standaloneScheduleId };
    await denied(setDoc(doc(aslab, sessionPath('different-lab')), { ...standalone, labId: secondLabId, ...timestamps() }));
    await setDoc(doc(aslab, sessionPath('matching-lab')), { ...standalone, ...timestamps() });
    await denied(updateDoc(doc(aslab, sessionPath('matching-lab')), { labId: secondLabId, updatedAt: serverTimestamp() }));
  });

  await t.test('only authorized Aslab or Asprak can archive unopened or closed sessions', async () => {
    const archive = { archived: true, updatedAt: serverTimestamp() };
    const openedAt = new Date(Date.now() - 60_000);
    await setDoc(doc(admin, sessionPath('open')), { ...session, status: 'open', openedAt });
    await setDoc(doc(admin, sessionPath('completed')), { ...session, openedAt, closedAt: new Date() });
    await setDoc(doc(admin, sessionPath('legacy-scheduled')), { ...session, status: 'scheduled' });
    await setDoc(doc(admin, sessionPath('foreign')), {
      ...session, classId: foreignClass, courseId: foreignCourse, praktikumId: foreignCourse, labId: foreignClass,
    });
    await denied(updateDoc(doc(aslab, sessionPath('foreign')), archive));
    await denied(updateDoc(doc(asprak, sessionPath('foreign')), archive));
    await denied(updateDoc(doc(asprak, sessionPath('open')), archive));
    await denied(updateDoc(doc(student, sessionPath('scheduled')), archive));
    await denied(updateDoc(doc(asprak, sessionPath('scheduled')), { ...archive, topik: 'Tidak boleh' }));
    await updateDoc(doc(asprak, sessionPath('scheduled')), archive);
    await updateDoc(doc(aslab, sessionPath('completed')), archive);
    await updateDoc(doc(aslab, sessionPath('legacy-scheduled')), archive);
    const archived = (await getDocFromServer(doc(asprak, sessionPath('scheduled')))).data();
    assert.equal(archived.archived, true);
    assert.equal(archived.status, 'closed');
    assert.equal(archived.openedAt, null);
  });

  await t.test('leave review and AI updates enforce role, reviewer, timestamp and decision isolation', async () => {
    const leaveSession = namespace + '-aslab';
    const requestPath = 'leaveRequests/' + leaveSession + '_' + studentUid;
    await setDoc(doc(student, requestPath), {
      uid: studentUid, sessionId: leaveSession, classId, alasan: 'Sakit',
      status: 'pending', reviewedBy: null, reviewedAt: null, ...timestamps(),
    });
    const decision = { status: 'approved', reviewedBy: asprakUid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const forged = new Date('2020-01-01T00:00:00Z');
    for (const patch of [{ reviewedBy: aslabUid }, { reviewedAt: forged }, { updatedAt: forged }]) {
      await denied(updateDoc(doc(asprak, requestPath), { ...decision, ...patch }));
    }
    const ai = { ai: { label: 'sakit' }, updatedAt: serverTimestamp() };
    await denied(updateDoc(doc(student, requestPath), { ...ai, updatedAt: forged }));
    await denied(updateDoc(doc(student, requestPath), { ...ai, status: 'approved' }));
    await denied(updateDoc(doc(other, requestPath), ai));
    await updateDoc(doc(student, requestPath), ai);
    await updateDoc(doc(asprak, requestPath), decision);
    assert.equal((await getDocFromServer(doc(student, requestPath))).data().status, 'approved');
    await denied(updateDoc(doc(student, requestPath), ai));
    await denied(updateDoc(doc(asprak, requestPath), { ...decision, status: 'rejected' }));
    const rejectedPath = requestPath + '-second';
    await setDoc(doc(admin, rejectedPath), { uid: studentUid, sessionId: leaveSession, classId, alasan: 'Sakit', status: 'pending' });
    await updateDoc(doc(asprak, rejectedPath), { ...decision, status: 'rejected' });
  });

  await t.test('attendance notes accept up to 120 characters and payments stay server-only', async () => {
    const id = namespace + '-open';
    const path = sessionPath('open') + '/attendances/' + studentUid;
    const attendance = {
      uid: studentUid, sessionId: id, classId, status: 'hadir', recordedAt: serverTimestamp(),
      latitude: -7.95, longitude: 112.61, distanceMeters: 5, geofenceStatus: 'in_radius',
      lateStatus: 'on_time', lateMinutes: 0, fineId: null,
    };
    await updateDoc(doc(admin, sessionPath('open')), { openedAt: new Date(Date.now() - 5_000) });
    await denied(setDoc(doc(student, path), { ...attendance, catatan: 'a'.repeat(121) }));
    await denied(setDoc(doc(student, path), { ...attendance, catatan: 121 }));
    await setDoc(doc(student, path), { ...attendance, catatan: 'a'.repeat(120) });
    const payment = 'payments/' + id;
    await setDoc(doc(admin, payment), { uid: studentUid, status: 'pending' });
    assert.equal((await getDocFromServer(doc(student, payment))).data().status, 'pending');
    await denied(getDocFromServer(doc(other, payment)));
    await denied(updateDoc(doc(student, payment), { status: 'success' }));
    await denied(updateDoc(doc(aslab, payment), { status: 'success' }));
  });
});
