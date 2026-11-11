/**
 * Firebase JS SDK mengekspor `getReactNativePersistence` hanya pada bundle React Native
 * (@firebase/auth/dist/rn), sedangkan deklarasi tipe publiknya tidak memuat fungsi ini.
 * Augmentasi berikut melengkapi tipe agar pemakaiannya tetap type-safe.
 */
import 'firebase/auth';

import type { Persistence } from '@firebase/auth';

declare module 'firebase/auth' {
  export interface ReactNativeAsyncStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(storage: ReactNativeAsyncStorageLike): Persistence;
}
