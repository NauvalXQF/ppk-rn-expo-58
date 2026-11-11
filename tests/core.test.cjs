const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

// Transpile the actual core modules with the project's existing TypeScript dependency.
const cache = new Map();
function loadSource(name, overrides = {}) {
  const file = ['.ts', '.tsx'].map((ext) => path.resolve('src', name + ext)).find(fs.existsSync);
  assert.ok(file, `Missing source module: ${name}`);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const nativeRequire = createRequire(file);
  const requireSource = (id) => overrides[id] ?? (id.startsWith('@/') ? loadSource(id.slice(2), overrides) : nativeRequire(id));
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(requireSource, module, module.exports);
  return module.exports;
}

const { initialState } = loadSource('data/dummy');
const { appReducer } = loadSource('store/app-context');
const selectors = loadSource('store/selectors');
const { formatTanggal, formatJam, formatWaktuPresensi } = loadSource('utils/date');
const fresh = () => structuredClone(initialState);
const choose = (state, id) => appReducer(state, { type: 'PILIH_PENGGUNA', pengguna: state.pengguna.find((u) => u.id === id) });
const open = (state) => appReducer(choose(state, 'asisten-1'), { type: 'BUKA_SESI', sesiId: 'sesi-2' });
const attendance = { type: 'CATAT_PRESENSI', sesiId: 'sesi-2', praktikanId: 'praktikan-1', waktuPresensi: '2026-10-21T03:04:00.000Z', catatan: '  Hadir  ' };

test('seed contains the specified users, classes, sessions and attendance', () => {
  assert.equal(initialState.currentUser, null);
  assert.equal(initialState.pengguna.length, 5);
  assert.equal(initialState.praktikum.length, 1);
  assert.equal(initialState.kelas.length, 3);
  assert.equal(initialState.sesi.length, 5);
  assert.equal(initialState.presensi.length, 3);
  assert.equal(selectors.selectSesiById(initialState, 'sesi-2').status, 'dijadwalkan');
});

test('only assistants open/close sessions, in the forward direction', () => {
  let state = fresh();
  assert.equal(appReducer(state, { type: 'BUKA_SESI', sesiId: 'sesi-2' }), state);
  state = choose(state, 'praktikan-1');
  assert.equal(appReducer(state, { type: 'BUKA_SESI', sesiId: 'sesi-2' }), state);
  state = choose(state, 'asisten-1');
  assert.equal(appReducer(state, { type: 'TUTUP_SESI', sesiId: 'sesi-2' }), state);
  assert.equal(appReducer(state, { type: 'BUKA_SESI', sesiId: 'missing' }), state);
  const opened = open(state);
  assert.equal(selectors.selectSesiById(state, 'sesi-2').status, 'dijadwalkan');
  assert.equal(selectors.selectSesiById(opened, 'sesi-2').status, 'dibuka');
  assert.equal(appReducer(opened, { type: 'BUKA_SESI', sesiId: 'sesi-2' }), opened);
  const closed = appReducer(opened, { type: 'TUTUP_SESI', sesiId: 'sesi-2' });
  assert.equal(selectors.selectSesiById(closed, 'sesi-2').status, 'ditutup');
  assert.equal(appReducer(closed, { type: 'BUKA_SESI', sesiId: 'sesi-2' }), closed);
});

test('attendance validates current actor, session status, class and duplicate', () => {
  let state = choose(fresh(), 'praktikan-1');
  assert.equal(appReducer(state, attendance), state);
  state = open(state);
  assert.equal(appReducer(state, attendance), state);
  state = choose(state, 'praktikan-3');
  assert.equal(appReducer(state, { ...attendance, praktikanId: 'praktikan-3' }), state);
  state = choose(state, 'praktikan-2');
  assert.equal(appReducer(state, attendance), state);
  state = choose(state, 'praktikan-1');
  const recorded = appReducer(state, attendance);
  assert.equal(state.presensi.length, 3);
  assert.equal(recorded.presensi.length, 4);
  assert.equal(recorded.presensi.at(-1).catatan, 'Hadir');
  assert.equal(recorded.presensi.at(-1).waktuPresensi, attendance.waktuPresensi);
  assert.equal(appReducer(recorded, attendance), recorded);
  assert.equal(appReducer(state, { ...attendance, sesiId: 'missing' }), state);
  const closed = choose(appReducer(choose(recorded, 'asisten-1'), { type: 'TUTUP_SESI', sesiId: 'sesi-2' }), 'praktikan-2');
  assert.equal(appReducer(closed, { ...attendance, praktikanId: 'praktikan-2' }), closed);
});

