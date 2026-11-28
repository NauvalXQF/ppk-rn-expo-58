export const WIB_TIME_ZONE = 'Asia/Jakarta';
const WIB_OFFSET_MS = 7 * 60 * 60_000;

export function parseWibDateTimeMs(
  tanggal?: string,
  jam?: string,
): number | null {
  const cleanTanggal = tanggal?.trim();
  const cleanJam = jam?.trim();
  if (!cleanTanggal || !cleanJam) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanTanggal);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(cleanJam);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const ms = Date.parse(`${cleanTanggal}T${cleanJam}:00+07:00`);
  return Number.isNaN(ms) ? null : ms;
}

export function getTodayWibDateString(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export function formatTanggal(tanggal: string): string {
  const trimmed = tanggal?.trim();
  if (!trimmed) return '-';
  const parsedMs = parseWibDateTimeMs(trimmed, '00:00');
  const parsed = parsedMs !== null ? new Date(parsedMs) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: WIB_TIME_ZONE,
  }).format(parsed);
}

export function formatJam(jam: string): string {
  return (jam ?? '').replace(':', '.');
}

export function formatWaktuPresensi(iso: string): string {
  const trimmed = iso?.trim();
  if (!trimmed) return '-';
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: WIB_TIME_ZONE,
  })
    .format(parsed)
    .replace(':', '.');
}

export interface SessionScheduleCheck {
  isWithinSchedule: boolean;
  status: 'BEFORE_START' | 'WITHIN_WINDOW' | 'AFTER_END' | 'INVALID';
  message?: string;
}

export function evaluateSessionScheduleWindow(
  sesi: { tanggal?: string; jamMulai?: string; jamSelesai?: string },
  now: Date = new Date(),
): SessionScheduleCheck {
  const tanggal = sesi.tanggal?.trim();
  const jamMulai = sesi.jamMulai?.trim();
  const jamSelesai = sesi.jamSelesai?.trim();

  if (!tanggal || !jamMulai || !jamSelesai) {
    return { isWithinSchedule: true, status: 'INVALID' };
  }

  const startMs = parseWibDateTimeMs(tanggal, jamMulai);
  const endMs = parseWibDateTimeMs(tanggal, jamSelesai);
  if (startMs === null || endMs === null || endMs <= startMs) {
    return { isWithinSchedule: true, status: 'INVALID' };
  }

  const nowMs = now.getTime();
  if (nowMs < startMs) {
    return {
      isWithinSchedule: false,
      status: 'BEFORE_START',
      message: `Presensi belum dimulai. Jadwal sesi: ${formatTanggal(tanggal)}, ${formatJam(jamMulai)}–${formatJam(jamSelesai)} WIB.`,
    };
  }

  if (nowMs > endMs) {
    return {
      isWithinSchedule: false,
      status: 'AFTER_END',
      message: `Waktu presensi telah berakhir sesuai jadwal (${formatTanggal(tanggal)}, ${formatJam(jamMulai)}–${formatJam(jamSelesai)} WIB).`,
    };
  }

  return { isWithinSchedule: true, status: 'WITHIN_WINDOW' };
}
