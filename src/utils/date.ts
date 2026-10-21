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