test('optional time uses fallback, whitespace note becomes undefined', () => {
  const state = choose(open(fresh()), 'praktikan-1');
  const before = Date.now();
  const result = appReducer(state, { ...attendance, waktuPresensi: undefined, catatan: '  ' });
  const record = result.presensi.at(-1);
  assert.equal(record.catatan, undefined);
  assert.ok(Date.parse(record.waktuPresensi) >= before);
  assert.ok(Date.parse(record.waktuPresensi) <= Date.now());
});

test('user selection uses registered identity, switching preserves data, reset restores seed', () => {
  const state = appReducer(choose(open(fresh()), 'praktikan-1'), attendance);
  const loggedOut = appReducer(state, { type: 'KELUAR' });
  assert.equal(loggedOut.currentUser, null);
  assert.equal(loggedOut.sesi, state.sesi);
  assert.equal(loggedOut.presensi, state.presensi);
  assert.equal(choose(loggedOut, 'asisten-1').presensi.length, 4);
  assert.equal(appReducer(state, { type: 'PILIH_PENGGUNA', pengguna: { id: 'missing', peran: 'asisten' } }), state);
  assert.equal(appReducer(state, { type: 'PILIH_PENGGUNA', pengguna: { ...state.currentUser, nama: 'Forged' } }).currentUser.nama, 'Budi Santoso');
  assert.deepEqual(appReducer(state, { type: 'RESET_DATA' }), initialState);
});

test('selectors filter classes, handle missing ids and empty class C', () => {
  const state = fresh();
  assert.deepEqual(selectors.selectSesiUntukPengguna(state), []);
  assert.equal(selectors.selectCurrentUser(state), null);
  assert.equal(selectors.selectSesiUntukPengguna(choose(state, 'asisten-1')).length, 5);
  assert.equal(selectors.selectSesiUntukPengguna(choose(state, 'praktikan-1')).length, 3);
  assert.deepEqual(selectors.selectSesiUntukPengguna(choose(state, 'praktikan-4')), []);
  assert.deepEqual(selectors.selectRiwayatPraktikan(state, 'praktikan-4'), []);
  assert.deepEqual(selectors.selectRiwayatPraktikan(state, 'missing'), []);
  assert.deepEqual(selectors.selectRiwayatPraktikan(state, 'asisten-1'), []);
  assert.equal(selectors.selectDetailSesi(state, 'missing'), null);
  assert.equal(selectors.selectSesiById(state, 'missing'), null);
  assert.deepEqual(selectors.selectRekapSesi(state, 'missing'), { baris: [], jumlahHadir: 0, totalPraktikan: 0 });
});

test('sorting is by status, then ascending active dates and descending closed dates without mutation', () => {
  const state = open(fresh());
  const original = structuredClone(state);
  assert.deepEqual(selectors.selectSesiUntukPengguna(state).map((s) => s.id), ['sesi-2', 'sesi-3', 'sesi-5', 'sesi-4', 'sesi-1']);
  selectors.selectRekapSesi(state, 'sesi-1');
  selectors.selectRiwayatPraktikan(state, 'praktikan-1');
  assert.deepEqual(state, original);
});

test('detail joins and attendance totals agree after recording and switching user', () => {
  const state = appReducer(choose(open(fresh()), 'praktikan-1'), attendance);
  const detail = selectors.selectDetailSesi(state, 'sesi-2');
  assert.equal(detail.praktikum.kode, 'PPK');
  assert.equal(detail.kelas.nama, 'PPK A');
  assert.equal(detail.asisten.nama, 'Nauval');
  assert.equal(detail.presensiSaya.praktikanId, 'praktikan-1');
  assert.equal(detail.rekap.jumlahHadir, 1);
  assert.equal(detail.rekap.totalPraktikan, 2);
  assert.equal(selectors.selectJumlahHadir(state, 'sesi-2'), 1);
  assert.equal(selectors.selectTotalPraktikan(state, 'kelas-a'), 2);
  assert.equal(selectors.selectSudahPresensi(state, 'sesi-2', 'praktikan-1'), true);
  assert.equal(selectors.selectDetailSesi(choose(state, 'asisten-1'), 'sesi-2').presensiSaya, null);
  assert.deepEqual(selectors.selectRekapSesi(state, 'sesi-1').baris.map((r) => r.praktikan.id), ['praktikan-1', 'praktikan-2']);
});

