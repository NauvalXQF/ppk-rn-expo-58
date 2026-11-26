import type { ErrorRequestHandler } from 'express';

const errors = {
  INVALID_INPUT: { status: 400, message: 'Invalid request.' },
  PAYMENT_CONFLICT: { status: 409, message: 'This fine cannot start a new payment.' },
  PAYMENT_INITIALIZING: { status: 409, message: 'The active order is being reconciled.' },
  PAYMENT_UNAVAILABLE: { status: 503, message: 'Payment provider is temporarily unavailable.' },
  INVALID_JSON: { status: 400, message: 'Request body must contain valid JSON.' },
  UNAUTHENTICATED: { status: 401, message: 'A valid Firebase ID token is required.' },
  FORBIDDEN: { status: 403, message: 'This account does not have access.' },
  NOT_FOUND: { status: 404, message: 'Route not found.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'Request body exceeds the size limit.' },
  UNSUPPORTED_BODY: { status: 415, message: 'Request body encoding is not supported.' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected server error occurred.' },
};

type ErrorCode = keyof typeof errors;

export class HttpError extends Error {
  constructor(code: ErrorCode) {
    super(errors[code].message);
    this.code = code;
  }

  readonly code: ErrorCode;
}

function errorCode(error: unknown): ErrorCode {
  if (error instanceof HttpError) return error.code;
  if (typeof error === 'object' && error !== null && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
      case 'request.size.invalid':
      case 'request.aborted':
        return 'INVALID_JSON';
      case 'entity.too.large':
        return 'PAYLOAD_TOO_LARGE';
      case 'charset.unsupported':
      case 'encoding.unsupported':
        return 'UNSUPPORTED_BODY';
    }
  }
  return 'INTERNAL_ERROR';
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(new Error('Failed while sending response.'));
    return;
  }

  const code = errorCode(error);
  const { status, message } = errors[code];
  if (status === 401) res.set('WWW-Authenticate', 'Bearer');
  res.status(status).json({ error: { code, message, requestId: res.get('X-Request-Id') } });
};
