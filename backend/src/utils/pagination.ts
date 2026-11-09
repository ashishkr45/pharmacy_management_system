/** Shared pagination helpers so every list endpoint returns the same `meta`. */

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Prisma `skip`/`take` for a 1-based page number. */
export function paginationArgs({ page, pageSize }: PaginationParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageMeta(total: number, { page, pageSize }: PaginationParams): PageMeta {
  return {
    page,
    pageSize,
    total,
    // An empty result set has zero pages (not one empty page).
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
