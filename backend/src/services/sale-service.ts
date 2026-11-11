import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { TRANSACTION_OPTIONS } from '../db/transaction-options.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { startOfToday, systemClock, type Clock } from '../utils/clock.js';
import { dateRangeFilter } from '../utils/date-range.js';
import { lineSubtotal, money, sumMoney, taxOn } from '../utils/money.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { isUniqueConstraintError } from '../utils/prisma-errors.js';
import { logAudit } from './audit-service.js';
import { allocateFefo, type FefoAllocation, type FefoCandidate } from './fefo.js';
import { applyStockMovement } from './stock-movement-service.js';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

export interface SaleItemInput {
  medicineId: number;
  quantity: number;
}

export interface CreateSaleInput {
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  paymentMethod: PaymentMethod;
  items: SaleItemInput[];
}

export interface ListSalesParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  status?: 'COMPLETED' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED' | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface CreateSaleResult {
  sale: Sale;
  /** True when this Idempotency-Key + payload was already seen. */
  replayed: boolean;
}

interface LockedBatch {
  id: number;
  medicine_id: number;
  expiry_date: Date;
  quantity_on_hand: number;
  sale_price: Prisma.Decimal | string;
}

interface SellableMedicine {
  id: number;
  name: string;
  taxRate: Prisma.Decimal | null;
}

interface PricedLine {
  medicineId: number;
  batchId: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

const saleSelect = {
  id: true,
  invoiceNo: true,
  customerName: true,
  customerPhone: true,
  paymentMethod: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  status: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      medicineId: true,
      batchId: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      taxAmount: true,
      lineTotal: true,
      returnedQuantity: true,
      medicine: { select: { id: true, name: true, sku: true, unit: true } },
      batch: { select: { id: true, batchNo: true, expiryDate: true } },
    },
  },
} as const;

export type Sale = Prisma.SaleGetPayload<{ select: typeof saleSelect }>;

/** Deterministic JSON, so the same logical payload always hashes the same. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function requestHash(input: CreateSaleInput): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

async function findExistingByKey(idempotencyKey: string, hash: string): Promise<Sale | null> {
  const existing = await prisma.sale.findUnique({
    where: { idempotencyKey },
    select: { id: true, requestHash: true },
  });

  if (!existing) {
    return null;
  }
  if (existing.requestHash !== hash) {
    throw new AppError(
      'IDEMPOTENCY_CONFLICT',
      'This Idempotency-Key was already used with a different payload',
      { idempotencyKey },
    );
  }
  return getSaleById(existing.id);
}

function groupCandidatesByMedicine(locked: LockedBatch[]): Map<number, FefoCandidate[]> {
  const byMedicine = new Map<number, FefoCandidate[]>();

  for (const row of locked) {
    const candidates = byMedicine.get(row.medicine_id) ?? [];
    candidates.push({
      batchId: row.id,
      expiryDate: row.expiry_date,
      quantityOnHand: row.quantity_on_hand,
    });
    byMedicine.set(row.medicine_id, candidates);
  }

  return byMedicine;
}

/** Allocates each requested medicine with FEFO and prices it from the DB rows. */
function buildPricedLines(
  items: SaleItemInput[],
  medicineById: Map<number, SellableMedicine>,
  candidatesByMedicine: Map<number, FefoCandidate[]>,
  salePriceByBatch: Map<number, Prisma.Decimal>,
  defaultTaxRate: Prisma.Decimal,
  today: Date,
): PricedLine[] {
  const lines: PricedLine[] = [];

  for (const item of items) {
    const medicine = medicineById.get(item.medicineId);
    if (!medicine) {
      throw new Error(`Medicine ${item.medicineId} passed validation but is missing`);
    }

    let allocations: FefoAllocation[];
    try {
      allocations = allocateFefo(
        candidatesByMedicine.get(item.medicineId) ?? [],
        item.quantity,
        today,
      );
    } catch (error: unknown) {
      if (!(error instanceof AppError) || error.code !== 'INSUFFICIENT_STOCK') {
        throw error;
      }
      throw new AppError('INSUFFICIENT_STOCK', `${medicine.name}: ${error.message}`, {
        medicineId: medicine.id,
        ...error.details,
      });
    }

    const taxRate = money(medicine.taxRate ?? defaultTaxRate);

    for (const allocation of allocations) {
      const unitPrice = salePriceByBatch.get(allocation.batchId);
      if (!unitPrice) {
        throw new Error(`Batch ${allocation.batchId} was locked but has no sale price`);
      }

      const subtotal = lineSubtotal(allocation.quantity, unitPrice);
      const taxAmount = taxOn(subtotal, taxRate);

      lines.push({
        medicineId: item.medicineId,
        batchId: allocation.batchId,
        quantity: allocation.quantity,
        unitPrice,
        taxRate,
        taxAmount,
        lineTotal: subtotal.add(taxAmount),
      });
    }
  }

  return lines;
}

function invoiceNumberFor(saleId: number, createdAt: Date): string {
  return `INV-${createdAt.getUTCFullYear()}-${String(saleId).padStart(6, '0')}`;
}

/**
 * Creates a sale in one transaction: validate medicines → lock usable batches
 * (ascending id) → FEFO → price/tax from the DB → sale, items and SALE
 * movements → invoice number → audit.
 *
 * The client only sends medicine ids and quantities; batch, price, tax and
 * totals are decided here (BR-11).
 */
