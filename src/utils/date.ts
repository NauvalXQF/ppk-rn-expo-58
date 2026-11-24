export function formatTanggal(tanggal: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${tanggal}T00:00:00`));
}

export function formatJam(jam: string): string {
  return jam.replace(':', '.');
}

export function formatWaktuPresensi(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(iso))
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

  const start = new Date(`${tanggal}T${jamMulai}:00`);
  const end = new Date(`${tanggal}T${jamSelesai}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { isWithinSchedule: true, status: 'INVALID' };
  }

  const nowMs = now.getTime();
  if (nowMs < start.getTime()) {
    return {
      isWithinSchedule: false,
      status: 'BEFORE_START',
      message: `Presensi belum dimulai. Jadwal sesi: ${formatTanggal(tanggal)}, ${formatJam(jamMulai)}–${formatJam(jamSelesai)} WIB.`,
    };
  }

  if (nowMs > end.getTime()) {
    return {
      isWithinSchedule: false,
      status: 'AFTER_END',
      message: `Waktu presensi telah berakhir sesuai jadwal (${formatTanggal(tanggal)}, ${formatJam(jamMulai)}–${formatJam(jamSelesai)} WIB).`,
    };
  }

  return { isWithinSchedule: true, status: 'WITHIN_WINDOW' };
}
