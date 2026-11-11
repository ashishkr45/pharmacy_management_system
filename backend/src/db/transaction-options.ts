/**
 * Shared limits for interactive transactions.
 *
 * Neon free-tier round trips are slow, and a sale/purchase runs many queries in
 * one transaction. Prisma's 5 s default times out (P2028); 20 s still bounds a
 * genuinely hung transaction.
 */
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
