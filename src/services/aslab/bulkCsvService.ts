import { Platform, Share } from 'react-native';
import {
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LAB_RADIUS,
  DEFAULT_LATE_FINE_AMOUNT,
  validCoordinates,
  validGracePeriod,
  validLateFineAmount,
  validRadius,
} from '@/services/maps/laboratories';

export type BulkType = 'laboratorium' | 'praktikan' | 'asprak';

export interface BulkRowItem<T = Record<string, string>> {
  id: string;
  index: number;
  status: 'accepted' | 'denied';
  data: T;
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
}

export type LabRowData = {
  nama: string;
  kode: string;
  gedung: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  gracePeriodMinutes: string;
  lateFineAmount: string;
  kapasitas: string;
};

export type PraktikanRowData = {
  nim: string;
  nama: string;
  email: string;
};

export type AsprakRowData = {
  nip: string;
  nama: string;
  email: string;
};

export const BULK_TEMPLATES: Record<BulkType, { filename: string; content: string }> = {
  laboratorium: {
    filename: 'template-bulk-laboratorium.csv',
    content: `nama,kode,gedung,latitude,longitude,radiusMeters,gracePeriodMinutes,lateFineAmount,kapasitas
Lab PPK A,PPK-A,Gedung F Lt. 3 R.301,-7.952640,112.614420,30,15,10000,35
Lab PPK B,PPK-B,Gedung F Lt. 3 R.302,-7.952710,112.614510,30,15,10000,35`,
  },
  praktikan: {
    filename: 'template-bulk-praktikan.csv',
    content: `nim,nama,email
245150200111001,Andi Pratama,andi.pratama@student.ac.id
245150200111002,Siti Rahmawati,siti.rahma@student.ac.id`,
  },
  asprak: {
    filename: 'template-bulk-asprak.csv',
    content: `nip,nama,email
225150200111010,Rina Kusuma,rina.asprak@student.ac.id
225150200111015,Doni Saputra,doni.asprak@student.ac.id`,
  },
};

export function getBulkCsvTemplate(type: BulkType): string {
  return BULK_TEMPLATES[type].content;
}

export function getBulkCsvFilename(type: BulkType): string {
  return BULK_TEMPLATES[type].filename;
}

