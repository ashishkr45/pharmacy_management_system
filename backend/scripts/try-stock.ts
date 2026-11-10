/**
 * B5 smoke test for the stock-movement service (test DB only, rolls back).
 *
 *   npx tsx scripts/try-stock.ts
 *
 * 1. deducts 1 unit inside a transaction, then forces a rollback:
 *    the printed quantity before and after must be identical;
 * 2. asks for more than the batch holds: must throw INSUFFICIENT_STOCK.
 */
import dotenv from 'dotenv';

// Load the TEST database before anything imports config/env.ts.
dotenv.config({ path: '.env.test', override: true });

async function main(): Promise<void> {
  const { prisma, disconnectPrisma } = await import('../src/db/prisma.js');
  const { applyStockMovement } = await import('../src/services/stock-movement-service.js');

  try {
    const batch = await prisma.batch.findFirstOrThrow({
      where: { quantityOnHand: { gt: 5 } },
      select: { id: true, quantityOnHand: true },
    });
    console.log('batch before      :', batch);

    await prisma
      .$transaction(async (tx) => {
        const result = await applyStockMovement(
          {
            batchId: batch.id,
            qtyDelta: -1,
            type: 'ADJUSTMENT',
            referenceType: 'ADJUSTMENT',
            reason: 'smoke test (rolled back)',
          },
          tx,
        );
        console.log('inside transaction:', result);
        throw new Error('rollback on purpose');
      })
      .catch((error: unknown) => {
        console.log('rolled back       :', (error as Error).message);
      });

    const after = await prisma.batch.findUniqueOrThrow({
      where: { id: batch.id },
      select: { quantityOnHand: true },
    });
    console.log('batch after       :', after);

    const unchanged = after.quantityOnHand === batch.quantityOnHand;
    console.log(unchanged ? 'PASS rollback left the batch untouched' : 'FAIL quantity changed!');

    try {
      await prisma.$transaction(async (tx) => {
        await applyStockMovement(
          {
            batchId: batch.id,
            qtyDelta: -(batch.quantityOnHand + 1),
            type: 'ADJUSTMENT',
            referenceType: 'ADJUSTMENT',
          },
          tx,
        );
      });
      console.log('FAIL expected INSUFFICIENT_STOCK but the call succeeded');
      process.exitCode = 1;
    } catch (error) {
      const code = (error as { code?: string }).code;
      console.log('insufficient check:', code, '-', (error as Error).message);
      if (code !== 'INSUFFICIENT_STOCK') {
        process.exitCode = 1;
      }
    }

    if (!unchanged) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
