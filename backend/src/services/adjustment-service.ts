import { prisma } from '../db/prisma.js';
import { TRANSACTION_OPTIONS } from '../db/transaction-options.js';
import type { AdjustmentReason, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { dateRangeFilter } from '../utils/date-range.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { logAudit } from './audit-service.js';
import { applyStockMovement } from './stock-movement-service.js';

export interface CreateAdjustmentInput {
  batchId: number;
  /** Positive = found stock, negative = damaged/lost/correction down. Never 0. */
  delta: number;
  reasonCode: AdjustmentReason;
  note?: string | null | undefined;
}

export interface ListAdjustmentsParams {
  page: number;
  pageSize: number;
  batchId?: number | undefined;
  reasonCode?: AdjustmentReason | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const adjustmentSelect = {
  id: true,
  batchId: true,
  delta: true,
  reasonCode: true,
  note: true,
  createdById: true,
  createdAt: true,
  batch: {
    select: {
      id: true,
      batchNo: true,
      expiryDate: true,
      quantityOnHand: true,
      medicine: { select: { id: true, name: true, sku: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} as const;

export type AdjustmentView = Prisma.StockAdjustmentGetPayload<{ select: typeof adjustmentSelect }>;

/**
 * Applies a signed stock adjustment.
 *
 * The adjustment row and its ledger movement commit together. A result below
 * zero is rejected by the stock service, which rolls back the whole thing.
 */
export async function createAdjustment(
  input: CreateAdjustmentInput,
  actorId: number,
): Promise<AdjustmentView> {
  const note = input.note?.trim() || null;

  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw AppError.validation('Adjustment delta must be a non-zero integer', {
      delta: input.delta,
    });
  }
  if (input.reasonCode === 'OTHER' && note === null) {
    throw AppError.validation('A note is required when the reason is OTHER', {
      note: 'Explain the adjustment',
    });
  }

  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({
      where: { id: input.batchId },
      select: { id: true },
    });
    if (!batch) {
      throw AppError.notFound('Batch not found');
    }

    const adjustment = await tx.stockAdjustment.create({
      data: {
        batchId: input.batchId,
        delta: input.delta,
        reasonCode: input.reasonCode,
        note,
        createdById: actorId,
      },
      select: { id: true },
    });

    const movement = await applyStockMovement(
      {
        batchId: input.batchId,
        qtyDelta: input.delta,
        type: 'ADJUSTMENT',
        referenceType: 'ADJUSTMENT',
        referenceId: adjustment.id,
        reason: note ? `${input.reasonCode}: ${note}` : input.reasonCode,
        createdById: actorId,
      },
      tx,
    );

    const created = await tx.stockAdjustment.findUniqueOrThrow({
      where: { id: adjustment.id },
      select: adjustmentSelect,
    });

    await logAudit(
      {
        userId: actorId,
        action: 'CREATE',
        entityType: 'ADJUSTMENT',
        entityId: created.id,
        // The movement read the row under its lock, so subtracting the delta
        // gives the exact quantity from before this adjustment.
        before: {
          batchId: created.batchId,
          quantityOnHand: movement.quantityOnHand - input.delta,
        },
        after: {
          id: created.id,
          batchId: created.batchId,
          delta: created.delta,
          reasonCode: created.reasonCode,
          note: created.note,
          quantityOnHand: movement.quantityOnHand,
        },
      },
      tx,
    );

    return created;
  }, TRANSACTION_OPTIONS);
}

export async function listAdjustments(
  params: ListAdjustmentsParams,
): Promise<{ data: AdjustmentView[]; meta: PageMeta }> {
  const createdAt = dateRangeFilter(params.from, params.to);

  const where: Prisma.StockAdjustmentWhereInput = {
    ...(params.batchId !== undefined ? { batchId: params.batchId } : {}),
    ...(params.reasonCode !== undefined ? { reasonCode: params.reasonCode } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.stockAdjustment.count({ where }),
    prisma.stockAdjustment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: adjustmentSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}
