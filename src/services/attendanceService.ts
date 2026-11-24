import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  evaluateGeofence,
  isValidCoordinate,
  resolveSessionLabTarget,
} from '@/services/location/geofenceService';
import { getDb, toStatusSesi } from '@/services/practicumService';
import { isPraktikanInClass } from '@/store/selectors';
import { evaluateSessionScheduleWindow } from '@/utils/date';
import type {
  GeoAttendancePayload,
  GeoPoint,
  LabGeofenceTarget,
} from '@/types/geoAttendance';
import type { Pengguna, Presensi, Sesi } from '@/types/models';

export interface SubmitAttendanceInput {
  sesiId: string;
  praktikanId: string;
  catatan?: string;
  waktuPresensi?: string;
  localSesi?: Sesi | null;
  alreadyAttendedLocally?: boolean;
  geo?: GeoAttendancePayload;
  labTarget?: LabGeofenceTarget;
}

function resolveTargetFromFirestoreSession(
  sessionData: Record<string, unknown>,
  fallbackTarget: LabGeofenceTarget,
): { labNama: string; coordinates: GeoPoint; radiusMeters: number } {
  const rawCoords = sessionData.labCoordinates as Partial<GeoPoint> | undefined;
  const rawRadius = sessionData.radiusMeters;
  const radiusMeters =
    typeof rawRadius === 'number' && Number.isFinite(rawRadius) && rawRadius > 0
      ? rawRadius
      : fallbackTarget.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;
  const labNama =
    typeof sessionData.labNama === 'string' && sessionData.labNama.trim()
      ? sessionData.labNama.trim()
      : typeof sessionData.ruang === 'string' && sessionData.ruang.trim()
        ? sessionData.ruang.trim()
        : fallbackTarget.labNama;

  if (isValidCoordinate(rawCoords)) {
    return {
      labNama,
      coordinates: {
        latitude: rawCoords.latitude,
        longitude: rawCoords.longitude,
      },
      radiusMeters,
    };
  }

  return {
    labNama,
    coordinates: fallbackTarget.coordinates,
    radiusMeters,
  };
}

