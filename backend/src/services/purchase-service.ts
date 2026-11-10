import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { isExpired, startOfToday, systemClock, toCalendarDay, type Clock } from '../utils/clock.js';
import { lineSubtotal, money, sumMoney } from '../utils/money.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { isUniqueConstraintError } from '../utils/prisma-errors.js';
import { logAudit } from './audit-service.js';
import { applyStockMovement } from './stock-movement-service.js';

/** One purchase line, already normalised by Zod (money = "x.xx", batchNo upper-case). */
export interface PurchaseItemInput {
  medicineId: number;
  batchNo: string;
  quantity: number;
  costPrice: string;
  salePrice: string;
  expiryDate: string;
}

export interface CreatePurchaseInput {
  supplierId: number;
  supplierInvoiceNo: string;
  purchaseDate?: string | undefined;
  items: PurchaseItemInput[];
}

export interface ListPurchasesParams {
  page: number;
  pageSize: number;
  supplierId?: number | undefined;
  search?: string | undefined;
}

const purchaseSelect = {
  id: true,
  supplierId: true,
  supplierInvoiceNo: true,
  purchaseDate: true,
  totalCost: true,
  createdById: true,
  createdAt: true,
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      medicineId: true,
      batchId: true,
      quantity: true,
      costPrice: true,
      salePrice: true,
      expiryDate: true,
      medicine: { select: { id: true, name: true, sku: true } },
      batch: { select: { id: true, batchNo: true, expiryDate: true, quantityOnHand: true } },
    },
  },
} as const;

export type Purchase = Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>;

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function purchaseSnapshot(purchase: Purchase): Prisma.InputJsonObject {
  return {
    id: purchase.id,
    supplierId: purchase.supplierId,
    supplierInvoiceNo: purchase.supplierInvoiceNo,
    purchaseDate: purchase.purchaseDate.toISOString(),
    totalCost: purchase.totalCost.toString(),
    itemCount: purchase.items.length,
  };
}

