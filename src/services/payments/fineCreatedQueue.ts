import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { notifyFineCreated, PaymentRequestError } from '@/services/payments/paymentService';
import { isPaymentId } from '@/services/payments/paymentData';

export function createFineCreatedQueue(store: Pick<typeof AsyncStorage, 'setItem' | 'getAllKeys' | 'removeItem'>,
  send: (uid: string, fineId: string) => Promise<void>) {
  const running = new Map<string, Promise<void>>();
  const prefixFor = (uid: string) => '@ppk/fine-created/' + encodeURIComponent(uid) + '/';

  function drain(uid: string) {
    const pending = running.get(uid);
    if (pending) return pending;
    const task = (async () => {
      const prefix = prefixFor(uid);
      const keys = (await store.getAllKeys()).filter((key) => key.startsWith(prefix));
      for (const key of keys.slice(0, 10)) {
        try { await send(uid, key.slice(prefix.length)); }
        catch (error) {
          // A permanent validation failure must not block later queued fines.
          if (error instanceof PaymentRequestError && ['INVALID_INPUT', 'NOT_FOUND', 'PAYMENT_CONFLICT'].includes(error.code)) {
            await store.removeItem(key);
            continue;
          }
          return;
        }
        await store.removeItem(key);
      }
    })().finally(() => running.delete(uid));
    running.set(uid, task);
    return task;
  }

  return {
    async enqueue(uid: string, fineId: string) {
      if (!isPaymentId(fineId)) return;
      await store.setItem(prefixFor(uid) + fineId, '1');
      await drain(uid);
    },
    drain,
  };
}

const queue = createFineCreatedQueue(AsyncStorage, notifyFineCreated);
export const enqueueFineCreated = queue.enqueue;

export function watchFineCreatedQueue(uid: string) {
  function poll() {
    if (AppState.currentState === 'active') void queue.drain(uid).catch(() => {});
  }
  const appState = AppState.addEventListener('change', poll);
  const timer = setInterval(poll, 30_000);
  poll();
  return () => {
    clearInterval(timer);
    appState.remove();
  };
}
