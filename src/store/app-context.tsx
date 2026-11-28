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
  subscribeAsistenLeaves,
  subscribePraktikanLeaves,
} from '@/services/permissionService';
import { getActivePermissionRepository } from '@/services/firestorePermissionRepository';
import type { LeaveRequest } from '@/features/permissions/types';
import { mapPenggunaToPermissionActor } from '@/features/permissions/adapters';
import {
  notifyScheduleChanged,
  notifySessionOpened,
} from '@/services/notifications/notificationDispatcher';
import { isPraktikanInClass } from '@/store/selectors';
import type {
  GeoAttendancePayload,
  LabGeofenceTarget,
} from '@/types/geoAttendance';
import {
  canManageClassesAndMembers,
  isStaffUser,
  type AppAction,
  type AppState,
  type ApprovedLeaveRef,
  type Jadwal,
  type Kelas,
  type Pengguna,
  type Praktikan,
  type Presensi,
  type Sesi,
  type StatusSesi,
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
  if (a.peran === 'asprak' && b.peran === 'asprak') {
    const aLabs = a.assignedLabIds ?? [];
    const bLabs = b.assignedLabIds ?? [];
    const sameLabs =
      (a.assignedLabIds === undefined) === (b.assignedLabIds === undefined) &&
      aLabs.length === bLabs.length &&
      aLabs.every((id, idx) => id === bLabs[idx]);
    return a.nip === b.nip && sameLabs;
  }
  if (a.peran === 'aslab' && b.peran === 'aslab') {
    const aCourses = a.managedCourseIds ?? [];
    const bCourses = b.managedCourseIds ?? [];
    const sameCourses =
      (a.managedCourseIds === undefined) === (b.managedCourseIds === undefined) &&
      aCourses.length === bCourses.length &&
      aCourses.every((id, idx) => id === bCourses[idx]);
    return a.nip === b.nip && sameCourses;
  }
  if (a.peran === 'asisten' && b.peran === 'asisten') {
    return a.nip === b.nip;
  }
  return false;
}

