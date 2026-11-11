import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type PropsWithChildren,
} from 'react';

import { initialState } from '@/data/dummy';
import {
  subscribeAttendancesRealtime,
  submitAttendanceToFirestore,
} from '@/services/attendanceService';
import {
  DEFAULT_SCHEDULES,
  deleteClassFromFirestore,
  deleteClassMemberFromFirestore,
  deleteScheduleFromFirestore,
  deleteSessionFromFirestore,
  isFirebaseConfigured,
  saveClassMemberToFirestore,
  saveClassToFirestore,
  saveScheduleToFirestore,
  saveSessionToFirestore,
  seedInitialDataToFirestore,
  subscribeAuthUserRealtime,
  subscribePracticumRealtime,
  updateSessionStatusInFirestore,
} from '@/services/practicumService';
import type {
  AppAction,
  AppState,
  Jadwal,
  Kelas,
  Praktikan,
  Presensi,
  Sesi,
  StatusSesi,
} from '@/types/models';

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
        sesi: state.sesi.map((s) =>
          s.id === sesi.id ? { ...s, status: buka ? 'dibuka' : 'ditutup' } : s,
        ),
      };
    }
    case 'CATAT_PRESENSI': {
      if (
        state.currentUser?.peran !== 'praktikan' ||
        state.currentUser.id !== action.praktikanId
      ) {
        return state;
      }
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      const praktikan =
        state.pengguna.find((u) => u.id === action.praktikanId) ??
        state.currentUser;
      if (
        !sesi ||
        sesi.status !== 'dibuka' ||
        praktikan?.peran !== 'praktikan' ||
        praktikan.kelasId !== sesi.kelasId
      ) {
        return state;
      }
      if (
        state.presensi.some(
          (p) => p.sesiId === sesi.id && p.praktikanId === praktikan.id,
        )
      ) {
        return state;
      }
      const baru: Presensi = {
        id: `pres-${sesi.id}-${praktikan.id}`,
        sesiId: sesi.id,
        praktikanId: praktikan.id,
        waktuPresensi: action.waktuPresensi ?? new Date().toISOString(),
        catatan: action.catatan?.trim() || undefined,
      };
      return { ...state, presensi: [...state.presensi, baru] };
    }
    case 'TAMBAH_KELAS': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.kelas.nama.trim()) return state;
      if (state.kelas.some((k) => k.id === action.kelas.id)) return state;
      return { ...state, kelas: [...state.kelas, action.kelas] };
    }
    case 'UBAH_KELAS': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.kelas.nama.trim()) return state;
      return {
        ...state,
        kelas: state.kelas.map((k) =>
          k.id === action.kelas.id ? action.kelas : k,
        ),
      };
    }
    case 'HAPUS_KELAS': {
      if (state.currentUser?.peran !== 'asisten') return state;
      return {
        ...state,
        kelas: state.kelas.filter((k) => k.id !== action.kelasId),
      };
    }
    case 'TAMBAH_PESERTA': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.peserta.nama.trim() || !action.peserta.nim.trim()) return state;
      const exists = state.pengguna.some((u) => u.id === action.peserta.id);
      return {
        ...state,
        pengguna: exists
          ? state.pengguna.map((u) =>
              u.id === action.peserta.id ? action.peserta : u,
            )
          : [...state.pengguna, action.peserta],
      };
    }
    case 'UBAH_PESERTA': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.peserta.nama.trim() || !action.peserta.nim.trim()) return state;
      return {
        ...state,
        pengguna: state.pengguna.map((u) =>
          u.id === action.peserta.id ? action.peserta : u,
        ),
      };
    }
    case 'HAPUS_PESERTA': {
      if (state.currentUser?.peran !== 'asisten') return state;
      return {
        ...state,
        pengguna: state.pengguna.filter(
          (u) => !(u.peran === 'praktikan' && u.id === action.praktikanId),
        ),
      };
    }
    case 'TAMBAH_JADWAL': {
      if (state.currentUser?.peran !== 'asisten') return state;
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      return { ...state, jadwal: [...currentJadwal, action.jadwal] };
    }
    case 'UBAH_JADWAL': {
      if (state.currentUser?.peran !== 'asisten') return state;
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      return {
        ...state,
        jadwal: currentJadwal.map((j) =>
          j.id === action.jadwal.id ? action.jadwal : j,
        ),
      };
    }
    case 'HAPUS_JADWAL': {
      if (state.currentUser?.peran !== 'asisten') return state;
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      return {
        ...state,
        jadwal: currentJadwal.filter((j) => j.id !== action.jadwalId),
      };
    }
    case 'TAMBAH_SESI': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.sesi.topik.trim() || !action.sesi.ruang.trim()) return state;
      return { ...state, sesi: [...state.sesi, action.sesi] };
    }
    case 'UBAH_SESI': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.sesi.topik.trim() || !action.sesi.ruang.trim()) return state;
      return {
        ...state,
        sesi: state.sesi.map((s) => (s.id === action.sesi.id ? action.sesi : s)),
      };
    }
    case 'HAPUS_SESI': {
      if (state.currentUser?.peran !== 'asisten') return state;
      return {
        ...state,
        sesi: state.sesi.filter((s) => s.id !== action.sesiId),
        presensi: state.presensi.filter((p) => p.sesiId !== action.sesiId),
      };
    }
    case 'SYNC_FIRESTORE': {
      return {
        ...state,
        ...action.payload,
      };
    }
    case 'RESET_DATA':
      return initialState;
    default:
      return state;
  }
}

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  loading: boolean;
  error: string | null;
  isRemote: boolean;
  clearError: () => void;
  bukaSesi: (sesiId: string) => Promise<void>;
  tutupSesi: (sesiId: string) => Promise<void>;
  catatPresensi: (sesiId: string, catatan?: string) => Promise<void>;
  simpanKelas: (input: { id?: string; nama: string }) => Promise<Kelas>;
  hapusKelas: (kelasId: string) => Promise<void>;
  simpanPeserta: (input: {
    id?: string;
    nama: string;
    nim: string;
    kelasId: string;
  }) => Promise<Praktikan>;
  hapusPeserta: (praktikanId: string) => Promise<void>;
  simpanJadwal: (input: {
    id?: string;
    kelasId: string;
    hari: string;
    jamMulai: string;
    jamSelesai: string;
    ruang: string;
    topik: string;
  }) => Promise<Jadwal>;
  hapusJadwal: (jadwalId: string) => Promise<void>;
  simpanSesi: (input: {
    id?: string;
    kelasId: string;
    scheduleId?: string;
    topik: string;
    ruang: string;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    status?: StatusSesi;
  }) => Promise<Sesi>;
  hapusSesi: (sesiId: string) => Promise<void>;
  seedDataAwal: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, rawDispatch] = useReducer(appReducer, initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRemote = isFirebaseConfigured();

  const clearError = useCallback(() => setError(null), []);

  // Sinkronisasi user dari Firebase Auth jika modul P1 sedang login
  useEffect(() => {
    if (!isRemote) return;
    const unsub = subscribeAuthUserRealtime((fbUser) => {
      if (!fbUser) return;
      rawDispatch({
        type: 'SYNC_FIRESTORE',
        payload: { currentUser: fbUser },
      });
    });
    return unsub;
  }, [isRemote]);

  // Real-time listener Firestore untuk kelas, peserta, jadwal, dan sesi
  useEffect(() => {
    if (!isRemote || !state.currentUser) return;

    const unsub = subscribePracticumRealtime(state.currentUser, {
      onClasses: (kelas) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { kelas } });
      },
      onMembers: (members) => {
        const baseAsisten = initialState.pengguna.filter(
          (u) => u.peran === 'asisten',
        );
        const activeAsisten =
          state.currentUser?.peran === 'asisten' &&
          !baseAsisten.some((a) => a.id === state.currentUser?.id)
            ? [...baseAsisten, state.currentUser]
            : baseAsisten;
        rawDispatch({
          type: 'SYNC_FIRESTORE',
          payload: { pengguna: [...activeAsisten, ...members] },
        });
      },
      onSchedules: (jadwal) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { jadwal } });
      },
      onSessions: (sesi) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { sesi } });
      },
      onError: (msg) => setError(msg),
    });

    return unsub;
  }, [isRemote, state.currentUser]);

  // Real-time listener Firestore untuk subcollection presensi per sesi
  const sessionIdsKey = useMemo(
    () =>
      state.sesi
        .map((s) => s.id)
        .sort()
        .join(','),
    [state.sesi],
  );

  useEffect(() => {
    if (!isRemote || !state.currentUser || !sessionIdsKey) return;
    const ids = sessionIdsKey.split(',').filter(Boolean);
    const unsub = subscribeAttendancesRealtime(
      state.currentUser,
      ids,
      (presensi) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { presensi } });
      },
      (msg) => setError(msg),
    );
    return unsub;
  }, [isRemote, state.currentUser, sessionIdsKey]);

  const runAsync = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Terjadi kesalahan pada operasi data.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bukaSesi = useCallback(
    async (sesiId: string) => {
      await runAsync(async () => {
        rawDispatch({ type: 'BUKA_SESI', sesiId });
        if (isRemote) {
          await updateSessionStatusInFirestore(state.currentUser, sesiId, 'open');
        }
      });
    },
    [isRemote, runAsync, state.currentUser],
  );

  const tutupSesi = useCallback(
    async (sesiId: string) => {
      await runAsync(async () => {
        rawDispatch({ type: 'TUTUP_SESI', sesiId });
        if (isRemote) {
          await updateSessionStatusInFirestore(
            state.currentUser,
            sesiId,
            'closed',
          );
        }
      });
    },
    [isRemote, runAsync, state.currentUser],
  );

  const catatPresensi = useCallback(
    async (sesiId: string, catatan?: string) => {
      await runAsync(async () => {
        if (!state.currentUser || state.currentUser.peran !== 'praktikan') {
          throw new Error('Hanya praktikan yang dapat melakukan presensi.');
        }
        const localSesi = state.sesi.find((s) => s.id === sesiId) ?? null;
        const alreadyAttendedLocally = state.presensi.some(
          (p) => p.sesiId === sesiId && p.praktikanId === state.currentUser?.id,
        );
        const record = await submitAttendanceToFirestore(state.currentUser, {
          sesiId,
          praktikanId: state.currentUser.id,
          catatan,
          localSesi,
          alreadyAttendedLocally,
        });
        rawDispatch({
          type: 'CATAT_PRESENSI',
          sesiId,
          praktikanId: state.currentUser.id,
          catatan: record.catatan,
          waktuPresensi: record.waktuPresensi,
        });
      });
    },
    [runAsync, state.currentUser, state.presensi, state.sesi],
  );

  const simpanKelas = useCallback(
    async (input: { id?: string; nama: string }) =>
      runAsync(async () => {
        const saved = await saveClassToFirestore(state.currentUser, input);
        rawDispatch({
          type: input.id ? 'UBAH_KELAS' : 'TAMBAH_KELAS',
          kelas: saved,
        });
        return saved;
      }),
    [runAsync, state.currentUser],
  );

  const hapusKelas = useCallback(
    async (kelasId: string) =>
      runAsync(async () => {
        await deleteClassFromFirestore(state.currentUser, kelasId);
        rawDispatch({ type: 'HAPUS_KELAS', kelasId });
      }),
    [runAsync, state.currentUser],
  );

  const simpanPeserta = useCallback(
    async (input: { id?: string; nama: string; nim: string; kelasId: string }) =>
      runAsync(async () => {
        const saved = await saveClassMemberToFirestore(state.currentUser, input);
        rawDispatch({
          type: input.id ? 'UBAH_PESERTA' : 'TAMBAH_PESERTA',
          peserta: saved,
        });
        return saved;
      }),
    [runAsync, state.currentUser],
  );

  const hapusPeserta = useCallback(
    async (praktikanId: string) =>
      runAsync(async () => {
        const target = state.pengguna.find(
          (u): u is Praktikan => u.peran === 'praktikan' && u.id === praktikanId,
        );
        await deleteClassMemberFromFirestore(
          state.currentUser,
          praktikanId,
          target?.kelasId,
        );
        rawDispatch({ type: 'HAPUS_PESERTA', praktikanId });
      }),
    [runAsync, state.currentUser, state.pengguna],
  );

  const simpanJadwal = useCallback(
    async (input: {
      id?: string;
      kelasId: string;
      hari: string;
      jamMulai: string;
      jamSelesai: string;
      ruang: string;
      topik: string;
    }) =>
      runAsync(async () => {
        const saved = await saveScheduleToFirestore(state.currentUser, input);
        rawDispatch({
          type: input.id ? 'UBAH_JADWAL' : 'TAMBAH_JADWAL',
          jadwal: saved,
        });
        return saved;
      }),
    [runAsync, state.currentUser],
  );

  const hapusJadwal = useCallback(
    async (jadwalId: string) =>
      runAsync(async () => {
        await deleteScheduleFromFirestore(state.currentUser, jadwalId);
        rawDispatch({ type: 'HAPUS_JADWAL', jadwalId });
      }),
    [runAsync, state.currentUser],
  );

  const simpanSesi = useCallback(
    async (input: {
      id?: string;
      kelasId: string;
      scheduleId?: string;
      topik: string;
      ruang: string;
      tanggal: string;
      jamMulai: string;
      jamSelesai: string;
      status?: StatusSesi;
    }) =>
      runAsync(async () => {
        const saved = await saveSessionToFirestore(state.currentUser, input);
        rawDispatch({
          type: input.id ? 'UBAH_SESI' : 'TAMBAH_SESI',
          sesi: saved,
        });
        return saved;
      }),
    [runAsync, state.currentUser],
  );

  const hapusSesi = useCallback(
    async (sesiId: string) =>
      runAsync(async () => {
        await deleteSessionFromFirestore(state.currentUser, sesiId);
        rawDispatch({ type: 'HAPUS_SESI', sesiId });
      }),
    [runAsync, state.currentUser],
  );

  const seedDataAwal = useCallback(
    async () =>
      runAsync(async () => {
        await seedInitialDataToFirestore();
      }),
    [runAsync],
  );

  const dispatch: Dispatch<AppAction> = useCallback(
    (action: AppAction) => {
      rawDispatch(action);
      if (!isRemote) return;
      if (action.type === 'BUKA_SESI') {
        updateSessionStatusInFirestore(
          state.currentUser,
          action.sesiId,
          'open',
        ).catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Gagal membuka sesi.'),
        );
      } else if (action.type === 'TUTUP_SESI') {
        updateSessionStatusInFirestore(
          state.currentUser,
          action.sesiId,
          'closed',
        ).catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Gagal menutup sesi.'),
        );
      } else if (action.type === 'CATAT_PRESENSI') {
        submitAttendanceToFirestore(state.currentUser, {
          sesiId: action.sesiId,
          praktikanId: action.praktikanId,
          catatan: action.catatan,
          waktuPresensi: action.waktuPresensi,
        }).catch((err: unknown) =>
          setError(
            err instanceof Error ? err.message : 'Gagal menyimpan presensi.',
          ),
        );
      } else if (action.type === 'RESET_DATA') {
        seedInitialDataToFirestore().catch(() => {});
      }
    },
    [isRemote, state.currentUser],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      loading,
      error,
      isRemote,
      clearError,
      bukaSesi,
      tutupSesi,
      catatPresensi,
      simpanKelas,
      hapusKelas,
      simpanPeserta,
      hapusPeserta,
      simpanJadwal,
      hapusJadwal,
      simpanSesi,
      hapusSesi,
      seedDataAwal,
    }),
    [
      state,
      dispatch,
      loading,
      error,
      isRemote,
      clearError,
      bukaSesi,
      tutupSesi,
      catatPresensi,
      simpanKelas,
      hapusKelas,
      simpanPeserta,
      hapusPeserta,
      simpanJadwal,
      hapusJadwal,
      simpanSesi,
      hapusSesi,
      seedDataAwal,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp harus digunakan di dalam AppProvider.');
  return context;
}
