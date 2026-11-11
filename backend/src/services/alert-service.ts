import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { addDays, daysUntilExpiry, startOfToday, systemClock, toCalendarDay, type Clock } from '../utils/clock.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { getNumberSetting } from './setting-service.js';

export interface LowStockItem {
  medicineId: number;
  name: string;
  sku: string;
  unit: string;
  reorderLevel: number;
  availableQuantity: number;
  expiredQuantity: number;
  shortfall: number;
}

export interface ExpiryAlertItem {
  batchId: number;
  batchNo: string;
  expiryDate: Date;
  quantityOnHand: number;
  daysUntilExpiry: number;
  expired: boolean;
  medicine: {
    id: number;
    name: string;
    sku: string;
    unit: string;
    reorderLevel: number;
  };
}

export interface AlertCounts {
  lowStock: number;
  nearExpiry: number;
  expired: number;
}

const alertBatchSelect = {
  id: true,
  batchNo: true,
  expiryDate: true,
  quantityOnHand: true,
  medicine: {
    select: { id: true, name: true, sku: true, unit: true, reorderLevel: true },
  },
} as const;

type AlertBatchRow = Prisma.BatchGetPayload<{ select: typeof alertBatchSelect }>;

/**
 * Low stock is per medicine: only sellable (non-expired) stock counts, so a
 * shelf full of expired stock cannot hide a shortage (FR-5).
 */
async function buildLowStockRows(clock: Clock, search?: string): Promise<LowStockItem[]> {
  const medicines = await prisma.medicine.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      reorderLevel: true,
      batches: {
        where: { quantityOnHand: { gt: 0 } },
        select: { quantityOnHand: true, expiryDate: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const today = startOfToday(clock);
  const rows: LowStockItem[] = [];

  for (const medicine of medicines) {
    let availableQuantity = 0;
    let expiredQuantity = 0;

    for (const batch of medicine.batches) {
      if (toCalendarDay(batch.expiryDate).getTime() <= today.getTime()) {
        expiredQuantity += batch.quantityOnHand;
      } else {
        availableQuantity += batch.quantityOnHand;
      }
    }

    if (availableQuantity < medicine.reorderLevel) {
      rows.push({
        medicineId: medicine.id,
        name: medicine.name,
        sku: medicine.sku,
        unit: medicine.unit,
        reorderLevel: medicine.reorderLevel,
        availableQuantity,
        expiredQuantity,
        shortfall: medicine.reorderLevel - availableQuantity,
      });
    }
  }

  return rows.sort(
    (a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name),
  );
}

export interface ListAlertsParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export async function listLowStock(
  params: ListAlertsParams,
  clock: Clock = systemClock,
): Promise<{ data: LowStockItem[]; meta: PageMeta }> {
  const all = await buildLowStockRows(clock, params.search);
  const start = (params.page - 1) * params.pageSize;

  return {
    data: all.slice(start, start + params.pageSize),
    meta: pageMeta(all.length, params),
  };
}

function toExpiryAlert(batch: AlertBatchRow, clock: Clock): ExpiryAlertItem {
  const days = daysUntilExpiry(batch.expiryDate, clock);

  return {
    batchId: batch.id,
    batchNo: batch.batchNo,
    expiryDate: batch.expiryDate,
    quantityOnHand: batch.quantityOnHand,
    daysUntilExpiry: days,
    expired: days <= 0,
    medicine: batch.medicine,
  };
}

/** Batches with stock expiring inside the settings-driven window (0 < days <= N). */
export async function listNearExpiry(
  params: ListAlertsParams,
  clock: Clock = systemClock,
): Promise<{ data: ExpiryAlertItem[]; meta: PageMeta & { nearExpiryDays: number } }> {
  const nearExpiryDays = await getNumberSetting('nearExpiryDays', 60);
  const today = startOfToday(clock);

  const where: Prisma.BatchWhereInput = {
    quantityOnHand: { gt: 0 },
    expiryDate: { gt: today, lte: addDays(today, nearExpiryDays) },
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
      select: alertBatchSelect,
    }),
  ]);

  return {
    data: rows.map((row) => toExpiryAlert(row, clock)),
    meta: { ...pageMeta(total, params), nearExpiryDays },
  };
}

/** Expired batches that still hold stock (including those expiring today). */
export async function listExpired(
  params: ListAlertsParams,
  clock: Clock = systemClock,
): Promise<{ data: ExpiryAlertItem[]; meta: PageMeta }> {
  const today = startOfToday(clock);

  const where: Prisma.BatchWhereInput = {
    quantityOnHand: { gt: 0 },
    expiryDate: { lte: today },
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
      select: alertBatchSelect,
    }),
  ]);

  return {
    data: rows.map((row) => toExpiryAlert(row, clock)),
    meta: pageMeta(total, params),
  };
}

/** Counts for the dashboard, using the same rules as the three lists. */
export async function getAlertCounts(clock: Clock = systemClock): Promise<AlertCounts> {
  const nearExpiryDays = await getNumberSetting('nearExpiryDays', 60);
  const today = startOfToday(clock);

  const [lowStockRows, nearExpiry, expired] = await Promise.all([
    buildLowStockRows(clock),
    prisma.batch.count({
      where: {
        quantityOnHand: { gt: 0 },
        expiryDate: { gt: today, lte: addDays(today, nearExpiryDays) },
      },
    }),
    prisma.batch.count({
      where: { quantityOnHand: { gt: 0 }, expiryDate: { lte: today } },
    }),
  ]);

  return { lowStock: lowStockRows.length, nearExpiry, expired };
}
