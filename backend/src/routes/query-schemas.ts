import { z } from 'zod';

/** Standard list query: `?page=1&pageSize=20` (pageSize capped at 100). */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** `?search=...` — trimmed, bounded, optional. */
export const searchParam = z.string().trim().min(1).max(100).optional();

/** `?isActive=true|false` → boolean (omitted means "both"). */
export const activeParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** Pagination + search, shared by categories and suppliers. */
export const listQuery = paginationQuery.extend({ search: searchParam });

export type ListQuery = z.infer<typeof listQuery>;
