import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, Pengguna, Presensi } from '@/types/models';
import { createInitialState, initialState } from '@/data/dummy';

export type AppAction =
  | { type: 'PILIH_PENGGUNA'; pengguna: Pengguna }
  | { type: 'KELUAR' }
  | { type: 'BUKA_SESI'; sesiId: string }
  | { type: 'TUTUP_SESI'; sesiId: string }
  | {
      type: 'CATAT_PRESENSI';
      sesiId: string;
      praktikanId: string;
      catatan?: string;
      waktuPresensi?: string;
    }
  | { type: 'RESET_DATA' };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'PILIH_PENGGUNA': {
      const ada = state.pengguna.some((u) => u.id === action.pengguna.id);
      return ada ? { ...state, currentUser: action.pengguna } : state;
    }

    case 'KELUAR':
      return { ...state, currentUser: null };

    case 'BUKA_SESI': {
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      if (!sesi || sesi.status !== 'dijadwalkan') return state;
      return {
        ...state,
        sesi: state.sesi.map((s) =>
          s.id === action.sesiId ? { ...s, status: 'dibuka' } : s,
        ),
      };
    }

    case 'TUTUP_SESI': {
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      if (!sesi || sesi.status !== 'dibuka') return state;
      return {
        ...state,
        sesi: state.sesi.map((s) =>
          s.id === action.sesiId ? { ...s, status: 'ditutup' } : s,
        ),
      };
    }

    case 'CATAT_PRESENSI': {
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      if (!sesi || sesi.status !== 'dibuka') return state;

      const praktikan = state.pengguna.find(
        (u) => u.id === action.praktikanId,
      );
      if (
        !praktikan ||
        praktikan.peran !== 'praktikan' ||
        praktikan.kelasId !== sesi.kelasId
      ) {
        return state;
      }

      const sudah = state.presensi.some(
        (p) =>
          p.sesiId === action.sesiId &&
          p.praktikanId === action.praktikanId,
      );
      if (sudah) return state;

      const baru: Presensi = {
        id: `pres-${action.sesiId}-${action.praktikanId}`,
        sesiId: action.sesiId,
        praktikanId: action.praktikanId,
        waktuPresensi:
          action.waktuPresensi ?? new Date().toISOString(),
        catatan: action.catatan?.trim() || undefined,
      };

      return { ...state, presensi: [...state.presensi, baru] };
    }

    case 'RESET_DATA':
      return createInitialState();

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

