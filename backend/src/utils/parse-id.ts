import { AppError } from './app-error.js';

/**
 * Parses a positive integer path id. Anything else cannot identify a row, so
 * it is reported as 404 (the same as a missing resource) rather than 400.
 */
export function parseIdParam(raw: string | string[] | undefined, entity: string): number {
  if (Array.isArray(raw)) {
    throw AppError.notFound(`${entity} not found`);
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.notFound(`${entity} not found`);
  }
  return id;
}
