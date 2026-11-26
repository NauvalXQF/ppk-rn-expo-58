import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { docId } from './provisioning.ts';
import { HttpError } from './middleware/errorHandler.ts';

function timestamp(value: unknown): number {
  if (typeof value === 'string') return Date.parse(value);
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return Number(value.toMillis());
  }
  return NaN;
}

export function approvedLeaveExists(tx: Transaction, db: Firestore, sessionId: string, uid: string) {
  return tx.get(db.collection('leaveRequests').where('sessionId', '==', sessionId)
    .where('uid', '==', uid).where('status', '==', 'approved').limit(1)).then((result) => !result.empty);
}

export async function readFineEvidence(tx: Transaction, db: Firestore, fineId: string, uid: string, noticeOnly = false) {
  const ref = db.doc('fines/' + fineId);
  const fineSnap = await tx.get(ref);
  const fine = fineSnap.data();
  if (!fine || fine.uid !== uid) throw new HttpError('NOT_FOUND');
  if (!docId(fine.sessionId) || fineId !== fine.sessionId + '_' + uid || fine.id !== fineId) {
    throw new HttpError('PAYMENT_CONFLICT');
  }
  const sessionRef = db.doc('sessions/' + fine.sessionId);
  const attendanceRef = sessionRef.collection('attendances').doc(uid);
  const [sessionSnap, attendanceSnap] = await tx.getAll(sessionRef, attendanceRef);
  const session = sessionSnap.data();
  const attendance = attendanceSnap.data();
  if (!session || !attendance || !attendanceSnap.createTime || !docId(session.classId)) {
    throw new HttpError('PAYMENT_CONFLICT');
  }
  const expectedFee = session.lateFineAmount ?? 10000;
  const rawGrace = session.gracePeriodMinutes;
  const grace = typeof rawGrace === 'number' && rawGrace >= 0 && rawGrace <= 120 ? Math.floor(rawGrace) : 15;
  const scheduled = Date.parse(session.tanggal + 'T' + session.jamMulai + ':00+07:00');
  const opened = timestamp(session.openedAt);
  const deadline = (Number.isFinite(scheduled) ? Math.max(scheduled, opened) : opened) + grace * 60_000;
  const recorded = attendanceSnap.createTime.toMillis();
  const courseId = session.courseId || session.praktikumId || 'praktikum-ppk';
  if (fine.attendanceId !== attendanceRef.path || attendance.uid !== uid || attendance.sessionId !== fine.sessionId
    || attendance.classId !== session.classId || attendance.status !== 'hadir' || attendance.lateStatus !== 'late'
    || attendance.fineId !== fineId || !Number.isFinite(deadline) || recorded <= deadline
    || !Number.isSafeInteger(fine.lateMinutes) || fine.lateMinutes < 1 || attendance.lateMinutes !== fine.lateMinutes
    || fine.courseId !== courseId || fine.labId !== (session.labId || session.classId)
    || !fineSnap.createTime
    || !Number.isSafeInteger(fine.amount) || fine.amount <= 0 || fine.amount !== expectedFee) {
    throw new HttpError('PAYMENT_CONFLICT');
  }
  if (!noticeOnly && await approvedLeaveExists(tx, db, fine.sessionId, uid)) throw new HttpError('PAYMENT_CONFLICT');
  return { ref, fine, createdAt: new Date(fineSnap.createTime.toMillis()).toISOString() };
}
