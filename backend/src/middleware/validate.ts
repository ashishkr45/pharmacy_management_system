import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';

function validationError(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }): AppError {
  return AppError.validation('Request validation failed', {
    issues: error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  });
}

/**
 * Validates and *replaces* `req.body` with the parsed (and therefore typed)
 * value, so services only ever see schema-checked input.
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(validationError(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express 5 exposes `req.query` as a read-only getter, so the parsed query is
 * stored on `res.locals.query` and read through `getValidatedQuery`.
 */
export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(validationError(result.error));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}

export function getValidatedQuery<T>(res: Response): T {
  return res.locals.query as T;
}
