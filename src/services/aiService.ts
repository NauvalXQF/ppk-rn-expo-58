import type { AiClassificationResult } from '@/features/permissions/types';
import {
  createSentimentClassifier,
  type SentimentPrediction,
} from '../../ai/sentiment.js';
import edomModel from '../../ai/model-edom.json';

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type LocalSentimentClassifier = (
  text: string,
) => SentimentPrediction | Promise<SentimentPrediction>;

export interface AiServiceConfig {
  /**
   * Mode klasifikasi AI.
   * Seluruh inferensi AI dijalankan secara lokal di perangkat menggunakan model EDOM.
   * Nilai `auto` atau `remote` dipertahankan untuk backward compatibility pemanggil lama,
   * namun tidak akan mengaktifkan inferensi via HTTP.
   */
  mode?: 'auto' | 'local' | 'remote';
  /** Opsi legacy endpoint URL. Diabaikan karena inferensi wajib lokal di perangkat. */
  endpointUrl?: string;
  method?: 'POST' | 'GET';
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  localClassifier?: LocalSentimentClassifier;
  /** Hook opsional untuk parsing response legacy. */
  buildRequestBody?: (reason: string) => Record<string, unknown>;
  parseResponse?: (payload: unknown) => {
    category: string;
    confidence?: number | null;
  } | null;
  now?: () => Date;
}

let cachedLocalClassifier: ((text: string) => SentimentPrediction) | null = null;

function getDefaultLocalClassifier(): (text: string) => SentimentPrediction {
  if (!cachedLocalClassifier) {
    const modelRecord = edomModel as Record<string, unknown> & {
      default?: Record<string, unknown>;
    };
    const resolvedModel = modelRecord.default ?? modelRecord;
    cachedLocalClassifier = createSentimentClassifier(resolvedModel);
  }
  return cachedLocalClassifier;
}

/**
 * Mengurai response JSON dari API klasifikasi AI secara defensif.
 * Dipertahankan untuk kompatibilitas fungsi publik/pengujian utilitas.
 */
export function parseAiClassificationResponse(payload: unknown): {
  category: string;
  confidence?: number | null;
} | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;

  const candidateFields = [
    nested.category,
    nested.kategori,
    nested.label,
    nested.prediction,
    nested.classification,
    record.category,
    record.kategori,
    record.label,
    record.prediction,
    record.classification,
  ];

  const rawCategory = candidateFields.find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

  if (!rawCategory) {
    return null;
  }

  const rawConfidence =
    nested.confidence ??
    nested.score ??
    nested.probability ??
    record.confidence ??
    record.score;

  const confidence =
    typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
      ? rawConfidence
      : null;

  return {
    category: rawCategory.trim(),
    confidence,
  };
}

function buildFailedResult(errorMessage: string): AiClassificationResult {
  return {
    status: 'failed',
    category: null,
    confidence: null,
    classifiedAt: null,
    errorMessage,
    reportedByClient: true,
  };
}

/**
 * Mengklasifikasi alasan izin menggunakan model sentimen lokal (ai/sentiment.js + ai/model-edom.json).
 * Seluruh inferensi berjalan secara lokal di perangkat tanpa melakukan request HTTP.
 * Konfigurasi legacy (endpointUrl, fetchImpl, mode remote/auto) diabaikan secara aman.
 * Tidak melempar error agar pengajuan izin tetap dapat disimpan jika klasifikasi gagal.
 */
export async function classifyLeaveReason(
  reason: string,
  config: AiServiceConfig = {},
): Promise<AiClassificationResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return buildFailedResult('Alasan izin kosong sehingga tidak dapat diklasifikasi.');
  }

  try {
    const classify = config.localClassifier ?? getDefaultLocalClassifier();
    const prediction = await classify(trimmedReason);

    if (!prediction || !prediction.label) {
      if (prediction?.status === 'empty_input') {
        return buildFailedResult(
          'Alasan izin kosong sehingga tidak dapat diklasifikasi.',
        );
      }
      return buildFailedResult(
        'Alasan belum dapat dianalisis oleh model AI lokal (kata belum dikenali). Gunakan kalimat yang lebih jelas; pengajuan tetap disimpan untuk ditinjau asisten.',
      );
    }

    const timestamp = (config.now ? config.now() : new Date()).toISOString();

    return {
      status: 'completed',
      category: prediction.label.trim(),
      // Model EDOM LinearSVC memakai decision margin, bukan probabilitas terkalibrasi 0..1.
      confidence: null,
      classifiedAt: timestamp,
      errorMessage: null,
      reportedByClient: true,
      experimental: Boolean(prediction.experimental),
    };
  } catch {
    return buildFailedResult(
      'Gagal menjalankan model AI lokal. Pengajuan tetap disimpan untuk ditinjau asisten.',
    );
  }
}

