import { prisma } from '../db/prisma.js';
import { TRANSACTION_OPTIONS } from '../db/transaction-options.js';
import { Prisma } from '../generated/prisma/client.js';
import type { SaleStatus } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { dateRangeFilter } from '../utils/date-range.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { logAudit } from './audit-service.js';
import { applyStockMovement } from './stock-movement-service.js';

export interface ReturnItemInput {
  saleItemId: number;
  quantity: number;
}

export interface CreateReturnInput {
  reason: string;
  items: ReturnItemInput[];
}

export interface ListReturnsParams {
  page: number;
  pageSize: number;
  saleId?: number | undefined;
  saleItemId?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface CreateReturnResult {
  saleId: number;
  invoiceNo: string;
  status: SaleStatus;
  returns: ReturnView[];
}

interface LockedSale {
  id: number;
  invoice_no: string;
}

interface LockedSaleItem {
  id: number;
  sale_id: number;
  batch_id: number;
  quantity: number;
  returned_quantity: number;
}

interface ReturnContext {
  saleId: number;
  invoiceNo: string;
  reason: string;
  actorId: number;
}

const returnSelect = {
  id: true,
  saleItemId: true,
  quantity: true,
  reason: true,
  createdById: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  saleItem: {
    select: {
      id: true,
      saleId: true,
      medicineId: true,
      batchId: true,
      quantity: true,
      returnedQuantity: true,
      unitPrice: true,
      taxAmount: true,
      lineTotal: true,
      medicine: { select: { id: true, name: true, sku: true, unit: true } },
      batch: { select: { id: true, batchNo: true, expiryDate: true } },
      sale: { select: { id: true, invoiceNo: true, status: true } },
    },
  },
} as const;

export type ReturnView = Prisma.ReturnGetPayload<{ select: typeof returnSelect }>;

/** Shape checks that need no database access. */
function validateReturnInput(input: CreateReturnInput): { reason: string; itemIds: number[] } {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw AppError.validation('A return reason is required', {
      reason: 'Provide at least 3 characters',
    });
  }
  if (input.items.length === 0) {
    throw AppError.validation('Add at least one item to the return', { items: 'Required' });
  }

  const itemIds: number[] = [];
  const seen = new Set<number>();

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw AppError.validation('Return quantity must be a positive integer', {
        saleItemId: item.saleItemId,
      });
    }
    if (seen.has(item.saleItemId)) {
      throw AppError.validation('The same sale item appears more than once in this return', {
        saleItemId: item.saleItemId,
      });
    }
    seen.add(item.saleItemId);
    itemIds.push(item.saleItemId);
  }

  return { reason, itemIds };
}

async function lockSale(tx: Prisma.TransactionClient, saleId: number): Promise<LockedSale> {
  const rows = await tx.$queryRaw<LockedSale[]>`
    SELECT id, invoice_no
    FROM sales
    WHERE id = ${saleId}
    FOR UPDATE
  `;
  const sale = rows[0];

  if (!sale) {
    throw AppError.notFound('Sale not found');
  }
  return sale;
}

async function lockSaleItems(
  tx: Prisma.TransactionClient,
  itemIds: number[],
): Promise<Map<number, LockedSaleItem>> {
  const rows = await tx.$queryRaw<LockedSaleItem[]>`
    SELECT id, sale_id, batch_id, quantity, returned_quantity
    FROM sale_items
    WHERE id IN (${Prisma.join(itemIds)})
    ORDER BY id
    FOR UPDATE
  `;

  return new Map(rows.map((row) => [row.id, row]));
}

