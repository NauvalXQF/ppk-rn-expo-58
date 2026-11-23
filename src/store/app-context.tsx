import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
  subscribePracticumRealtime,
  updateSessionStatusInFirestore,
} from '@/services/practicumService';
import { resolveSessionLabTarget } from '@/services/location/geofenceService';
import {
  notifyScheduleChanged,
  notifySessionOpened,
} from '@/services/notifications/notificationDispatcher';
import { isPraktikanInClass } from '@/store/selectors';
import type { GeoAttendancePayload } from '@/types/geoAttendance';
import type {
  AppAction,
  AppState,
  Jadwal,
  Kelas,
  Pengguna,
  Praktikan,
  Presensi,
  Sesi,
  StatusSesi,
} from '@/types/models';

export type { AppAction } from '@/types/models';

function isSamePengguna(a: Pengguna | null, b: Pengguna): boolean {
  if (!a || a.id !== b.id || a.peran !== b.peran || a.nama !== b.nama || a.email !== b.email) {
    return false;
  }
  if (a.peran === 'praktikan' && b.peran === 'praktikan') {
    const aIds = a.kelasIds ?? [];
    const bIds = b.kelasIds ?? [];
    const sameKelasIds =
      (a.kelasIds === undefined) === (b.kelasIds === undefined) &&
      aIds.length === bIds.length &&
      aIds.every((id, idx) => id === bIds[idx]);
    return a.nim === b.nim && a.kelasId === b.kelasId && sameKelasIds;
  }
  if (a.peran === 'asisten' && b.peran === 'asisten') {
    return a.nip === b.nip;
  }
  return false;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'PILIH_PENGGUNA': {
      const pengguna = state.pengguna.find((u) => u.id === action.pengguna.id);
      return pengguna ? { ...state, currentUser: pengguna } : state;
    }
    case 'SET_PENGGUNA': {
      const incoming: Pengguna =
        action.pengguna.peran === 'praktikan' &&
        state.currentUser?.peran === 'praktikan' &&
        state.currentUser.id === action.pengguna.id &&
        action.pengguna.kelasIds === undefined &&
        state.currentUser.kelasIds !== undefined
          ? {
              ...action.pengguna,
              kelasId: state.currentUser.kelasId,
              kelasIds: state.currentUser.kelasIds,
              nim:
                action.pengguna.nim === '-' && state.currentUser.nim !== '-'
                  ? state.currentUser.nim
                  : action.pengguna.nim,
            }
          : action.pengguna;

      const sudahAda = state.pengguna.some((u) => u.id === incoming.id);
      if (sudahAda && isSamePengguna(state.currentUser, incoming)) {
        return state;
      }
      return {
        ...state,
        currentUser: incoming,
        pengguna: sudahAda
          ? state.pengguna.map((u) => (u.id === incoming.id ? incoming : u))
          : [...state.pengguna, incoming],
      };
    }
    case 'KELUAR':
      return state.currentUser === null ? state : { ...state, currentUser: null };
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
        !isPraktikanInClass(praktikan, sesi.kelasId)
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
        ...(typeof action.latitude === 'number' ? { latitude: action.latitude } : {}),
        ...(typeof action.longitude === 'number' ? { longitude: action.longitude } : {}),
        ...(typeof action.accuracy === 'number' ? { accuracy: action.accuracy } : {}),
        ...(typeof action.distanceMeters === 'number'
          ? { distanceMeters: action.distanceMeters }
          : {}),
        ...(action.geofenceStatus ? { geofenceStatus: action.geofenceStatus } : {}),
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
      if (!action.peserta.nama.trim()) return state;
      const normalized: Praktikan = {
        ...action.peserta,
        nim: action.peserta.nim.trim() || '-',
      };
      const exists = state.pengguna.some((u) => u.id === normalized.id);
      return {
        ...state,
        pengguna: exists
          ? state.pengguna.map((u) =>
              u.id === normalized.id ? normalized : u,
            )
          : [...state.pengguna, normalized],
      };
    }
    case 'UBAH_PESERTA': {
      if (state.currentUser?.peran !== 'asisten') return state;
      if (!action.peserta.nama.trim()) return state;
      const normalized: Praktikan = {
        ...action.peserta,
        nim: action.peserta.nim.trim() || '-',
      };
      return {
        ...state,
        pengguna: state.pengguna.map((u) =>
          u.id === normalized.id ? normalized : u,
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
      if (currentJadwal.some((j) => j.id === action.jadwal.id)) return state;
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
      if (state.sesi.some((s) => s.id === action.sesi.id)) return state;
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
      const nextPayload = { ...action.payload };
      if (
        nextPayload.currentUser &&
        isSamePengguna(state.currentUser, nextPayload.currentUser)
      ) {
        nextPayload.currentUser = state.currentUser;
      }
      if (
        Object.keys(nextPayload).length === 1 &&
        'currentUser' in nextPayload &&
        nextPayload.currentUser === state.currentUser
      ) {
        return state;
      }
      return {
        ...state,
        ...nextPayload,
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
  catatPresensi: (
    sesiId: string,
    catatan?: string,
    geo?: GeoAttendancePayload,
  ) => Promise<Presensi>;
  simpanKelas: (input: { id?: string; nama: string }) => Promise<Kelas>;
  hapusKelas: (kelasId: string) => Promise<void>;
  simpanPeserta: (input: {
    id?: string;
    nama: string;
    nim?: string;
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

const remoteInitialState: AppState = {
  ...initialState,
  pengguna: [],
  kelas: [],
  jadwal: [],
  sesi: [],
  presensi: [],
};

export function AppProvider({ children }: PropsWithChildren) {
  const isRemote = isFirebaseConfigured();
  const [state, rawDispatch] = useReducer(appReducer, isRemote ? remoteInitialState : initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUserRef = useRef(state.currentUser);
  const stateRef = useRef(state);

  useEffect(() => {
    currentUserRef.current = state.currentUser;
    stateRef.current = state;
  }, [state]);

  const clearError = useCallback(() => setError(null), []);

  // Real-time listener Firestore untuk kelas, peserta, jadwal, dan sesi
  const currentUserId = state.currentUser?.id;
  const currentUserRole = state.currentUser?.peran;

  useEffect(() => {
    const activeUser = currentUserRef.current;
    if (!isRemote || !activeUser || !currentUserId || !currentUserRole) return;

    const unsub = subscribePracticumRealtime(activeUser, {
      onClasses: (kelas) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { kelas } });
      },
      onMembers: (members) => {
        const cur = currentUserRef.current;

        if (cur?.peran === 'praktikan') {
          const ownMembers = members.filter((m) => m.id === cur.id);
          const ownClassIds = Array.from(
            new Set(ownMembers.map((m) => m.kelasId).filter(Boolean)),
          );
          const updatedCurrentUser: Praktikan = {
            ...cur,
            kelasId: ownClassIds[0] ?? '',
            kelasIds: ownClassIds,
            nim:
              ownMembers[0]?.nim && ownMembers[0].nim !== '-'
                ? ownMembers[0].nim
                : cur.nim,
          };
          rawDispatch({
            type: 'SYNC_FIRESTORE',
            payload: {
              currentUser: updatedCurrentUser,
              pengguna: members,
            },
          });
          return;
        }

        rawDispatch({
          type: 'SYNC_FIRESTORE',
          payload: { pengguna: cur?.peran === 'asisten' ? [cur, ...members] : members },
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
  }, [isRemote, currentUserId, currentUserRole]);

  useEffect(() => {
    const actor = currentUserRef.current;
    if (!isRemote || !currentUserId || currentUserRole !== 'asisten' || actor?.id !== currentUserId) return;

    let aktif = true;
    seedInitialDataToFirestore(actor, { onlyWhenSessionsEmpty: true }).catch((err: unknown) => {
      if (aktif) {
        const pesan = err instanceof Error ? err.message : 'Terjadi kesalahan pada operasi data.';
        setError(`Gagal menginisialisasi data praktikum: ${pesan}`);
      }
    });
    return () => { aktif = false; };
  }, [isRemote, currentUserId, currentUserRole]);

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
    const activeUser = currentUserRef.current;
    if (isRemote && !sessionIdsKey) {
      rawDispatch({ type: 'SYNC_FIRESTORE', payload: { presensi: [] } });
    }
    if (!isRemote || !activeUser || !currentUserId || !currentUserRole || !sessionIdsKey) {
      return;
    }
    const ids = sessionIdsKey.split(',').filter(Boolean);
    const unsub = subscribeAttendancesRealtime(
      activeUser,
      ids,
      (presensi) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { presensi } });
      },
      (msg) => setError(msg),
    );
    return unsub;
  }, [isRemote, currentUserId, currentUserRole, sessionIdsKey]);

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
        const targetSesi = state.sesi.find((s) => s.id === sesiId);
        if (isRemote) {
          await updateSessionStatusInFirestore(state.currentUser, sesiId, 'open');
        } else {
          rawDispatch({ type: 'BUKA_SESI', sesiId });
        }

        if (targetSesi) {
          const fallbackMembers = state.pengguna.filter(
            (u): u is Praktikan => u.peran === 'praktikan',
          );
          notifySessionOpened(
            {
              sessionId: targetSesi.id,
              classId: targetSesi.kelasId,
              topik: targetSesi.topik,
              labNama: targetSesi.labNama,
              ruang: targetSesi.ruang,
            },
            { fallbackMembers },
          ).catch(() => {});
        }
      });
    },
    [isRemote, runAsync, state.currentUser, state.pengguna, state.sesi],
  );

  const tutupSesi = useCallback(
    async (sesiId: string) => {
      await runAsync(async () => {
        if (isRemote) {
          await updateSessionStatusInFirestore(
            state.currentUser,
            sesiId,
            'closed',
          );
        } else {
          rawDispatch({ type: 'TUTUP_SESI', sesiId });
        }
      });
    },
    [isRemote, runAsync, state.currentUser],
  );

  const catatPresensi = useCallback(
    async (sesiId: string, catatan?: string, geo?: GeoAttendancePayload) =>
      runAsync(async () => {
        if (!state.currentUser || state.currentUser.peran !== 'praktikan') {
          throw new Error('Hanya praktikan yang dapat melakukan presensi.');
        }
        const localSesi = state.sesi.find((s) => s.id === sesiId) ?? null;
        const alreadyAttendedLocally = state.presensi.some(
          (p) => p.sesiId === sesiId && p.praktikanId === state.currentUser?.id,
        );
        const labTarget = resolveSessionLabTarget(localSesi);
        const record = await submitAttendanceToFirestore(state.currentUser, {
          sesiId,
          praktikanId: state.currentUser.id,
          catatan,
          localSesi,
          alreadyAttendedLocally,
          geo,
          labTarget,
        });
        rawDispatch({
          type: 'CATAT_PRESENSI',
          sesiId,
          praktikanId: state.currentUser.id,
          catatan: record.catatan,
          waktuPresensi: record.waktuPresensi,
          latitude: record.latitude,
          longitude: record.longitude,
          accuracy: record.accuracy,
          distanceMeters: record.distanceMeters,
          geofenceStatus: record.geofenceStatus,
        });
        return record;
      }),
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
    async (input: { id?: string; nama: string; nim?: string; kelasId: string }) =>
      runAsync(() => saveClassMemberToFirestore(state.currentUser, input)),
    [runAsync, state.currentUser],
  );

  const hapusPeserta = useCallback(
    async (praktikanId: string) =>
      runAsync(async () => {
        const targets = state.pengguna.filter(
          (u): u is Praktikan => u.peran === 'praktikan' && u.id === praktikanId,
        );
        if (isRemote && targets.length !== 1) {
          throw new Error('Tidak dapat menentukan kelas keanggotaan untuk UID ini.');
        }
        await deleteClassMemberFromFirestore(
          state.currentUser,
          praktikanId,
          targets[0]?.kelasId,
        );
        if (!isRemote) rawDispatch({ type: 'HAPUS_PESERTA', praktikanId });
      }),
    [isRemote, runAsync, state.currentUser, state.pengguna],
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
        const isUpdate = Boolean(input.id?.trim());
        const saved = await saveScheduleToFirestore(state.currentUser, input);
        rawDispatch({
          type: isUpdate ? 'UBAH_JADWAL' : 'TAMBAH_JADWAL',
          jadwal: saved,
        });
        if (isUpdate) {
          const fallbackMembers = state.pengguna.filter(
            (u): u is Praktikan => u.peran === 'praktikan',
          );
          notifyScheduleChanged(
            {
              classId: saved.kelasId,
              scheduleId: saved.id,
              topik: saved.topik,
              ruang: saved.ruang,
              waktu: `${saved.hari}, ${saved.jamMulai}-${saved.jamSelesai}`,
            },
            { fallbackMembers },
          ).catch(() => {});
        }
        return saved;
      }),
    [runAsync, state.currentUser, state.pengguna],
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
        const isUpdate = Boolean(input.id?.trim());
        const previousSesi = isUpdate
          ? state.sesi.find((s) => s.id === input.id)
          : undefined;
        const saved = await saveSessionToFirestore(state.currentUser, input);
        if (!isRemote) {
          rawDispatch({ type: isUpdate ? 'UBAH_SESI' : 'TAMBAH_SESI', sesi: saved });
        }
        const jadwalBerubah =
          isUpdate &&
          (!previousSesi ||
            previousSesi.ruang !== saved.ruang ||
            previousSesi.tanggal !== saved.tanggal ||
            previousSesi.jamMulai !== saved.jamMulai ||
            previousSesi.jamSelesai !== saved.jamSelesai ||
            previousSesi.topik !== saved.topik);
        if (jadwalBerubah) {
          const fallbackMembers = state.pengguna.filter(
            (u): u is Praktikan => u.peran === 'praktikan',
          );
          notifyScheduleChanged(
            {
              classId: saved.kelasId,
              sessionId: saved.id,
              scheduleId: saved.scheduleId,
              topik: saved.topik,
              ruang: saved.ruang,
              waktu: `${saved.tanggal} ${saved.jamMulai}-${saved.jamSelesai}`,
            },
            { fallbackMembers },
          ).catch(() => {});
        }
        return saved;
      }),
    [isRemote, runAsync, state.currentUser, state.pengguna, state.sesi],
  );

  const hapusSesi = useCallback(
    async (sesiId: string) =>
      runAsync(async () => {
        await deleteSessionFromFirestore(state.currentUser, sesiId);
        if (!isRemote) rawDispatch({ type: 'HAPUS_SESI', sesiId });
      }),
    [isRemote, runAsync, state.currentUser],
  );

  const seedDataAwal = useCallback(
    async () =>
      runAsync(async () => {
        await seedInitialDataToFirestore(currentUserRef.current);
      }),
    [runAsync],
  );

  const dispatch: Dispatch<AppAction> = useCallback(
    (action: AppAction) => {
      if (!isRemote) {
        rawDispatch(action);
        return;
      }
      const actor = currentUserRef.current;
      if (action.type === 'RESET_DATA') return;
      if (
        action.type === 'KELUAR' ||
        (action.type === 'SET_PENGGUNA' &&
          (action.pengguna.id !== actor?.id || action.pengguna.peran !== actor?.peran))
      ) {
        const { pengguna, kelas, jadwal, sesi, presensi } = remoteInitialState;
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { pengguna, kelas, jadwal, sesi, presensi } });
        setError(null);
      }

      if (action.type === 'BUKA_SESI') {
        const targetSesi = stateRef.current.sesi.find(
          (s) => s.id === action.sesiId,
        );
        const fallbackMembers = stateRef.current.pengguna.filter(
          (u): u is Praktikan => u.peran === 'praktikan',
        );
        updateSessionStatusInFirestore(
          actor,
          action.sesiId,
          'open',
        )
          .then(() => {
            if (!targetSesi) return;
            notifySessionOpened(
              {
                sessionId: targetSesi.id,
                classId: targetSesi.kelasId,
                topik: targetSesi.topik,
                labNama: targetSesi.labNama,
                ruang: targetSesi.ruang,
              },
              { fallbackMembers },
            ).catch(() => {});
          })
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : 'Gagal membuka sesi.'),
          );
      } else if (action.type === 'TUTUP_SESI') {
        updateSessionStatusInFirestore(
          actor,
          action.sesiId,
          'closed',
        ).catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Gagal menutup sesi.'),
        );
      } else if (action.type === 'CATAT_PRESENSI') {
        rawDispatch(action);
        const geo =
          typeof action.latitude === 'number' &&
          typeof action.longitude === 'number'
            ? {
                latitude: action.latitude,
                longitude: action.longitude,
                accuracy: action.accuracy ?? 0,
                distanceMeters: action.distanceMeters ?? 0,
                geofenceStatus: action.geofenceStatus ?? ('in_radius' as const),
              }
            : undefined;
        submitAttendanceToFirestore(actor, {
          sesiId: action.sesiId,
          praktikanId: action.praktikanId,
          catatan: action.catatan,
          waktuPresensi: action.waktuPresensi,
          geo,
        }).catch((err: unknown) =>
          setError(
            err instanceof Error ? err.message : 'Gagal menyimpan presensi.',
          ),
        );
      } else {
        rawDispatch(action);
      }
    },
    [isRemote],
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