test('history derives all four attendance states', () => {
  let state = fresh();
  const status = () => Object.fromEntries(selectors.selectRiwayatPraktikan(state, 'praktikan-1').map((r) => [r.sesi.id, r.status]));
  assert.equal(status()['sesi-1'], 'hadir');
  assert.equal(status()['sesi-2'], 'belum-berlangsung');
  state = open(state);
  assert.equal(status()['sesi-2'], 'belum-presensi');
  state = appReducer(state, { type: 'TUTUP_SESI', sesiId: 'sesi-2' });
  assert.equal(status()['sesi-2'], 'tidak-hadir');
});

test('date helpers format Indonesian dates and local time', () => {
  assert.match(formatTanggal('2026-10-21'), /21 Oktober 2026/);
  assert.equal(formatJam('10:04'), '10.04');
  assert.equal(formatWaktuPresensi(new Date(2026, 9, 21, 10, 4).toISOString()), '10.04');
});

test('Sprint 2 CRUD and Firestore sync actions enforce asisten role and update state', () => {
  const { toStatusSesi, toFirestoreStatus, buildClassMemberId } = loadSource('services/practicumService');
  assert.equal(buildClassMemberId('kelas-a', 'uid123'), 'kelas-a_uid123');
  assert.equal(toStatusSesi('open'), 'dibuka');
  assert.equal(toStatusSesi('closed'), 'ditutup');
  assert.equal(toStatusSesi('closed', null, null), 'dijadwalkan');
  assert.equal(toStatusSesi('open', '2026-11-11T10:00:00Z', null), 'dibuka');
  assert.equal(toStatusSesi('closed', '2026-11-11T10:00:00Z', '2026-11-11T12:00:00Z'), 'ditutup');
  assert.equal(toStatusSesi('scheduled'), 'dijadwalkan');
  assert.equal(toFirestoreStatus('dibuka'), 'open');
  assert.equal(toFirestoreStatus('ditutup'), 'closed');
  assert.equal(toFirestoreStatus('dijadwalkan'), 'scheduled');

  // Praktikan cannot perform CRUD
  let state = choose(fresh(), 'praktikan-1');
  assert.equal(appReducer(state, { type: 'TAMBAH_KELAS', kelas: { id: 'kelas-d', nama: 'PPK D', praktikumId: 'praktikum-ppk' } }), state);

  // Asisten can perform CRUD on kelas, peserta, jadwal, sesi
  state = choose(fresh(), 'asisten-1');
  state = appReducer(state, { type: 'TAMBAH_KELAS', kelas: { id: 'kelas-d', nama: 'PPK D', praktikumId: 'praktikum-ppk' } });
  assert.equal(state.kelas.length, 4);
  state = appReducer(state, { type: 'UBAH_KELAS', kelas: { id: 'kelas-d', nama: 'PPK D Baru', praktikumId: 'praktikum-ppk' } });
  assert.equal(state.kelas.find((k) => k.id === 'kelas-d').nama, 'PPK D Baru');
  state = appReducer(state, { type: 'HAPUS_KELAS', kelasId: 'kelas-d' });
  assert.equal(state.kelas.length, 3);

  state = appReducer(state, { type: 'TAMBAH_PESERTA', peserta: { id: 'praktikan-5', peran: 'praktikan', nama: 'Andi', nim: '2310511005', kelasId: 'kelas-a' } });
  assert.equal(selectors.selectTotalPraktikan(state, 'kelas-a'), 3);
  state = appReducer(state, { type: 'HAPUS_PESERTA', praktikanId: 'praktikan-5' });
  assert.equal(selectors.selectTotalPraktikan(state, 'kelas-a'), 2);
});