export async function createSale(
  input: CreateSaleInput,
  actorId: number,
  idempotencyKey: string,
  clock: Clock = systemClock,
): Promise<CreateSaleResult> {
  const hash = requestHash(input);

  // A retry returns the original sale without opening a transaction.
  const replay = await findExistingByKey(idempotencyKey, hash);
  if (replay) {
    return { sale: replay, replayed: true };
  }

  const medicineIds = input.items.map((item) => item.medicineId);
  if (new Set(medicineIds).size !== medicineIds.length) {
    throw AppError.validation('Each medicine may appear only once per sale', {
      items: 'Duplicate medicine in the same sale',
    });
  }

  const today = startOfToday(clock);
  const todayIso = today.toISOString().slice(0, 10);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const medicines = await tx.medicine.findMany({
          where: { id: { in: medicineIds } },
          select: { id: true, name: true, taxRate: true, isActive: true },
        });
        const medicineById = new Map<number, SellableMedicine>(
          medicines.map((medicine) => [medicine.id, medicine]),
        );

        const missing = medicineIds.filter((id) => !medicineById.has(id));
        if (missing.length > 0) {
          throw AppError.validation('One or more medicines do not exist', { medicineIds: missing });
        }

        const inactive = medicines
          .filter((medicine) => !medicine.isActive)
          .map((medicine) => medicine.id);
        if (inactive.length > 0) {
          throw AppError.validation('Inactive medicines cannot be sold', { medicineIds: inactive });
        }

        const setting = await tx.setting.findUnique({
          where: { key: 'defaultTaxRate' },
          select: { value: true },
        });
        const defaultTaxRate = money(setting?.value ?? '0');

        // One statement locks every usable batch in ascending id, which is the
        // shared lock order that prevents concurrent sales from deadlocking.
        // Expired batches are excluded here, so they can never be sold.
        const locked = await tx.$queryRaw<LockedBatch[]>`
          SELECT id, medicine_id, expiry_date, quantity_on_hand, sale_price
          FROM batches
          WHERE medicine_id IN (${Prisma.join(medicineIds)})
            AND quantity_on_hand > 0
            AND expiry_date > ${todayIso}::date
          ORDER BY id
          FOR UPDATE
        `;

        const salePriceByBatch = new Map(
          locked.map((row) => [row.id, money(row.sale_price)] as const),
        );
        const pricedLines = buildPricedLines(
          input.items,
          medicineById,
          groupCandidatesByMedicine(locked),
          salePriceByBatch,
          defaultTaxRate,
          today,
        );

        const subtotal = sumMoney(
          pricedLines.map((line) => lineSubtotal(line.quantity, line.unitPrice)),
        );
        const taxTotal = sumMoney(pricedLines.map((line) => line.taxAmount));
        const total = subtotal.add(taxTotal);

        // The invoice number needs the generated id, so insert a unique
        // placeholder first and replace it in the same transaction.
        const sale = await tx.sale.create({
          data: {
            invoiceNo: `PENDING-${randomUUID()}`,
            customerName: input.customerName ?? null,
            customerPhone: input.customerPhone ?? null,
            paymentMethod: input.paymentMethod,
            subtotal,
            taxTotal,
            total,
            idempotencyKey,
            requestHash: hash,
            createdById: actorId,
          },
          select: { id: true, createdAt: true },
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: { invoiceNo: invoiceNumberFor(sale.id, sale.createdAt) },
        });

        for (const line of pricedLines) {
          await applyStockMovement(
            {
              batchId: line.batchId,
              qtyDelta: -line.quantity,
              type: 'SALE',
              referenceType: 'SALE',
              referenceId: sale.id,
              createdById: actorId,
            },
            tx,
          );

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              medicineId: line.medicineId,
              batchId: line.batchId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
              lineTotal: line.lineTotal,
            },
          });
        }

        const created = await tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          select: saleSelect,
        });

        await logAudit(
          {
            userId: actorId,
            action: 'CREATE',
            entityType: 'SALE',
            entityId: created.id,
            after: {
              id: created.id,
              invoiceNo: created.invoiceNo,
              total: created.total.toString(),
              itemCount: created.items.length,
              customerName: created.customerName,
            },
          },
          tx,
        );

        return { sale: created, replayed: false };
      },
      TRANSACTION_OPTIONS,
    );
  } catch (error: unknown) {
    // Two identical requests can race past the fast path. The unique
    // idempotency key lets one win; the loser returns the winner's sale.
    if (isUniqueConstraintError(error)) {
      const winner = await findExistingByKey(idempotencyKey, hash);
      if (winner) {
        return { sale: winner, replayed: true };
      }
    }
    throw error;
  }
}

export async function listSales(
  params: ListSalesParams,
): Promise<{ data: Sale[]; meta: PageMeta }> {
  const createdAt = dateRangeFilter(params.from, params.to);

  const where: Prisma.SaleWhereInput = {
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { invoiceNo: { contains: params.search, mode: 'insensitive' as const } },
            { customerName: { contains: params.search, mode: 'insensitive' as const } },
            { customerPhone: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: saleSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}

export async function getSaleById(id: number): Promise<Sale> {
  const sale = await prisma.sale.findUnique({ where: { id }, select: saleSelect });
  if (!sale) {
    throw AppError.notFound('Sale not found');
  }
  return sale;
}