/** Locks batches in ascending id, the same order sales and other returns use. */
async function lockBatches(tx: Prisma.TransactionClient, batchIds: number[]): Promise<void> {
  await tx.$queryRaw`
    SELECT id
    FROM batches
    WHERE id IN (${Prisma.join(batchIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

/**
 * Validates ownership and the return cap against the locked rows, and returns
 * the affected batch ids. Called only after the sale/items are locked, so
 * `returned_quantity` cannot change underneath us.
 */
function validateReturnAgainstSale(
  items: ReturnItemInput[],
  itemById: Map<number, LockedSaleItem>,
  saleId: number,
): number[] {
  const foreign = items
    .map((item) => item.saleItemId)
    .filter((itemId) => itemById.get(itemId)?.sale_id !== saleId);

  if (foreign.length > 0) {
    throw AppError.validation('One or more sale items do not belong to this sale', {
      saleItemIds: foreign,
    });
  }

  const batchIds = new Set<number>();

  for (const item of items) {
    const line = itemById.get(item.saleItemId);
    if (!line) {
      throw AppError.notFound('Sale item not found');
    }

    const alreadyReturned = line.returned_quantity;
    const available = line.quantity - alreadyReturned;

    if (item.quantity > available) {
      throw new AppError(
        'INVALID_STATE',
        `Cannot return ${item.quantity}; only ${available} of ${line.quantity} remain`,
        {
          saleItemId: item.saleItemId,
          sold: line.quantity,
          alreadyReturned,
          requested: item.quantity,
        },
      );
    }

    batchIds.add(line.batch_id);
  }

  return [...batchIds].sort((a, b) => a - b);
}

/** One returned line: return row + RETURN movement + counter + audit. */
async function applyReturnLine(
  tx: Prisma.TransactionClient,
  line: LockedSaleItem,
  quantity: number,
  context: ReturnContext,
): Promise<number> {
  const created = await tx.return.create({
    data: {
      saleItemId: line.id,
      quantity,
      reason: context.reason,
      createdById: context.actorId,
    },
    select: { id: true, saleItemId: true, quantity: true, reason: true },
  });

  const movement = await applyStockMovement(
    {
      batchId: line.batch_id,
      qtyDelta: quantity,
      type: 'RETURN',
      referenceType: 'RETURN',
      referenceId: created.id,
      reason: context.reason,
      createdById: context.actorId,
    },
    tx,
  );

  await tx.saleItem.update({
    where: { id: line.id },
    data: { returnedQuantity: { increment: quantity } },
  });

  await logAudit(
    {
      userId: context.actorId,
      action: 'CREATE',
      entityType: 'RETURN',
      entityId: created.id,
      after: {
        id: created.id,
        saleId: context.saleId,
        invoiceNo: context.invoiceNo,
        saleItemId: created.saleItemId,
        quantity: created.quantity,
        reason: created.reason,
        batchId: line.batch_id,
        quantityOnHand: movement.quantityOnHand,
      },
    },
    tx,
  );

  return created.id;
}

/** The sale status is derived from its items after every return (FR-6). */
async function recomputeSaleStatus(
  tx: Prisma.TransactionClient,
  saleId: number,
): Promise<SaleStatus> {
  const items = await tx.saleItem.findMany({
    where: { saleId },
    select: { quantity: true, returnedQuantity: true },
  });

  if (items.every((item) => item.returnedQuantity >= item.quantity)) {
    return 'FULLY_RETURNED';
  }
  return items.some((item) => item.returnedQuantity > 0) ? 'PARTIALLY_RETURNED' : 'COMPLETED';
}

/**
 * Processes a return.
 *
 * Locks the sale first (serialising concurrent returns for that sale), then the
 * requested sale items, then every affected batch in ascending id. The cap is
 * checked against the locked `returned_quantity`, so two requests cannot both
 * pass it. Stock goes back to the original batch, never by FEFO.
 */
export async function createReturn(
  saleId: number,
  input: CreateReturnInput,
  actorId: number,
): Promise<CreateReturnResult> {
  const { reason, itemIds } = validateReturnInput(input);

  return prisma.$transaction(async (tx) => {
    const sale = await lockSale(tx, saleId);
    const itemById = await lockSaleItems(tx, itemIds);
    const batchIds = validateReturnAgainstSale(input.items, itemById, saleId);
    await lockBatches(tx, batchIds);

    const context: ReturnContext = {
      saleId,
      invoiceNo: sale.invoice_no,
      reason,
      actorId,
    };
    const createdIds: number[] = [];

    for (const item of input.items) {
      const line = itemById.get(item.saleItemId);
      if (!line) {
        throw AppError.notFound('Sale item not found');
      }
      createdIds.push(await applyReturnLine(tx, line, item.quantity, context));
    }

    const status = await recomputeSaleStatus(tx, saleId);
    await tx.sale.update({ where: { id: saleId }, data: { status } });

    const returns = await tx.return.findMany({
      where: { id: { in: createdIds } },
      orderBy: { id: 'asc' },
      select: returnSelect,
    });

    return { saleId, invoiceNo: sale.invoice_no, status, returns };
  }, TRANSACTION_OPTIONS);
}

export async function listReturns(
  params: ListReturnsParams,
): Promise<{ data: ReturnView[]; meta: PageMeta }> {
  const createdAt = dateRangeFilter(params.from, params.to);

  const where: Prisma.ReturnWhereInput = {
    ...(params.saleItemId !== undefined ? { saleItemId: params.saleItemId } : {}),
    ...(params.saleId !== undefined ? { saleItem: { saleId: params.saleId } } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.return.count({ where }),
    prisma.return.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: returnSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}
