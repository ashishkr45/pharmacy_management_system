import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { daysUntilExpiry, isExpired, startOfToday, systemClock, type Clock } from '../utils/clock.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';

const batchSelect = {
  id: true,
  medicineId: true,
  batchNo: true,
  expiryDate: true,
  quantityOnHand: true,
  purchasePrice: true,
  salePrice: true,
  supplierId: true,
  createdAt: true,
  updatedAt: true,
  medicine: { select: { id: true, name: true, sku: true, unit: true, reorderLevel: true } },
  supplier: { select: { id: true, name: true } },
} as const;

export type Batch = Prisma.BatchGetPayload<{ select: typeof batchSelect }>;
export type BatchView = Batch & { daysUntilExpiry: number; expired: boolean };

export interface ListBatchesParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  medicineId?: number | undefined;
  supplierId?: number | undefined;
  expired?: boolean | undefined;
  hasStock?: boolean | undefined;
}

function toBatchView(batch: Batch, clock: Clock): BatchView {
  return {
    ...batch,
    daysUntilExpiry: daysUntilExpiry(batch.expiryDate, clock),
    expired: isExpired(batch.expiryDate, clock),
  };
}

/** `GET /batches` — FEFO-friendly ordering (soonest expiry first). */
export async function listBatches(
  params: ListBatchesParams,
  clock: Clock = systemClock,
): Promise<{ data: BatchView[]; meta: PageMeta }> {
  const today = startOfToday(clock);
  const where: Prisma.BatchWhereInput = {
    ...(params.medicineId !== undefined ? { medicineId: params.medicineId } : {}),
    ...(params.supplierId !== undefined ? { supplierId: params.supplierId } : {}),
    ...(params.expired === true ? { expiryDate: { lte: today } } : {}),
    ...(params.expired === false ? { expiryDate: { gt: today } } : {}),
    ...(params.hasStock === true ? { quantityOnHand: { gt: 0 } } : {}),
    ...(params.hasStock === false ? { quantityOnHand: 0 } : {}),
    ...(params.search
      ? {
          OR: [
            { batchNo: { contains: params.search, mode: 'insensitive' as const } },
            { medicine: { name: { contains: params.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.batch.count({ where }),
    prisma.batch.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
      ...paginationArgs(params),
      select: batchSelect,
    }),
  ]);

  return { data: rows.map((row) => toBatchView(row, clock)), meta: pageMeta(total, params) };
}

export async function getBatchById(id: number, clock: Clock = systemClock): Promise<BatchView> {
  const batch = await prisma.batch.findUnique({ where: { id }, select: batchSelect });
  if (!batch) {
    throw AppError.notFound('Batch not found');
  }
  return toBatchView(batch, clock);
}

const movementSelect = {
  id: true,
  batchId: true,
  type: true,
  qtyDelta: true,
  referenceType: true,
  referenceId: true,
  reason: true,
  createdById: true,
  createdAt: true,
  batch: {
    select: {
      id: true,
      batchNo: true,
      medicine: { select: { id: true, name: true, sku: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} as const;

export type StockMovementView = Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>;

export interface ListMovementsParams {
  page: number;
  pageSize: number;
  batchId?: number | undefined;
  type?: 'OPENING' | 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

/** `GET /stock-movements` — the append-only ledger, newest first. */
export async function listStockMovements(
  params: ListMovementsParams,
): Promise<{ data: StockMovementView[]; meta: PageMeta }> {
  const where: Prisma.StockMovementWhereInput = {
    ...(params.batchId !== undefined ? { batchId: params.batchId } : {}),
    ...(params.type !== undefined ? { type: params.type } : {}),
    ...(params.from !== undefined || params.to !== undefined
      ? {
          createdAt: {
            ...(params.from !== undefined ? { gte: new Date(`${params.from}T00:00:00.000Z`) } : {}),
            ...(params.to !== undefined ? { lte: new Date(`${params.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: movementSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}
