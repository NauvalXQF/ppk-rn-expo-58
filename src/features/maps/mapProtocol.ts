import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';
import { validCoordinates, validRadius } from '../../services/maps/laboratories';
import type { LabPreviewProps, LaboratoryMapProps } from './mapTypes';

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
export const MAP_VERSION = 1;
const MAX_PAYLOAD_LENGTH = 512 * 1024;
const MAX_LABEL_LENGTH = 256;

type MapLab = Pick<Laboratory, 'id' | 'nama' | 'kode' | 'gedung' | 'latitude' | 'longitude' | 'radiusMeters'> & {
  ongoing: boolean;
};

type MapPosition = LaboratoryCoordinates & { heading: number | null; assistant: boolean };

export interface MapState {
  labs: readonly MapLab[];
  location: MapPosition | null;
  selection: string | null;
}

export type MapCommand =
  | { type: 'snapshot'; data: MapState }
  | { type: 'labs'; data: MapState['labs'] }
  | { type: 'location'; data: MapState['location'] }
  | { type: 'selection'; data: MapState['selection'] }
  | { type: 'recenter'; data: LaboratoryCoordinates };

export type MapEvent =
  | { type: 'ready' }
  | { type: 'labSelected'; id: string }
  | { type: 'mapError'; code: 'tiles' | 'renderer' };

type Envelope = { version: typeof MAP_VERSION; instance: string; sequence: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1500 && value.trim().length > 0 &&
    !/[\x00-\x1f\x7f/]/u.test(value);
}

export function isMapPoint(value: unknown): value is LaboratoryCoordinates {
  return isRecord(value) && typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' && validCoordinates(value.latitude, value.longitude);
}

function validHeading(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value < 360;
}

function isLocation(value: unknown): value is MapState['location'] {
  return value === null || (isRecord(value) && (value.heading === null || validHeading(value.heading)) &&
    typeof value.assistant === 'boolean' && isMapPoint(value));
}

function isLab(value: unknown): value is MapLab {
  return isRecord(value) && validId(value.id) && typeof value.ongoing === 'boolean' &&
    [value.nama, value.kode, value.gedung].every(
      (label) => typeof label === 'string' && label.length <= MAX_LABEL_LENGTH,
    ) && typeof value.radiusMeters === 'number' && validRadius(value.radiusMeters) && isMapPoint(value);
}

function isLabList(value: unknown): value is MapState['labs'] {
  return Array.isArray(value) && value.every(isLab) &&
    new Set(value.map(({ id }) => id)).size === value.length;
}

function isSelection(value: unknown): value is MapState['selection'] {
  return value === null || validId(value);
}

export function mapLabs(
  laboratories: LaboratoryMapProps['laboratories'],
  activeLabIds: LaboratoryMapProps['activeLabIds'],
): MapState['labs'] {
  return laboratories
    .filter((lab) => lab.aktif && validId(lab.id) && isMapPoint(lab) && validRadius(lab.radiusMeters))
    .map(({ id, nama, kode, gedung, latitude, longitude, radiusMeters }) => ({
      id, nama: nama.slice(0, MAX_LABEL_LENGTH), kode: kode.slice(0, MAX_LABEL_LENGTH),
      gedung: gedung.slice(0, MAX_LABEL_LENGTH), latitude, longitude, radiusMeters,
      ongoing: activeLabIds.has(id),
    }));
}

export function mapLocation(
  point: LaboratoryMapProps['userLocation'],
  assistant: boolean,
): MapState['location'] {
  if (!point || !isMapPoint(point)) return null;
  return {
    latitude: point.latitude, longitude: point.longitude,
    heading: validHeading(point.heading) ? point.heading : null, assistant,
  };
}

export function previewLabs({ point, radius }: LabPreviewProps): MapState['labs'] {
  if (!isMapPoint(point) || !validRadius(radius)) return [];
  return [{
    id: 'preview', nama: 'Lokasi laboratorium', kode: 'Lab', gedung: '',
    latitude: point.latitude, longitude: point.longitude, radiusMeters: radius, ongoing: false,
  }];
}

export function encodeMapMessage(message: MapCommand | MapEvent, instance: string, sequence: number) {
  const encoded = JSON.stringify({ ...message, version: MAP_VERSION, instance, sequence });
  return encoded.length <= MAX_PAYLOAD_LENGTH ? encoded : undefined;
}

function readEnvelope(raw: unknown, instance: string, previous: number) {
  if (typeof raw !== 'string' || raw.length > MAX_PAYLOAD_LENGTH) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(value) || value.version !== MAP_VERSION || value.instance !== instance ||
    typeof value.sequence !== 'number' || !Number.isSafeInteger(value.sequence) ||
    value.sequence <= previous) return;
  return { value, envelope: { version: MAP_VERSION, instance, sequence: value.sequence } as Envelope };
}

export function readMapCommand(raw: unknown, instance: string, previous: number): (Envelope & MapCommand) | undefined {
  const packet = readEnvelope(raw, instance, previous);
  if (!packet) return;
  const { value: { type, data }, envelope } = packet;
  switch (type) {
    case 'snapshot':
      if (isRecord(data) && isLabList(data.labs) && isLocation(data.location) && isSelection(data.selection)) {
        return { ...envelope, type, data: { labs: data.labs, location: data.location, selection: data.selection } };
      }
      return;
    case 'labs':
      if (isLabList(data)) return { ...envelope, type, data };
      return;
    case 'location':
      if (isLocation(data)) return { ...envelope, type, data };
      return;
    case 'selection':
      if (isSelection(data)) return { ...envelope, type, data };
      return;
    case 'recenter':
      if (isMapPoint(data)) return { ...envelope, type, data };
      return;
  }
}

export function readMapEvent(raw: unknown, instance: string, previous: number): (Envelope & MapEvent) | undefined {
  const packet = readEnvelope(raw, instance, previous);
  if (!packet) return;
  const { value: { type, id, code }, envelope } = packet;
  switch (type) {
    case 'ready':
      return { ...envelope, type };
    case 'labSelected':
      if (validId(id)) return { ...envelope, type, id };
      return;
    case 'mapError':
      if (code === 'tiles' || code === 'renderer') return { ...envelope, type, code };
      return;
  }
}

export function mapUpdates(previous: MapState | undefined, next: MapState): MapCommand[] {
  if (!previous) return [{ type: 'snapshot', data: next }];
  const changes: MapCommand[] = [];
  if (previous.labs !== next.labs) changes.push({ type: 'labs', data: next.labs });
  if (previous.location !== next.location) changes.push({ type: 'location', data: next.location });
  if (previous.selection !== next.selection) changes.push({ type: 'selection', data: next.selection });
  return changes;
}
