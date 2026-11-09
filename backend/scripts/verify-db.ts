/**
 * B2 checkpoint helper (also useful as demo/test evidence):
 *   * asserts the ledger invariant  SUM(stock_movements.qty_delta) = batches.quantity_on_hand
 *   * reports the seed's alert coverage (expired / near-expiry / low stock)
 *
 * Run: npm run db:verify
 * Exit code 0 = invariant holds everywhere.
 */
import { disconnectPrisma, prisma } from '../src/db/prisma.js';

interface MismatchRow {
  id: number;
  batch_no: string;
  quantity_on_hand: number;
  ledger_sum: number;
}

interface CountRow {
  expired_with_stock: number;
  near_expiry: number;
  low_stock: number;
}

async function main(): Promise<void> {
  const mismatches = await prisma.$queryRaw<MismatchRow[]>`
    SELECT b.id,
           b.batch_no,
           b.quantity_on_hand,
           COALESCE(SUM(m.qty_delta), 0)::int AS ledger_sum
    FROM batches b
    LEFT JOIN stock_movements m ON m.batch_id = b.id
    GROUP BY b.id, b.batch_no, b.quantity_on_hand
    HAVING b.quantity_on_hand <> COALESCE(SUM(m.qty_delta), 0)
  `;

  const coverage = await prisma.$queryRaw<CountRow[]>`
    SELECT
      (SELECT COUNT(*)::int FROM batches
        WHERE expiry_date <= CURRENT_DATE AND quantity_on_hand > 0) AS expired_with_stock,
      (SELECT COUNT(*)::int FROM batches
        WHERE expiry_date > CURRENT_DATE
          AND expiry_date <= CURRENT_DATE + 60
          AND quantity_on_hand > 0) AS near_expiry,
      (SELECT COUNT(*)::int FROM (
          SELECT m.id
          FROM medicines m
          JOIN batches b ON b.medicine_id = m.id
          WHERE b.expiry_date > CURRENT_DATE
          GROUP BY m.id, m.reorder_level
          HAVING COALESCE(SUM(b.quantity_on_hand), 0) <= m.reorder_level
        ) low) AS low_stock
  `;

  const batches = await prisma.batch.count();
  const movements = await prisma.stockMovement.count();
  const stats = coverage[0];

  console.log(`batches: ${batches} · ledger rows: ${movements}`);
  console.log(
    `alerts:  ${stats?.expired_with_stock ?? 0} expired-with-stock · ` +
      `${stats?.near_expiry ?? 0} near-expiry (<=60d) · ${stats?.low_stock ?? 0} low-stock medicines`,
  );

  if (mismatches.length > 0) {
    console.error('LEDGER INVARIANT VIOLATED:');
    console.table(mismatches);
    process.exitCode = 1;
    return;
  }

  console.log('ledger invariant: OK (SUM(qty_delta) = quantity_on_hand for every batch)');
}

main()
  .catch((error: unknown) => {
    console.error('Verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
