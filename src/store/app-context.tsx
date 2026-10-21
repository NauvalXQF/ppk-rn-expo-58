import { createContext, useContext, useMemo, useReducer, type Dispatch, type PropsWithChildren } from 'react';

import { initialState } from '@/data/dummy';
import type { AppAction, AppState, Presensi } from '@/types/models';

export type { AppAction } from '@/types/models';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'PILIH_PENGGUNA': {
      const pengguna = state.pengguna.find((u) => u.id === action.pengguna.id);
      return pengguna ? { ...state, currentUser: pengguna } : state;
    }
    case 'KELUAR':
      return { ...state, currentUser: null };
    case 'BUKA_SESI':
    case 'TUTUP_SESI': {
      if (state.currentUser?.peran !== 'asisten') return state;
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      const buka = action.type === 'BUKA_SESI';
      if (!sesi || sesi.status !== (buka ? 'dijadwalkan' : 'dibuka')) return state;
      return {
        ...state,
        sesi: state.sesi.map((s) => s.id === sesi.id ? { ...s, status: buka ? 'dibuka' : 'ditutup' } : s),
      };
    }
    case 'CATAT_PRESENSI': {
      if (state.currentUser?.peran !== 'praktikan' || state.currentUser.id !== action.praktikanId) return state;
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      const praktikan = state.pengguna.find((u) => u.id === action.praktikanId);
      if (!sesi || sesi.status !== 'dibuka' || praktikan?.peran !== 'praktikan' || praktikan.kelasId !== sesi.kelasId) return state;
      if (state.presensi.some((p) => p.sesiId === sesi.id && p.praktikanId === praktikan.id)) return state;
      const baru: Presensi = {
        id: `pres-${sesi.id}-${praktikan.id}`,
        sesiId: sesi.id,
        praktikanId: praktikan.id,
        waktuPresensi: action.waktuPresensi ?? new Date().toISOString(),
        catatan: action.catatan?.trim() || undefined,
      };
      return { ...state, presensi: [...state.presensi, baru] };
    }
    case 'RESET_DATA':
      return initialState;
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> } | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp harus digunakan di dalam AppProvider.');
  return context;
}
