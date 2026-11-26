import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';

export type PaymentEvent = 'fine_created' | 'payment_success' | 'payment_failed';
const messages: Record<PaymentEvent, [string, string]> = {
  fine_created: ['Tagihan Denda Baru Dibuat', 'Buka Denda untuk melihat tagihan baru.'],
  payment_success: ['Pembayaran Denda Berhasil', 'Pembayaran telah diverifikasi. Lihat Riwayat Pembayaran.'],
  payment_failed: ['Pembayaran Belum Berhasil', 'Buka Riwayat Pembayaran untuk melihat langkah berikutnya.'],
};

export function paymentEventId(type: PaymentEvent, fineId: string, orderId?: string) {
  return type + '_' + createHash('sha256').update(type === 'payment_failed' ? orderId ?? fineId : fineId).digest('hex');
}

export function enqueuePaymentEvent(tx: Transaction, db: Firestore, type: PaymentEvent, uid: string, fineId: string, orderId?: string) {
  const id = paymentEventId(type, fineId, orderId);
  const [title, body] = messages[type];
  const payload = { recipientUid: uid, type, title, body,
    data: { type, screen: 'denda', fineId, ...(orderId ? { orderId } : {}),
      notificationId: id, tab: type === 'fine_created' ? 'aktif' : 'riwayat' } };
  tx.create(db.doc('notifications/' + id), { ...payload, status: 'sent', createdAt: FieldValue.serverTimestamp() });
  tx.create(db.doc('notificationOutbox/' + id), { ...payload, state: 'queued', nextAt: Timestamp.now() });
}