/**
 * Receives stock and creates the matching ledger rows (B5).
 *
 * All writes run in ONE transaction:
 *   purchase → batches (create or merge) → PURCHASE movements → purchase items → audit.
 * Quantities only change through `applyStockMovement`, never by direct assignment.
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  actorId: number,
  clock: Clock = systemClock,
): Promise<Purchase> {
  // Reject duplicate (medicine, batch) lines before touching stock: the same
  // batch cannot appear twice in one invoice, otherwise the merge rules and the
  // total become ambiguous.
  const lineKeys = new Set<string>();
  for (const item of input.items) {
    const key = `${item.medicineId}:${item.batchNo}`;
    if (lineKeys.has(key)) {
      throw AppError.validation('The same batch appears more than once in this purchase', {
        medicineId: item.medicineId,
        batchNo: item.batchNo,
      });
    }
    lineKeys.add(key);
  }

  // Date-only comparison: a batch expiring today is already expired (BR-3),
  // and buying stock that cannot be sold is rejected up front.
  const lines = input.items.map((item, index) => {
    const expiryDate = parseDateOnly(item.expiryDate);
    if (isExpired(expiryDate, clock)) {
      throw AppError.validation('Expiry date must be in the future', {
        [`items.${index}.expiryDate`]: 'Expiry date must be in the future',
      });
    }
    return { ...item, expiryDate, costPrice: money(item.costPrice), salePrice: money(item.salePrice) };
  });

  const totalCost = sumMoney(lines.map((line) => lineSubtotal(line.quantity, line.costPrice)));
  const purchaseDate = input.purchaseDate
    ? parseDateOnly(input.purchaseDate)
    : startOfToday(clock);

  try {
    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
        select: { id: true, isActive: true },
      });
      if (!supplier) {
        throw AppError.validation('Supplier does not exist', { supplierId: 'Unknown supplier' });
      }
      if (!supplier.isActive) {
        throw AppError.validation('Inactive suppliers cannot receive stock', {
          supplierId: 'Inactive supplier',
        });
      }

      const medicineIds = [...new Set(input.items.map((item) => item.medicineId))];
      const medicines = await tx.medicine.findMany({
        where: { id: { in: medicineIds } },
        select: { id: true, isActive: true },
      });
      const known = new Map(medicines.map((medicine) => [medicine.id, medicine]));
      const missing = medicineIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw AppError.validation('One or more medicines do not exist', { medicineIds: missing });
      }
      const inactive = medicines
        .filter((medicine) => !medicine.isActive)
        .map((medicine) => medicine.id);
      if (inactive.length > 0) {
        throw AppError.validation('Inactive medicines cannot be purchased', {
          medicineIds: inactive,
        });
      }

      const purchase = await tx.purchase.create({
        data: {
          supplierId: input.supplierId,
          supplierInvoiceNo: input.supplierInvoiceNo,
          purchaseDate,
          totalCost,
          createdById: actorId,
        },
        select: { id: true },
      });

      for (const line of lines) {
        const existing = await tx.batch.findUnique({
          where: { medicineId_batchNo: { medicineId: line.medicineId, batchNo: line.batchNo } },
          select: { id: true, expiryDate: true },
        });

        let batchId: number;
        if (existing) {
          // A batch number identifies a physical lot: same number + different
          // expiry is a data-entry conflict, never a silent merge.
          if (toCalendarDay(existing.expiryDate).getTime() !== line.expiryDate.getTime()) {
            throw new AppError(
              'INVALID_STATE',
              `Batch ${line.batchNo} already exists with a different expiry date`,
              {
                medicineId: line.medicineId,
                batchNo: line.batchNo,
                existingExpiry: existing.expiryDate.toISOString().slice(0, 10),
                requestedExpiry: line.expiryDate.toISOString().slice(0, 10),
              },
            );
          }

          // Decision #26: the batch keeps one current price, so a merge adopts
          // the latest purchase's cost/sale price and supplier.
          await tx.batch.update({
            where: { id: existing.id },
            data: {
              purchasePrice: line.costPrice,
              salePrice: line.salePrice,
              supplierId: input.supplierId,
            },
          });
          batchId = existing.id;
        } else {
          const created = await tx.batch.create({
            data: {
              medicineId: line.medicineId,
              batchNo: line.batchNo,
              expiryDate: line.expiryDate,
              quantityOnHand: 0,
              purchasePrice: line.costPrice,
              salePrice: line.salePrice,
              supplierId: input.supplierId,
            },
            select: { id: true },
          });
          batchId = created.id;
        }

        await applyStockMovement(
          {
            batchId,
            qtyDelta: line.quantity,
            type: 'PURCHASE',
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            createdById: actorId,
          },
          tx,
        );

        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            medicineId: line.medicineId,
            batchId,
            quantity: line.quantity,
            costPrice: line.costPrice,
            salePrice: line.salePrice,
            expiryDate: line.expiryDate,
          },
        });
      }

      const created = await tx.purchase.findUniqueOrThrow({
        where: { id: purchase.id },
        select: purchaseSelect,
      });

      await logAudit(
        {
          userId: actorId,
          action: 'CREATE',
          entityType: 'PURCHASE',
          entityId: created.id,
          after: purchaseSnapshot(created),
        },
        tx,
      );

      return created;
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict('A batch with this medicine and batch number already exists');
    }
    throw error;
  }
}

export async function listPurchases(
  params: ListPurchasesParams,
): Promise<{ data: Purchase[]; meta: PageMeta }> {
  const where: Prisma.PurchaseWhereInput = {
    ...(params.supplierId !== undefined ? { supplierId: params.supplierId } : {}),
    ...(params.search
      ? { supplierInvoiceNo: { contains: params.search, mode: 'insensitive' as const } }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: purchaseSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}

export async function getPurchaseById(id: number): Promise<Purchase> {
  const purchase = await prisma.purchase.findUnique({ where: { id }, select: purchaseSelect });
  if (!purchase) {
    throw AppError.notFound('Purchase not found');
  }
  return purchase;
}

