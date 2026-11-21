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
}

export interface Laboratory extends LaboratoryInput {
  id: string;
  aktif: boolean;
}