export async function downloadBulkCsvTemplate(type: BulkType): Promise<boolean> {
  const { filename, content } = BULK_TEMPLATES[type];
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  try {
    await Share.share({
      title: filename,
      message: content,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tokenizes CSV string into array of rows with array of cell values.
 * Handles CRLF, LF, commas, and quoted cells.
 */
export function parseRawCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function validateLabRow(data: LabRowData): Partial<Record<keyof LabRowData, string>> {
  const errors: Partial<Record<keyof LabRowData, string>> = {};

  if (!data.nama.trim()) errors.nama = 'Nama laboratorium wajib diisi';
  if (!data.kode.trim()) errors.kode = 'Kode lab wajib diisi';
  if (!data.gedung.trim()) errors.gedung = 'Gedung dan lantai wajib diisi';

  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (!data.latitude.trim() || isNaN(lat) || !validCoordinates(lat, lng)) {
    errors.latitude = 'Latitude harus antara -90 dan 90';
  }
  if (!data.longitude.trim() || isNaN(lng) || !validCoordinates(lat, lng)) {
    errors.longitude = 'Longitude harus antara -180 dan 180';
  }

  const radius = Number(data.radiusMeters);
  if (!data.radiusMeters.trim() || isNaN(radius) || !validRadius(radius)) {
    errors.radiusMeters = 'Radius harus antara 10 dan 500 meter';
  }

  const kapasitas = Number(data.kapasitas);
  if (!data.kapasitas.trim() || isNaN(kapasitas) || !Number.isSafeInteger(kapasitas) || kapasitas < 1) {
    errors.kapasitas = 'Kapasitas harus bilangan bulat >= 1';
  }

  if (data.gracePeriodMinutes.trim()) {
    const grace = Number(data.gracePeriodMinutes);
    if (isNaN(grace) || !validGracePeriod(grace)) {
      errors.gracePeriodMinutes = 'Toleransi harus 0 - 120 menit';
    }
  }

  if (data.lateFineAmount.trim()) {
    const fine = Number(data.lateFineAmount);
    if (isNaN(fine) || !validLateFineAmount(fine)) {
      errors.lateFineAmount = 'Denda tidak boleh negatif';
    }
  }

  return errors;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePraktikanRow(data: PraktikanRowData): Partial<Record<keyof PraktikanRowData, string>> {
  const errors: Partial<Record<keyof PraktikanRowData, string>> = {};

  if (!data.nim.trim()) errors.nim = 'NIM wajib diisi';
  if (!data.nama.trim() || data.nama.trim().length < 2) errors.nama = 'Nama minimal 2 karakter';
  if (!data.email.trim() || !EMAIL_REGEX.test(data.email.trim())) errors.email = 'Format email tidak valid';

  return errors;
}

export function validateAsprakRow(data: AsprakRowData): Partial<Record<keyof AsprakRowData, string>> {
  const errors: Partial<Record<keyof AsprakRowData, string>> = {};

  if (!data.nip.trim()) errors.nip = 'NIP / identitas wajib diisi';
  if (!data.nama.trim() || data.nama.trim().length < 2) errors.nama = 'Nama minimal 2 karakter';
  if (!data.email.trim() || !EMAIL_REGEX.test(data.email.trim())) errors.email = 'Format email tidak valid';

  return errors;
}

export function parseBulkLaboratoriumCsv(csvText: string): BulkRowItem<LabRowData>[] {
  const rows = parseRawCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const namaIdx = headers.indexOf('nama');
  const kodeIdx = headers.indexOf('kode');
  const gedungIdx = headers.indexOf('gedung');
  const latIdx = headers.indexOf('latitude');
  const lngIdx = headers.indexOf('longitude');
  const radiusIdx = headers.indexOf('radiusmeters');
  const graceIdx = headers.indexOf('graceperiodminutes');
  const fineIdx = headers.indexOf('latefineamount');
  const kapIdx = headers.indexOf('kapasitas');

  return rows.slice(1).map((cols, idx) => {
    const data: LabRowData = {
      nama: namaIdx >= 0 ? cols[namaIdx] ?? '' : '',
      kode: kodeIdx >= 0 ? cols[kodeIdx] ?? '' : '',
      gedung: gedungIdx >= 0 ? cols[gedungIdx] ?? '' : '',
      latitude: latIdx >= 0 ? cols[latIdx] ?? '' : '',
      longitude: lngIdx >= 0 ? cols[lngIdx] ?? '' : '',
      radiusMeters: radiusIdx >= 0 && cols[radiusIdx] ? cols[radiusIdx] : String(DEFAULT_LAB_RADIUS),
      gracePeriodMinutes: graceIdx >= 0 && cols[graceIdx] ? cols[graceIdx] : String(DEFAULT_GRACE_PERIOD_MINUTES),
      lateFineAmount: fineIdx >= 0 && cols[fineIdx] ? cols[fineIdx] : String(DEFAULT_LATE_FINE_AMOUNT),
      kapasitas: kapIdx >= 0 ? cols[kapIdx] ?? '' : '',
    };
    const errors = validateLabRow(data);
    const isValid = Object.keys(errors).length === 0;

    return {
      id: `lab-row-${idx}`,
      index: idx + 1,
      status: 'accepted',
      data,
      errors,
      isValid,
    };
  });
}

export function parseBulkPraktikanCsv(csvText: string): BulkRowItem<PraktikanRowData>[] {
  const rows = parseRawCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const nimIdx = headers.indexOf('nim');
  const namaIdx = headers.indexOf('nama');
  const emailIdx = headers.indexOf('email');

  return rows.slice(1).map((cols, idx) => {
    const data: PraktikanRowData = {
      nim: nimIdx >= 0 ? cols[nimIdx] ?? '' : '',
      nama: namaIdx >= 0 ? cols[namaIdx] ?? '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] ?? '' : '',
    };
    const errors = validatePraktikanRow(data);
    const isValid = Object.keys(errors).length === 0;

    return {
      id: `praktikan-row-${idx}`,
      index: idx + 1,
      status: 'accepted',
      data,
      errors,
      isValid,
    };
  });
}

export function parseBulkAsprakCsv(csvText: string): BulkRowItem<AsprakRowData>[] {
  const rows = parseRawCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const nipIdx = headers.indexOf('nip');
  const namaIdx = headers.indexOf('nama');
  const emailIdx = headers.indexOf('email');

  return rows.slice(1).map((cols, idx) => {
    const data: AsprakRowData = {
      nip: nipIdx >= 0 ? cols[nipIdx] ?? '' : '',
      nama: namaIdx >= 0 ? cols[namaIdx] ?? '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] ?? '' : '',
    };
    const errors = validateAsprakRow(data);
    const isValid = Object.keys(errors).length === 0;

    return {
      id: `asprak-row-${idx}`,
      index: idx + 1,
      status: 'accepted',
      data,
      errors,
      isValid,
    };
  });
}
