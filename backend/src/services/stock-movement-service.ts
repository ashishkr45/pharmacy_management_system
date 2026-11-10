import type { MovementReferenceType, MovementType, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

export interface ApplyStockMovementInput {
  batchId: number;
  /** Positive = stock in, negative = stock out. Never 0. */
  qtyDelta: number;
  type: MovementType;
  referenceType: MovementReferenceType;
  referenceId?: number | null;
  reason?: string | null;
  createdById?: number | null;
}

export interface ApplyStockMovementResult {
  batchId: number;
  quantityOnHand: number;
}

/**
 * The ONLY function allowed to change `batches.quantity_on_hand`.
 *
 * It must receive the caller's transaction (`tx`) instead of opening its own:
 * the business row (purchase/sale/return/adjustment) and its ledger row must
 * commit or roll back together.
 */
export async function applyStockMovement(
  input: ApplyStockMovementInput,
  tx: Prisma.TransactionClient,
): Promise<ApplyStockMovementResult> {
  if (input.qtyDelta === 0 || !Number.isInteger(input.qtyDelta)) {
    throw new AppError('INVALID_STATE', 'Quantity delta must be a non-zero integer')
  }
  const rows = await tx.$queryRaw<Array<{ id: number; quantity_on_hand: number }>>`
    SELECT id, quantity_on_hand
    FROM batches
    WHERE id = ${input.batchId}
    FOR UPDATE
  `;
  const [batch] = rows;

  if (!batch) {
    throw AppError.notFound('Batch not found')
  }

  const current = batch.quantity_on_hand;
  const newQty = current + input.qtyDelta;
  if (newQty < 0) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      `Batch ${input.batchId} has only ${current} units available`,
      {
        batchId: input.batchId,
        available: current,
        requested: Math.abs(input.qtyDelta),
      },
    );
  }

    await tx.batch.update({
      where: { id: input.batchId },
      data: { quantityOnHand: newQty }
    });

    await tx.stockMovement.create({
      data: {
        batchId: input.batchId,
        type: input.type,
        qtyDelta: input.qtyDelta,
        referenceType: input.referenceType,
        referenceId: input.referenceId ?? null,
        reason: input.reason ?? null,
        createdById: input.createdById ?? null,
      }
    });

    return { batchId: input.batchId, quantityOnHand: newQty };
}

