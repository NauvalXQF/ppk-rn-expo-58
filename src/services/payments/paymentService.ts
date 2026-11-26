import {
  collection, doc, getDocFromServer, onSnapshot, query, where, type DocumentData,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase';
import type { PaymentFine, PaymentTransaction, SnapCreateResponse } from '@/types/payment';
import { isPaymentId, isSandboxCheckout, resolvePaymentApiOrigin, toIso } from '@/services/payments/paymentData';

type OwnerRecord = { uid: string; createdAt: string };
type ErrorHandler = (error: Error) => void;

function readFine(id: string, data: DocumentData): PaymentFine {
  return { ...data, id, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt),
    paidAt: toIso(data.paidAt) || null } as PaymentFine;
}

function readPayment(id: string, data: DocumentData): PaymentTransaction {
  return { ...data, orderId: id, createdAt: toIso(data.createdAt), fineCreatedAt: toIso(data.fineCreatedAt),
    settledAt: toIso(data.settledAt) || null } as PaymentTransaction;
}

function currentOwner(uid: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user || user.uid !== uid) throw new Error('Sesi berubah. Silakan masuk kembali.');
  return user;
}

function subscribeSafely(start: () => () => void, fail: ErrorHandler) {
  try {
    return start();
  } catch (error) {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) fail(error instanceof Error ? error : new Error('Langganan data tidak dapat dibuka.'));
    });
    return () => { active = false; };
  }
}

function subscribeOwnedList<T extends OwnerRecord>(name: string, uid: string,
  map: (id: string, data: DocumentData) => T, next: (items: T[]) => void, fail: ErrorHandler) {
  currentOwner(uid);
  return onSnapshot(query(collection(getFirebaseDb(), name), where('uid', '==', uid)),
    (snapshot) => {
      if (getFirebaseAuth().currentUser?.uid !== uid) return;
      next(snapshot.docs.map((item) => map(item.id, item.data())).filter((item) => item.uid === uid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, fail);
}

export function subscribeFines(uid: string, next: (items: PaymentFine[]) => void, fail: ErrorHandler) {
  return subscribeSafely(() => subscribeOwnedList('fines', uid, readFine, next, fail), fail);
}

export function subscribePayments(uid: string, next: (items: PaymentTransaction[]) => void, fail: ErrorHandler) {
  return subscribeSafely(() => subscribeOwnedList('payments', uid, readPayment, next, fail), fail);
}

export function subscribeFine(uid: string, fineId: string, next: (fine: PaymentFine | null) => void, fail: ErrorHandler) {
  return subscribeSafely(() => {
    currentOwner(uid);
    if (!isPaymentId(fineId)) throw new Error('ID tagihan tidak valid.');
    return onSnapshot(doc(getFirebaseDb(), 'fines', fineId), (snapshot) => {
      if (getFirebaseAuth().currentUser?.uid !== uid) return;
      const data = snapshot.data();
      next(data?.uid === uid ? readFine(snapshot.id, data) : null);
    }, fail);
  }, fail);
}

export function subscribePayment(uid: string, orderId: string,
  next: (payment: PaymentTransaction | null) => void, fail: ErrorHandler) {
  return subscribeSafely(() => {
    currentOwner(uid);
    if (!isPaymentId(orderId)) throw new Error('ID transaksi tidak valid.');
    return onSnapshot(doc(getFirebaseDb(), 'payments', orderId), (snapshot) => {
      if (getFirebaseAuth().currentUser?.uid !== uid) return;
      const data = snapshot.data();
      next(data?.uid === uid ? readPayment(snapshot.id, data) : null);
    }, fail);
  }, fail);
}

export class PaymentRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function post(uid: string, path: string, fineId: string): Promise<unknown> {
  if (!isPaymentId(fineId)) throw new Error('ID tagihan tidak valid.');
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!base) throw new Error('Alamat backend pembayaran belum diatur.');
  const origin = resolvePaymentApiOrigin(base, __DEV__);
  if (!origin) throw new Error('Gunakan HTTPS atau alamat loopback pada development build.');
  const token = await currentOwner(uid).getIdToken();
  currentOwner(uid);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  try {
    const response = await fetch(origin + path, {
      method: 'POST', signal: abort.signal, redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fineId }),
    });
    currentOwner(uid);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const code = typeof payload?.error?.code === 'string' ? payload.error.code : 'UNKNOWN';
      const message = code === 'PAYMENT_INITIALIZING' ? 'Transaksi sedang diperiksa. Cek status sebelum mencoba lagi.'
        : response.status === 401 ? 'Sesi tidak valid. Silakan masuk kembali.'
        : response.status === 404 || response.status === 403 ? 'Tagihan tidak tersedia untuk akun ini.'
        : response.status === 409 ? 'Tagihan belum dapat dibayar. Cek status terbaru.'
        : 'Layanan pembayaran belum tersedia. Coba lagi nanti.';
      throw new PaymentRequestError(code, message);
    }
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (error instanceof PaymentRequestError) throw error;
    throw new Error('Gagal menghubungi backend. Cek koneksi dan coba lagi.');
  } finally {
    clearTimeout(timer);
  }
}

export async function createPayment(uid: string, fineId: string): Promise<SnapCreateResponse> {
  const result = await post(uid, '/api/payments/create', fineId) as Partial<SnapCreateResponse> | null;
  if (!isPaymentId(result?.orderId) || typeof result?.snapToken !== 'string' || !isSandboxCheckout(result.redirectUrl)) {
    throw new Error('URL checkout Sandbox tidak valid.');
  }
  return { orderId: result.orderId, snapToken: result.snapToken, redirectUrl: result.redirectUrl };
}

export async function checkPaymentStatus(uid: string, fineId: string) {
  currentOwner(uid);
  if (!isPaymentId(fineId)) throw new Error('ID tagihan tidak valid.');
  const ref = doc(getFirebaseDb(), 'fines', fineId);
  let snapshot = await getDocFromServer(ref);
  if (snapshot.data()?.uid === uid && snapshot.data()?.status === 'pending_payment') {
    await post(uid, '/api/payments/status', fineId);
    snapshot = await getDocFromServer(ref);
  }
  currentOwner(uid);
  const data = snapshot.data();
  if (data?.uid !== uid) throw new Error('Tagihan tidak tersedia untuk akun ini.');
  return readFine(snapshot.id, data);
}

export async function notifyFineCreated(uid: string, fineId: string) {
  await post(uid, '/api/payments/fine-created', fineId);
}
