import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import {
  addDays,
  daysUntilExpiry,
  isExpired,
  startOfToday,
  systemClock,
  type Clock,
} from '../utils/clock.js';
import { money } from '../utils/money.js';
import { getNumberSetting } from './setting-service.js';

export interface DateRangeParams {
  from: string;
  to: string;
}

export interface SalesReportTotals {
  saleCount: number;
  subtotal: string;
  taxTotal: string;
  total: string;
  returnCount: number;
  returnedUnits: number;
  returnedValue: string;
}

export interface SalesReportDay extends SalesReportTotals {
  date: string;
}

export interface SalesReport {
  from: string;
  to: string;
  totals: SalesReportTotals;
  breakdown: SalesReportDay[];
}

export interface StockValuationRow {
  batchId: number;
  batchNo: string;
  expiryDate: Date;
  quantityOnHand: number;
  purchasePrice: string;
  salePrice: string;
  costValue: string;
  retailValue: string;
  expired: boolean;
  medicine: { id: number; name: string; sku: string; unit: string };
  supplier: { id: number; name: string } | null;
}

export interface StockValuation {
  asOf: string;
  rows: StockValuationRow[];
  totals: {
    batches: number;
    units: number;
    costValue: string;
    retailValue: string;
  };
}

export type ExpiryStatus = 'EXPIRED' | 'NEAR_EXPIRY';

export interface ExpiryReportBatch {
  batchId: number;
  batchNo: string;
  expiryDate: Date;
  quantityOnHand: number;
  daysUntilExpiry: number;
  status: ExpiryStatus;
  purchasePrice: string;
  costValue: string;
}

export interface ExpiryReportGroup {
  medicineId: number;
  name: string;
  sku: string;
  unit: string;
  expiredBatches: number;
  expiredUnits: number;
  nearExpiryBatches: number;
  nearExpiryUnits: number;
  costValueAtRisk: string;
  batches: ExpiryReportBatch[];
}

export interface ExpiryReport {
  asOf: string;
  windowDays: number;
  expired: { batches: number; units: number; costValue: string };
  nearExpiry: { batches: number; units: number; costValue: string };
  groups: ExpiryReportGroup[];
}

export interface ReconciliationMismatch {
  batchId: number;
  batchNo: string;
  medicineId: number;
  medicineName: string;
  opening: number;
  purchases: number;
  sales: number;
  returns: number;
  adjustments: number;
  closing: number;
  currentQuantity: number;
  difference: number;
}

export interface ReconciliationReport {
  from: string;
  to: string;
  checksCurrent: boolean;
  checkedBatches: number;
  mismatchCount: number;
  mismatches: ReconciliationMismatch[];
}

function assertRange(from: string, to: string): void {
  if (from > to) {
    throw AppError.validation('`from` must be on or before `to`', { from, to });
  }
}

interface SalesDayRow {
  day: string;
  sale_count: number;
  subtotal: string;
  tax_total: string;
  total: string;
}

interface ReturnsDayRow {
  day: string;
  return_count: number;
  returned_units: number;
  returned_value: string;
}

function emptyDay(date: string): SalesReportDay {
  return {
    date,
    saleCount: 0,
    subtotal: '0.00',
    taxTotal: '0.00',
    total: '0.00',
    returnCount: 0,
    returnedUnits: 0,
    returnedValue: '0.00',
  };
}

/**
 * Gross sales per UTC day plus returns valued proportionally to the returned
 * sale line, so the report never mixes tax-exclusive and tax-inclusive money.
 */
