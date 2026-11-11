import { seedDatabase } from '../../prisma/seed.js';
import { prisma } from '../../src/db/prisma.js';

/** Wipes and re-seeds the test database with the same fictional demo data. */
export async function resetDatabase(): Promise<void> {
  await seedDatabase();
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/** Counts batches whose ledger sum does not match `quantity_on_hand` (must be 0). */
export async function countLedgerMismatches(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ mismatched: number }>>`
    SELECT COUNT(*)::int AS mismatched
    FROM (
      SELECT b.id
      FROM batches b
      LEFT JOIN stock_movements m ON m.batch_id = b.id
      GROUP BY b.id, b.quantity_on_hand
      HAVING b.quantity_on_hand <> COALESCE(SUM(m.qty_delta), 0)
    ) broken
  `;
  return rows[0]?.mismatched ?? -1;
}
