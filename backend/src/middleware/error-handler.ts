import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

/**
 * Reached only when no route matched. Express 5 forwards unmatched requests
 * here instead of guessing, so the client still gets the standard error shape.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};

/** Maps any thrown value to the single API error shape. Never leaks internals. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json(err.toBody());
    return;
  }

  // Defence in depth: a Zod schema used without the validate() middleware.
  if (err instanceof ZodError) {
    res.status(400).json(
      new AppError('VALIDATION_ERROR', 'Request validation failed', {
        issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      }).toBody(),
    );
    return;
  }

  // body-parser throws a SyntaxError with `body` set for malformed JSON.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(new AppError('VALIDATION_ERROR', 'Malformed JSON request body').toBody());
    return;
  }

  console.error('[internal-error]', err);
  res.status(500).json(new AppError('INTERNAL_ERROR', 'Something went wrong').toBody());
};