export async function submitAttendanceToFirestore(
  actor: Pengguna | null,
  input: SubmitAttendanceInput,
): Promise<Presensi> {
  if (!actor || actor.peran !== 'praktikan') {
    throw new Error('Akses ditolak: Hanya praktikan yang dapat melakukan presensi.');
  }
  if (actor.id !== input.praktikanId) {
    throw new Error('Identitas praktikan tidak sesuai dengan akun yang sedang login.');
  }
  const sesiId = input.sesiId.trim();
  if (!sesiId) {
    throw new Error('ID sesi tidak valid.');
  }

  const trimmedCatatan = input.catatan?.trim() || undefined;
  if (trimmedCatatan && trimmedCatatan.length > 120) {
    throw new Error('Catatan maksimal 120 karakter.');
  }

  if (!input.geo) {
    throw new Error(
      'Verifikasi lokasi GPS wajib dilakukan sebelum mengirim presensi.',
    );
  }
  if (
    !isValidCoordinate({
      latitude: input.geo.latitude,
      longitude: input.geo.longitude,
    })
  ) {
    throw new Error('Koordinat GPS presensi tidak valid.');
  }

  const waktuPresensi = input.waktuPresensi ?? new Date().toISOString();
  const presensiDate = new Date(waktuPresensi);

  // Validasi lokal cepat sebelum transaksi Firestore
  if (input.localSesi) {
    if (input.localSesi.status !== 'dibuka') {
      throw new Error('Presensi ditolak: Sesi belum dibuka atau sudah ditutup.');
    }
    if (!isPraktikanInClass(actor, input.localSesi.kelasId)) {
      throw new Error('Presensi ditolak: Sesi ini bukan untuk kelas Anda.');
    }
    const scheduleCheck = evaluateSessionScheduleWindow(input.localSesi, presensiDate);
    if (!scheduleCheck.isWithinSchedule) {
      throw new Error(
        scheduleCheck.message ?? 'Presensi ditolak: Di luar jadwal sesi yang ditentukan.',
      );
    }
  }
  if (input.alreadyAttendedLocally) {
    throw new Error('Presensi ganda ditolak: Anda sudah tercatat hadir pada sesi ini.');
  }

  const fallbackTarget = input.labTarget ?? resolveSessionLabTarget(input.localSesi);
  const localVerification = evaluateGeofence(
    {
      latitude: input.geo.latitude,
      longitude: input.geo.longitude,
      accuracy: input.geo.accuracy,
    },
    fallbackTarget,
  );
  if (!localVerification.isWithinRadius) {
    throw new Error(localVerification.message);
  }

  const normalizedAccuracy =
    typeof input.geo.accuracy === 'number' && Number.isFinite(input.geo.accuracy)
      ? input.geo.accuracy
      : 0;

  let finalDistanceMeters = localVerification.distanceMeters;

  const db = getDb();
  if (db) {
    const sessionRef = doc(db, 'sessions', sesiId);
    // Sesuai data-model.md §2C: lokasi dokumen tetap sessions/{sessionId}/attendances/{auth.uid}
    const attendanceRef = doc(db, 'sessions', sesiId, 'attendances', actor.id);

    await runTransaction(db, async (tx) => {
      const [sessionSnap, attSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(attendanceRef),
      ]);

      if (!sessionSnap.exists()) {
        throw new Error('Sesi praktikum tidak ditemukan di database.');
      }

      const sessionData = sessionSnap.data() as Record<string, unknown>;
      const status = toStatusSesi(
        sessionData.status,
        sessionData.openedAt,
        sessionData.closedAt,
      );
      if (status !== 'dibuka') {
        throw new Error('Presensi ditolak: Sesi tidak sedang dibuka.');
      }

      const sessionClassId = String(
        sessionData.classId ?? sessionData.kelasId ?? actor.kelasId,
      );
      if (!isPraktikanInClass(actor, sessionClassId)) {
        throw new Error('Presensi ditolak: Anda tidak terdaftar di kelas sesi ini.');
      }

      const serverScheduleCheck = evaluateSessionScheduleWindow(
        {
          tanggal: typeof sessionData.tanggal === 'string' ? sessionData.tanggal : undefined,
          jamMulai: typeof sessionData.jamMulai === 'string' ? sessionData.jamMulai : undefined,
          jamSelesai: typeof sessionData.jamSelesai === 'string' ? sessionData.jamSelesai : undefined,
        },
        presensiDate,
      );
      if (!serverScheduleCheck.isWithinSchedule) {
        throw new Error(
          serverScheduleCheck.message ?? 'Presensi ditolak: Di luar jadwal sesi yang ditentukan.',
        );
      }

      if (attSnap.exists()) {
        throw new Error(
          'Presensi ganda ditolak: Anda sudah melakukan presensi pada sesi ini.',
        );
      }

      const serverTarget = resolveTargetFromFirestoreSession(
        sessionData,
        fallbackTarget,
      );
      const serverVerification = evaluateGeofence(
        {
          latitude: input.geo!.latitude,
          longitude: input.geo!.longitude,
          accuracy: normalizedAccuracy,
        },
        serverTarget,
      );
      if (!serverVerification.isWithinRadius) {
        throw new Error(serverVerification.message);
      }

      finalDistanceMeters = serverVerification.distanceMeters;

      // Sesuai data-model.md §2C: uid, sessionId, classId, status: 'hadir', recordedAt,
      // latitude, longitude, accuracy, distanceMeters, geofenceStatus, catatan
      tx.set(attendanceRef, {
        uid: actor.id,
        sessionId: sesiId,
        classId: sessionClassId,
        status: 'hadir',
        recordedAt: serverTimestamp(),
        waktuPresensi,
        latitude: input.geo!.latitude,
        longitude: input.geo!.longitude,
        accuracy: normalizedAccuracy,
        distanceMeters: finalDistanceMeters,
        geofenceStatus: 'in_radius',
        catatan: trimmedCatatan ?? null,
      });
    });
  }

  return {
    id: `pres-${sesiId}-${actor.id}`,
    sesiId,
    praktikanId: actor.id,
    waktuPresensi,
    catatan: trimmedCatatan,
    latitude: input.geo.latitude,
    longitude: input.geo.longitude,
    accuracy: normalizedAccuracy,
    distanceMeters: finalDistanceMeters,
    geofenceStatus: 'in_radius',
  };
}

