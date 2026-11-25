export interface LaboratoryCoordinates {
  latitude: number;
  longitude: number;
}

export interface LaboratoryInput extends LaboratoryCoordinates {
  nama: string;
  kode: string;
  gedung: string;
  radiusMeters: number;
  kapasitas: number;
  gracePeriodMinutes?: number;
  lateFineAmount?: number;
  courseId?: string;
  courseNama?: string;
}

export interface Laboratory extends LaboratoryInput {
  id: string;
  aktif: boolean;
  gracePeriodMinutes?: number;
  lateFineAmount?: number;
  courseId?: string;
  courseNama?: string;
  asprakUids?: string[];
  updatedBy?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}