function canActOnClassInReducer(user: Pengguna | null, kelasId: string): boolean {
  if (!isStaffUser(user)) return false;
  if (user.peran === 'asprak' && Array.isArray(user.assignedLabIds)) {
    return user.assignedLabIds.includes(kelasId);
  }
  return true;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'PILIH_PENGGUNA': {
      const pengguna = state.pengguna.find((u) => u.id === action.pengguna.id);
      return pengguna ? { ...state, currentUser: pengguna } : state;
    }
    case 'SET_PENGGUNA': {
      let incoming: Pengguna = action.pengguna;
      if (
        incoming.peran === 'praktikan' &&
        state.currentUser?.peran === 'praktikan' &&
        state.currentUser.id === incoming.id &&
        incoming.kelasIds === undefined &&
        state.currentUser.kelasIds !== undefined
      ) {
        incoming = {
          ...incoming,
          kelasId: state.currentUser.kelasId,
          kelasIds: state.currentUser.kelasIds,
          nim:
            incoming.nim === '-' && state.currentUser.nim !== '-'
              ? state.currentUser.nim
              : incoming.nim,
        };
      } else if (
        incoming.peran === 'asprak' &&
        state.currentUser?.peran === 'asprak' &&
        state.currentUser.id === incoming.id &&
        incoming.assignedLabIds === undefined &&
        state.currentUser.assignedLabIds !== undefined
      ) {
        incoming = {
          ...incoming,
          assignedLabIds: state.currentUser.assignedLabIds,
        };
      }

      const sudahAda = state.pengguna.some((u) => u.id === incoming.id);
      if (sudahAda && isSamePengguna(state.currentUser, incoming)) {
        return state;
      }
      return {
        ...state,
        currentUser: incoming,
        ...(state.currentUser?.id !== incoming.id ? { approvedLeaves: [], leaveRequests: undefined } : {}),
        pengguna: sudahAda
          ? state.pengguna.map((u) => (u.id === incoming.id ? incoming : u))
          : [...state.pengguna, incoming],
      };
    }
    case 'KELUAR':
      return state.currentUser === null ? state : { ...state, currentUser: null, approvedLeaves: [], leaveRequests: undefined };
    case 'BUKA_SESI':
    case 'TUTUP_SESI': {
      const sesi = state.sesi.find((s) => s.id === action.sesiId);
      const buka = action.type === 'BUKA_SESI';
      if (!sesi || !canActOnClassInReducer(state.currentUser, sesi.kelasId)) {
        return state;
      }
      if (sesi.status !== (buka ? 'dijadwalkan' : 'dibuka')) return state;
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
        ...(action.lateStatus ? { lateStatus: action.lateStatus } : {}),
        ...(typeof action.lateMinutes === 'number'
          ? { lateMinutes: action.lateMinutes }
          : {}),
        ...(action.graceDeadlineAt ? { graceDeadlineAt: action.graceDeadlineAt } : {}),
        ...(action.fineId !== undefined ? { fineId: action.fineId } : {}),
      };
      return { ...state, presensi: [...state.presensi, baru] };
    }
    case 'TAMBAH_KELAS': {
      if (!canManageClassesAndMembers(state.currentUser)) return state;
      if (!action.kelas.nama.trim()) return state;
      if (state.kelas.some((k) => k.id === action.kelas.id)) return state;
      return { ...state, kelas: [...state.kelas, action.kelas] };
    }
    case 'UBAH_KELAS': {
      if (!canManageClassesAndMembers(state.currentUser)) return state;
      if (!action.kelas.nama.trim()) return state;
      return {
        ...state,
        kelas: state.kelas.map((k) =>
          k.id === action.kelas.id ? action.kelas : k,
        ),
      };
    }
    case 'HAPUS_KELAS': {
      if (!canManageClassesAndMembers(state.currentUser)) return state;
      return {
        ...state,
        kelas: state.kelas.filter((k) => k.id !== action.kelasId),
      };
    }
    case 'TAMBAH_PESERTA': {
      if (!canManageClassesAndMembers(state.currentUser)) return state;
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
      if (!canManageClassesAndMembers(state.currentUser)) return state;
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
      if (!canManageClassesAndMembers(state.currentUser)) return state;
      return {
        ...state,
        pengguna: state.pengguna.filter(
          (u) => !(u.peran === 'praktikan' && u.id === action.praktikanId),
        ),
      };
    }
    case 'TAMBAH_JADWAL': {
      if (!canActOnClassInReducer(state.currentUser, action.jadwal.kelasId)) {
        return state;
      }
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      if (currentJadwal.some((j) => j.id === action.jadwal.id)) return state;
      return { ...state, jadwal: [...currentJadwal, action.jadwal] };
    }
    case 'UBAH_JADWAL': {
      if (!canActOnClassInReducer(state.currentUser, action.jadwal.kelasId)) {
        return state;
      }
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      return {
        ...state,
        jadwal: currentJadwal.map((j) =>
          j.id === action.jadwal.id ? action.jadwal : j,
        ),
      };
    }
    case 'HAPUS_JADWAL': {
      const currentJadwal = state.jadwal ?? DEFAULT_SCHEDULES;
      const target = currentJadwal.find((j) => j.id === action.jadwalId);
      if (target && !canActOnClassInReducer(state.currentUser, target.kelasId)) {
        return state;
      }
      if (!isStaffUser(state.currentUser)) return state;
      return {
        ...state,
        jadwal: currentJadwal.filter((j) => j.id !== action.jadwalId),
      };
    }
    case 'TAMBAH_SESI': {
      if (!canActOnClassInReducer(state.currentUser, action.sesi.kelasId)) {
        return state;
      }
      if (!action.sesi.topik.trim() || !action.sesi.ruang.trim()) return state;
      if (state.sesi.some((s) => s.id === action.sesi.id)) return state;
      return { ...state, sesi: [...state.sesi, action.sesi] };
    }
    case 'UBAH_SESI': {
      if (!canActOnClassInReducer(state.currentUser, action.sesi.kelasId)) {
        return state;
      }
      if (!action.sesi.topik.trim() || !action.sesi.ruang.trim()) return state;
      return {
        ...state,
        sesi: state.sesi.map((s) => (s.id === action.sesi.id ? action.sesi : s)),
      };
    }
    case 'HAPUS_SESI': {
      const target = state.sesi.find((s) => s.id === action.sesiId);
      if (target && !canActOnClassInReducer(state.currentUser, target.kelasId)) {
        return state;
      }
      if (!isStaffUser(state.currentUser)) return state;
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
    labTarget?: LabGeofenceTarget,
  ) => Promise<Presensi>;
  simpanKelas: (input: { id?: string; nama: string; praktikumId?: string }) => Promise<Kelas>;
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
    labId?: string;
    topik: string;
  }) => Promise<Jadwal>;
  hapusJadwal: (jadwalId: string) => Promise<void>;
  simpanSesi: (input: {
    id?: string;
    kelasId: string;
    scheduleId?: string;
    courseId?: string;
    labId?: string;
    labNama?: string;
    labCoordinates?: { latitude: number; longitude: number };
    radiusMeters?: number;
    gracePeriodMinutes?: number;
    lateFineAmount?: number;
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
  approvedLeaves: [],
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
  const assignedLabsKey =
    state.currentUser?.peran === 'asprak'
      ? (state.currentUser.assignedLabIds ?? []).slice().sort().join(',')
      : '';

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
          payload: { pengguna: isStaffUser(cur) ? [cur, ...members] : members },
        });
      },
      onSchedules: (jadwal) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { jadwal } });
      },
      onSessions: (sesi) => {
        rawDispatch({ type: 'SYNC_FIRESTORE', payload: { sesi } });
      },
      onAssignedLabs: (labIds) => {
        const cur = currentUserRef.current;
        if (cur?.peran === 'asprak') {
          rawDispatch({
            type: 'SYNC_FIRESTORE',
            payload: {
              currentUser: {
                ...cur,
                assignedLabIds: labIds,
              },
            },
          });
        }
      },
      onError: (msg) => setError(msg),
    });

    return unsub;
  }, [isRemote, currentUserId, currentUserRole]);

  const managedLeaveClassesKey = state.currentUser?.peran === 'aslab'
    ? JSON.stringify(state.kelas
      .filter((kelas) => state.currentUser?.peran === 'aslab'
        && state.currentUser.managedCourseIds?.includes(kelas.praktikumId))
      .map((kelas) => kelas.id).sort())
    : '[]';

  useEffect(() => {
    const activeUser = currentUserRef.current;
    if (!isRemote || !activeUser || activeUser.id !== currentUserId) return;
    const actor = mapPenggunaToPermissionActor(activeUser);
    if (!actor) return;
    if (actor.role === 'aslab') actor.classIds = JSON.parse(managedLeaveClassesKey) as string[];
    if (actor.role === 'asprak') actor.assignedLabIds = assignedLabsKey.split(',').filter(Boolean);
    rawDispatch({ type: 'SYNC_FIRESTORE', payload: { approvedLeaves: [], leaveRequests: undefined } });

    const onData = (requests: LeaveRequest[]) => {
      const approvedLeaves: ApprovedLeaveRef[] = requests
        .filter((request) => request.status === 'approved')
        .map(({ id, uid, sessionId, classId, praktikanName, praktikanNim, reason, decidedAt }) => ({
          id, uid, sessionId, classId, praktikanName, praktikanNim, reason, decidedAt,
        }));
      rawDispatch({ type: 'SYNC_FIRESTORE', payload: { approvedLeaves, leaveRequests: requests } });
    };
    const onError = (error: Error) => {
      onData([]);
      setError('Gagal memuat data izin: ' + error.message);
    };
    const repository = getActivePermissionRepository();
    const subscribe = actor.role === 'praktikan' ? subscribePraktikanLeaves : subscribeAsistenLeaves;
    return subscribe(actor, onData, onError, repository);
  }, [isRemote, currentUserId, currentUserRole, assignedLabsKey, managedLeaveClassesKey]);

  useEffect(() => {
    const actor = currentUserRef.current;
    if (
      !isRemote ||
      !currentUserId ||
      !canManageClassesAndMembers(actor) ||
      actor?.id !== currentUserId
    ) {
      return;
    }

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
    async (
      sesiId: string,
      catatan?: string,
      geo?: GeoAttendancePayload,
      labTarget?: LabGeofenceTarget,
    ) =>
      runAsync(async () => {
        if (!state.currentUser || state.currentUser.peran !== 'praktikan') {
          throw new Error('Hanya praktikan yang dapat melakukan presensi.');
        }
        const localSesi = state.sesi.find((s) => s.id === sesiId) ?? null;
        const alreadyAttendedLocally = state.presensi.some(
          (p) => p.sesiId === sesiId && p.praktikanId === state.currentUser?.id,
        );
        const resolvedLabTarget = labTarget ?? resolveSessionLabTarget(localSesi);
        const record = await submitAttendanceToFirestore(state.currentUser, {
          sesiId,
          praktikanId: state.currentUser.id,
          catatan,
          localSesi,
          alreadyAttendedLocally,
          geo,
          labTarget: resolvedLabTarget,
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
          lateStatus: record.lateStatus,
          lateMinutes: record.lateMinutes,
          graceDeadlineAt: record.graceDeadlineAt,
          fineId: record.fineId,
        });
        return record;
      }),
    [runAsync, state.currentUser, state.presensi, state.sesi],
  );

  const simpanKelas = useCallback(
    async (input: { id?: string; nama: string; praktikumId?: string }) =>
      runAsync(async () => {
        const existing = state.kelas.find((kelas) => kelas.id === input.id);
        const managed = state.currentUser?.peran === 'aslab' ? state.currentUser.managedCourseIds : undefined;
        const praktikumId = existing?.praktikumId ?? input.praktikumId ?? (managed?.length === 1 ? managed[0] : undefined);
        const saved = await saveClassToFirestore(state.currentUser, { ...input, praktikumId });
        rawDispatch({
          type: input.id ? 'UBAH_KELAS' : 'TAMBAH_KELAS',
          kelas: saved,
        });
        return saved;
      }),
    [runAsync, state.currentUser, state.kelas],
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
      labId?: string;
      topik: string;
    }) =>
      runAsync(async () => {
        const isUpdate = Boolean(input.id?.trim());
        const praktikumId = state.kelas.find((kelas) => kelas.id === input.kelasId)?.praktikumId;
        const saved = await saveScheduleToFirestore(state.currentUser, { ...input, praktikumId });
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
    [runAsync, state.currentUser, state.kelas, state.pengguna],
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
      courseId?: string;
      labId?: string;
      labNama?: string;
      labCoordinates?: { latitude: number; longitude: number };
      radiusMeters?: number;
      gracePeriodMinutes?: number;
      lateFineAmount?: number;
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
        const praktikumId = state.kelas.find((kelas) => kelas.id === input.kelasId)?.praktikumId;
        const saved = await saveSessionToFirestore(state.currentUser, { ...input, praktikumId });
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
    [isRemote, runAsync, state.currentUser, state.kelas, state.pengguna, state.sesi],
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
        const { pengguna, kelas, jadwal, sesi, presensi, approvedLeaves } =
          remoteInitialState;
        rawDispatch({
          type: 'SYNC_FIRESTORE',
          payload: { pengguna, kelas, jadwal, sesi, presensi, approvedLeaves },
        });
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