function parseTimestampToIso(rawRecordedAt: unknown, fallbackIso?: unknown): string {
  if (typeof fallbackIso === 'string' && fallbackIso.length > 0) {
    return fallbackIso;
  }
  if (
    rawRecordedAt &&
    typeof rawRecordedAt === 'object' &&
    'toDate' in rawRecordedAt &&
    typeof (rawRecordedAt as { toDate: () => Date }).toDate === 'function'
  ) {
    return (rawRecordedAt as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapAttendanceDoc(
  sesiId: string,
  docId: string,
  data: Record<string, unknown>,
): Presensi {
  const uid = String(data.uid ?? data.praktikanId ?? docId);
  return {
    id: `pres-${sesiId}-${uid}`,
    sesiId,
    praktikanId: uid,
    waktuPresensi: parseTimestampToIso(data.recordedAt, data.waktuPresensi),
    catatan: data.catatan ? String(data.catatan) : undefined,
    latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
    longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    accuracy: typeof data.accuracy === 'number' ? data.accuracy : undefined,
    distanceMeters:
      typeof data.distanceMeters === 'number' ? data.distanceMeters : undefined,
    geofenceStatus:
      data.geofenceStatus === 'in_radius' || data.geofenceStatus === 'bypass_qr'
        ? data.geofenceStatus
        : undefined,
  };
}

export function subscribeAttendancesRealtime(
  currentUser: Pengguna | null,
  sessionIds: string[],
  onUpdate: (presensi: Presensi[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const db = getDb();
  if (!db || !currentUser || sessionIds.length === 0) return () => {};

  const bySession = new Map<string, Presensi[]>();
  const unsubs: Unsubscribe[] = [];

  const emitAll = () => {
    const all: Presensi[] = [];
    for (const list of bySession.values()) {
      all.push(...list);
    }
    onUpdate(all);
  };

  for (const sesiId of sessionIds) {
    if (currentUser.peran === 'asisten') {
      const colRef = collection(db, 'sessions', sesiId, 'attendances');
      unsubs.push(
        onSnapshot(
          colRef,
          (snap) => {
            const items = snap.docs.map((d) =>
              mapAttendanceDoc(sesiId, d.id, d.data() as Record<string, unknown>),
            );
            bySession.set(sesiId, items);
            emitAll();
          },
          (err) => {
            onError(`Gagal memuat rekap presensi sesi ${sesiId}: ${err.message}`);
          },
        ),
      );
    } else {
      const ownDocRef = doc(
        db,
        'sessions',
        sesiId,
        'attendances',
        currentUser.id,
      );
      unsubs.push(
        onSnapshot(
          ownDocRef,
          (snap) => {
            if (!snap.exists()) {
              bySession.set(sesiId, []);
            } else {
              bySession.set(sesiId, [
                mapAttendanceDoc(
                  sesiId,
                  snap.id,
                  snap.data() as Record<string, unknown>,
                ),
              ]);
            }
            emitAll();
          },
          (err) => {
            onError(`Gagal memuat status presensi sesi ${sesiId}: ${err.message}`);
          },
        ),
      );
    }
  }

  return () => {
    for (const u of unsubs) u();
  };
}
