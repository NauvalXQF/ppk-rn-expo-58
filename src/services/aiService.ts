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

export type LocalSentimentClassifier = (text: string) => SentimentPrediction;

export interface AiServiceConfig {
  /**
   * Mode pemilihan klasifikasi AI:
   * - `auto` (default): memakai HTTP endpoint jika `endpointUrl` / `EXPO_PUBLIC_AI_API_URL` diisi,
   *   atau otomatis menggunakan model sentimen lokal (`ai/sentiment.js` + `ai/model-edom.json`).
   * - `local`: memaksa inferensi model lokal di perangkat.
   * - `remote`: memaksa pemanggilan HTTP endpoint.
   */
  mode?: 'auto' | 'local' | 'remote';
  /**
   * URL endpoint API AI opsional jika pengajar menyediakan layanan HTTP.
   * Jangan pernah menyimpan API key rahasia di source code atau EXPO_PUBLIC_*.
   */
  endpointUrl?: string;
  method?: 'POST' | 'GET';
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  localClassifier?: LocalSentimentClassifier;
  /** Hook opsional untuk menyesuaikan payload request dengan dokumentasi API pengajar. */
  buildRequestBody?: (reason: string) => Record<string, unknown>;
  /** Hook opsional untuk menyesuaikan pembacaan response dengan dokumentasi API pengajar. */
  parseResponse?: (payload: unknown) => {
    category: string;
    confidence?: number | null;
  } | null;
  now?: () => Date;
}

const DEFAULT_TIMEOUT_MS = 10_000;

let cachedLocalClassifier: LocalSentimentClassifier | null = null;

function getDefaultLocalClassifier(): LocalSentimentClassifier {
  if (!cachedLocalClassifier) {
    const modelRecord = edomModel as Record<string, unknown> & {
      default?: Record<string, unknown>;
    };
    const resolvedModel = modelRecord.default ?? modelRecord;
    cachedLocalClassifier = createSentimentClassifier(resolvedModel);
  }
  return cachedLocalClassifier;
}

function readPublicAiEndpoint(): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  const value = process.env.EXPO_PUBLIC_AI_API_URL?.trim();
  return value ? value : undefined;
}

/**
 * Mengurai response JSON dari API klasifikasi AI secara defensif.
 * Mendukung bentuk response umum sambil tetap siap disesuaikan lewat `parseResponse`.
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
  };
}

function classifyWithLocalModel(
  trimmedReason: string,
  config: AiServiceConfig,
): AiClassificationResult {
  try {
    const classify = config.localClassifier ?? getDefaultLocalClassifier();
    const prediction = classify(trimmedReason);

    if (!prediction.label) {
      if (prediction.status === 'empty_input') {
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

/**
 * Mengirim alasan izin ke API AI pengajar atau model sentimen lokal (`ai/sentiment.js`).
 * Tidak melempar error agar pengajuan izin tetap dapat disimpan dengan status AI `failed`.
 */
export async function classifyLeaveReason(
  reason: string,
  config: AiServiceConfig = {},
): Promise<AiClassificationResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return buildFailedResult('Alasan izin kosong sehingga tidak dapat diklasifikasi.');
  }

  const mode = config.mode ?? 'auto';
  const hasExplicitEndpoint = Object.prototype.hasOwnProperty.call(
    config,
    'endpointUrl',
  );
  const explicitEndpoint = config.endpointUrl?.trim();
  const publicEndpoint = readPublicAiEndpoint();
  const endpointUrl = explicitEndpoint || (!hasExplicitEndpoint ? publicEndpoint : undefined);

  const shouldUseLocal =
    mode === 'local' ||
    (mode === 'auto' &&
      Boolean(config.localClassifier || (!endpointUrl && !hasExplicitEndpoint)));

  if (shouldUseLocal) {
    return classifyWithLocalModel(trimmedReason, config);
  }

  if (!endpointUrl) {
    return buildFailedResult(
      'Endpoint API AI belum dikonfigurasi. Pengajuan tetap disimpan untuk ditinjau asisten.',
    );
  }

  const fetchFn: FetchLike | undefined =
    config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) {
    return buildFailedResult(
      'Layanan jaringan tidak tersedia di lingkungan ini. Pengajuan tetap disimpan untuk ditinjau asisten.',
    );
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = config.method ?? 'POST';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestInit: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
    };

    let targetUrl = endpointUrl;
    if (method === 'POST') {
      const bodyPayload = config.buildRequestBody
        ? config.buildRequestBody(trimmedReason)
        : { reason: trimmedReason };
      requestInit.body = JSON.stringify(bodyPayload);
    } else {
      const separator = endpointUrl.includes('?') ? '&' : '?';
      targetUrl = `${endpointUrl}${separator}reason=${encodeURIComponent(trimmedReason)}`;
    }

    const response = await fetchFn(targetUrl, requestInit);

    if (!response.ok) {
      return buildFailedResult(
        `Layanan AI mengembalikan status ${response.status}. Pengajuan tetap disimpan untuk ditinjau asisten.`,
      );
    }

    let jsonPayload: unknown;
    try {
      jsonPayload = await response.json();
    } catch {
      return buildFailedResult(
        'Respons API AI bukan JSON yang valid. Pengajuan tetap disimpan untuk ditinjau asisten.',
      );
    }

    const parsed = config.parseResponse
      ? config.parseResponse(jsonPayload)
      : parseAiClassificationResponse(jsonPayload);

    if (!parsed) {
      return buildFailedResult(
        'Format respons klasifikasi AI tidak sesuai kontrak. Pengajuan tetap disimpan untuk ditinjau asisten.',
      );
    }

    const timestamp = (config.now ? config.now() : new Date()).toISOString();

    return {
      status: 'completed',
      category: parsed.category,
      confidence: parsed.confidence ?? null,
      classifiedAt: timestamp,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return buildFailedResult(
        'Permintaan ke API AI melebihi batas waktu (timeout). Pengajuan tetap disimpan untuk ditinjau asisten.',
      );
    }

    return buildFailedResult(
      'Gagal menghubungi layanan AI. Pengajuan tetap disimpan untuk ditinjau asisten.',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