export async function getSalesReport(params: DateRangeParams): Promise<SalesReport> {
  assertRange(params.from, params.to);

  const [salesRows, returnRows] = await Promise.all([
    prisma.$queryRaw<SalesDayRow[]>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS sale_count,
        COALESCE(SUM(subtotal), 0)::text AS subtotal,
        COALESCE(SUM(tax_total), 0)::text AS tax_total,
        COALESCE(SUM(total), 0)::text AS total
      FROM sales
      WHERE created_at >= ${params.from}::date
        AND created_at < ${params.to}::date + INTERVAL '1 day'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<ReturnsDayRow[]>`
      SELECT
        TO_CHAR(r.created_at, 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS return_count,
        COALESCE(SUM(r.quantity), 0)::int AS returned_units,
        COALESCE(SUM(ROUND(si.line_total * r.quantity / si.quantity, 2)), 0)::text AS returned_value
      FROM returns r
      JOIN sale_items si ON si.id = r.sale_item_id
      WHERE r.created_at >= ${params.from}::date
        AND r.created_at < ${params.to}::date + INTERVAL '1 day'
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const days = new Map<string, SalesReportDay>();

  for (const row of salesRows) {
    days.set(row.day, {
      date: row.day,
      saleCount: row.sale_count,
      subtotal: money(row.subtotal).toFixed(2),
      taxTotal: money(row.tax_total).toFixed(2),
      total: money(row.total).toFixed(2),
      returnCount: 0,
      returnedUnits: 0,
      returnedValue: '0.00',
    });
  }

  for (const row of returnRows) {
    const day = days.get(row.day) ?? emptyDay(row.day);
    day.returnCount = row.return_count;
    day.returnedUnits = row.returned_units;
    day.returnedValue = money(row.returned_value).toFixed(2);
    days.set(row.day, day);
  }

  const breakdown = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = {
    saleCount: 0,
    subtotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(0),
    total: new Prisma.Decimal(0),
    returnCount: 0,
    returnedUnits: 0,
    returnedValue: new Prisma.Decimal(0),
  };

  for (const day of breakdown) {
    totals.saleCount += day.saleCount;
    totals.subtotal = totals.subtotal.add(money(day.subtotal));
    totals.taxTotal = totals.taxTotal.add(money(day.taxTotal));
    totals.total = totals.total.add(money(day.total));
    totals.returnCount += day.returnCount;
    totals.returnedUnits += day.returnedUnits;
    totals.returnedValue = totals.returnedValue.add(money(day.returnedValue));
  }

  return {
    from: params.from,
    to: params.to,
    totals: {
      saleCount: totals.saleCount,
      subtotal: totals.subtotal.toFixed(2),
      taxTotal: totals.taxTotal.toFixed(2),
      total: totals.total.toFixed(2),
      returnCount: totals.returnCount,
      returnedUnits: totals.returnedUnits,
      returnedValue: totals.returnedValue.toFixed(2),
    },
    breakdown,
  };
}

export interface StockValuationParams {
  includeZero?: boolean | undefined;
  clock?: Clock | undefined;
}

/** Cost and retail value at the current batch quantities. */
export async function getStockValuation(
  params: StockValuationParams = {},
): Promise<StockValuation> {
  const clock = params.clock ?? systemClock;
  const asOf = startOfToday(clock).toISOString().slice(0, 10);

  const batches = await prisma.batch.findMany({
    where: params.includeZero === true ? {} : { quantityOnHand: { gt: 0 } },
    orderBy: [{ medicineId: 'asc' }, { expiryDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      batchNo: true,
      expiryDate: true,
      quantityOnHand: true,
      purchasePrice: true,
      salePrice: true,
      medicine: { select: { id: true, name: true, sku: true, unit: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  const rows: StockValuationRow[] = [];
  let units = 0;
  let costValue = new Prisma.Decimal(0);
  let retailValue = new Prisma.Decimal(0);

  for (const batch of batches) {
    const cost = money(new Prisma.Decimal(batch.purchasePrice).mul(batch.quantityOnHand));
    const retail = money(new Prisma.Decimal(batch.salePrice).mul(batch.quantityOnHand));

    units += batch.quantityOnHand;
    costValue = costValue.add(cost);
    retailValue = retailValue.add(retail);

    rows.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantityOnHand: batch.quantityOnHand,
      purchasePrice: batch.purchasePrice.toFixed(2),
      salePrice: batch.salePrice.toFixed(2),
      costValue: cost.toFixed(2),
      retailValue: retail.toFixed(2),
      expired: isExpired(batch.expiryDate, clock),
      medicine: batch.medicine,
      supplier: batch.supplier,
    });
  }

  return {
    asOf,
    rows,
    totals: {
      batches: rows.length,
      units,
      costValue: costValue.toFixed(2),
      retailValue: retailValue.toFixed(2),
    },
  };
}

interface ExpiryGroupAccumulator {
  medicine: { id: number; name: string; sku: string; unit: string };
  expiredBatches: number;
  expiredUnits: number;
  nearExpiryBatches: number;
  nearExpiryUnits: number;
  costValueAtRisk: Prisma.Decimal;
  batches: ExpiryReportBatch[];
}

export interface ExpiryReportParams {
  days?: number | undefined;
  clock?: Clock | undefined;
}

/** Expired and near-expiry stock, grouped by medicine, at cost value. */
export async function getExpiryReport(params: ExpiryReportParams = {}): Promise<ExpiryReport> {
  const clock = params.clock ?? systemClock;
  const today = startOfToday(clock);
  const windowDays = params.days ?? (await getNumberSetting('nearExpiryDays', 60));

  const batches = await prisma.batch.findMany({
    where: {
      quantityOnHand: { gt: 0 },
      expiryDate: { lte: addDays(today, windowDays) },
    },
    orderBy: [{ medicineId: 'asc' }, { expiryDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      batchNo: true,
      expiryDate: true,
      quantityOnHand: true,
      purchasePrice: true,
      medicine: { select: { id: true, name: true, sku: true, unit: true } },
    },
  });

  const groups = new Map<number, ExpiryGroupAccumulator>();
  const expired = { batches: 0, units: 0, costValue: new Prisma.Decimal(0) };
  const nearExpiry = { batches: 0, units: 0, costValue: new Prisma.Decimal(0) };

  for (const batch of batches) {
    const days = daysUntilExpiry(batch.expiryDate, clock);
    const status: ExpiryStatus = days <= 0 ? 'EXPIRED' : 'NEAR_EXPIRY';
    const cost = money(new Prisma.Decimal(batch.purchasePrice).mul(batch.quantityOnHand));

    const group =
      groups.get(batch.medicine.id) ??
      ({
        medicine: batch.medicine,
        expiredBatches: 0,
        expiredUnits: 0,
        nearExpiryBatches: 0,
        nearExpiryUnits: 0,
        costValueAtRisk: new Prisma.Decimal(0),
        batches: [],
      } satisfies ExpiryGroupAccumulator);

    group.batches.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantityOnHand: batch.quantityOnHand,
      daysUntilExpiry: days,
      status,
      purchasePrice: batch.purchasePrice.toFixed(2),
      costValue: cost.toFixed(2),
    });
    group.costValueAtRisk = group.costValueAtRisk.add(cost);

    if (status === 'EXPIRED') {
      group.expiredBatches += 1;
      group.expiredUnits += batch.quantityOnHand;
      expired.batches += 1;
      expired.units += batch.quantityOnHand;
      expired.costValue = expired.costValue.add(cost);
    } else {
      group.nearExpiryBatches += 1;
      group.nearExpiryUnits += batch.quantityOnHand;
      nearExpiry.batches += 1;
      nearExpiry.units += batch.quantityOnHand;
      nearExpiry.costValue = nearExpiry.costValue.add(cost);
    }

    groups.set(batch.medicine.id, group);
  }

  return {
    asOf: today.toISOString().slice(0, 10),
    windowDays,
    expired: {
      batches: expired.batches,
      units: expired.units,
      costValue: expired.costValue.toFixed(2),
    },
    nearExpiry: {
      batches: nearExpiry.batches,
      units: nearExpiry.units,
      costValue: nearExpiry.costValue.toFixed(2),
    },
    groups: [...groups.values()]
      .map((group) => ({
        medicineId: group.medicine.id,
        name: group.medicine.name,
        sku: group.medicine.sku,
        unit: group.medicine.unit,
        expiredBatches: group.expiredBatches,
        expiredUnits: group.expiredUnits,
        nearExpiryBatches: group.nearExpiryBatches,
        nearExpiryUnits: group.nearExpiryUnits,
        costValueAtRisk: group.costValueAtRisk.toFixed(2),
        batches: group.batches,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

interface ReconRow {
  batch_id: number;
  batch_no: string;
  medicine_id: number;
  medicine_name: string;
  opening: number;
  purchases: number;
  sales: number;
  returns: number;
  adjustments: number;
  closing: number;
  current_quantity: number;
  difference: number;
}

export interface ReconciliationParams extends DateRangeParams {
  clock?: Clock | undefined;
}

/**
 * Rebuilds each batch balance from the ledger for the period and compares it
 * with the stored quantity. The comparison is only meaningful when `to` is
 * today or later; a past period cannot know about later movements.
 *
 * Opening folds in the batch's OPENING movement when the batch itself was
 * created inside the period, so purchased and seeded batches both reconcile.
 */
export async function getReconciliation(
  params: ReconciliationParams,
): Promise<ReconciliationReport> {
  assertRange(params.from, params.to);
  const clock = params.clock ?? systemClock;
  const today = startOfToday(clock).toISOString().slice(0, 10);
  const checksCurrent = params.to >= today;

  const checkedRows = await prisma.$queryRaw<Array<{ checked: number }>>`
    SELECT COUNT(*)::int AS checked
    FROM batches b
    WHERE b.created_at < ${params.to}::date + INTERVAL '1 day'
  `;
  const checkedBatches = checkedRows[0]?.checked ?? 0;

  if (!checksCurrent) {
    return {
      from: params.from,
      to: params.to,
      checksCurrent,
      checkedBatches,
      mismatchCount: 0,
      mismatches: [],
    };
  }

  const rows = await prisma.$queryRaw<ReconRow[]>`
    WITH rollup AS (
      SELECT
        m.batch_id,
        COALESCE(SUM(m.qty_delta) FILTER (WHERE m.created_at < ${params.from}::date), 0)::int AS opening_before,
        COALESCE(SUM(m.qty_delta) FILTER (
          WHERE m.type = 'OPENING'
            AND m.created_at >= ${params.from}::date
            AND m.created_at < ${params.to}::date + INTERVAL '1 day'
        ), 0)::int AS opening_in_range,
        COALESCE(SUM(m.qty_delta) FILTER (
          WHERE m.type = 'PURCHASE'
            AND m.created_at >= ${params.from}::date
            AND m.created_at < ${params.to}::date + INTERVAL '1 day'
        ), 0)::int AS purchases,
        COALESCE(SUM(-m.qty_delta) FILTER (
          WHERE m.type = 'SALE'
            AND m.created_at >= ${params.from}::date
            AND m.created_at < ${params.to}::date + INTERVAL '1 day'
        ), 0)::int AS sales,
        COALESCE(SUM(m.qty_delta) FILTER (
          WHERE m.type = 'RETURN'
            AND m.created_at >= ${params.from}::date
            AND m.created_at < ${params.to}::date + INTERVAL '1 day'
        ), 0)::int AS returns,
        COALESCE(SUM(m.qty_delta) FILTER (
          WHERE m.type = 'ADJUSTMENT'
            AND m.created_at >= ${params.from}::date
            AND m.created_at < ${params.to}::date + INTERVAL '1 day'
        ), 0)::int AS adjustments
      FROM stock_movements m
      GROUP BY m.batch_id
    ),
    reconciled AS (
      SELECT
        b.id AS batch_id,
        b.batch_no,
        b.medicine_id,
        med.name AS medicine_name,
        (r.opening_before + r.opening_in_range)::int AS opening,
        r.purchases,
        r.sales,
        r.returns,
        r.adjustments,
        (r.opening_before + r.opening_in_range + r.purchases - r.sales + r.returns + r.adjustments)::int AS closing,
        b.quantity_on_hand AS current_quantity,
        (
          (r.opening_before + r.opening_in_range + r.purchases - r.sales + r.returns + r.adjustments)
          - b.quantity_on_hand
        )::int AS difference
      FROM batches b
      JOIN medicines med ON med.id = b.medicine_id
      JOIN rollup r ON r.batch_id = b.id
      WHERE b.created_at < ${params.to}::date + INTERVAL '1 day'
    )
    SELECT *
    FROM reconciled
    WHERE difference <> 0
    ORDER BY ABS(difference) DESC, batch_id
  `;

  return {
    from: params.from,
    to: params.to,
    checksCurrent,
    checkedBatches,
    mismatchCount: rows.length,
    mismatches: rows.map((row) => ({
      batchId: row.batch_id,
      batchNo: row.batch_no,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name,
      opening: row.opening,
      purchases: row.purchases,
      sales: row.sales,
      returns: row.returns,
      adjustments: row.adjustments,
      closing: row.closing,
      currentQuantity: row.current_quantity,
      difference: row.difference,
    })),
  };
}
