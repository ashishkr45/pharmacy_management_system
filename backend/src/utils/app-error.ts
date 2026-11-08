/**
 * One error shape for the whole API:
 *
 *   { "error": { "code": "...", "message": "...", "details": { ... } } }
 *
 * Business code throws `AppError`; the central error handler turns it into the
 * HTTP response. Routes and services never build error responses by hand.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INSUFFICIENT_STOCK',
  'BATCH_EXPIRED',
  'INVALID_STATE',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  BATCH_EXPIRED: 409,
  INVALID_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  /** HTTP status derived from the code — callers never choose a status directly. */
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = HTTP_STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details ?? {},
      },
    };
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static validation(message = 'Request validation failed', details?: Record<string, unknown>): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('CONFLICT', message, details);
  }
}
