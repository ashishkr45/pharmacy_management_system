import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { isUniqueConstraintError } from '../utils/prisma-errors.js';
import { logAudit } from './audit-service.js';

const medicineSelect = {
  id: true,
  name: true,
  genericName: true,
  sku: true,
  categoryId: true,
  unit: true,
  reorderLevel: true,
  taxRate: true,
  defaultSalePrice: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} as const;

/** Row shape returned by every medicine endpoint. */
export type Medicine = Prisma.MedicineGetPayload<{ select: typeof medicineSelect }>;

export interface ListMedicinesParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  categoryId?: number | undefined;
  isActive?: boolean | undefined;
}

export interface CreateMedicineInput {
  name: string;
  genericName?: string | null | undefined;
  sku: string;
  categoryId: number;
  unit: string;
  reorderLevel?: number | undefined;
  taxRate?: string | null | undefined;
  defaultSalePrice?: string | null | undefined;
  isActive?: boolean | undefined;
}

/**
 * Partial update input. Written as a mapped type (instead of `Partial<T>`) so
 * every optional field explicitly admits `undefined` under
 * `exactOptionalPropertyTypes`, matching what Zod produces for omitted keys.
 */
export type UpdateMedicineInput = {
  [K in keyof CreateMedicineInput]?: CreateMedicineInput[K] | undefined;
};

/** Audit snapshot: Decimal → string, so the JSON column stays JSON-safe. */
function medicineSnapshot(medicine: Medicine): Prisma.InputJsonObject {
  return {
    id: medicine.id,
    name: medicine.name,
    genericName: medicine.genericName,
    sku: medicine.sku,
    categoryId: medicine.categoryId,
    unit: medicine.unit,
    reorderLevel: medicine.reorderLevel,
    taxRate: medicine.taxRate?.toString() ?? null,
    defaultSalePrice: medicine.defaultSalePrice?.toString() ?? null,
    isActive: medicine.isActive,
  };
}

async function assertCategoryExists(client: Prisma.TransactionClient, categoryId: number): Promise<void> {
  const category = await client.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) {
    throw AppError.validation('Category does not exist', { categoryId: 'Unknown category' });
  }
}

export async function listMedicines(
  params: ListMedicinesParams,
): Promise<{ data: Medicine[]; meta: PageMeta }> {
  const where: Prisma.MedicineWhereInput = {
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' as const } },
            { genericName: { contains: params.search, mode: 'insensitive' as const } },
            { sku: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.categoryId !== undefined ? { categoryId: params.categoryId } : {}),
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.medicine.count({ where }),
    prisma.medicine.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...paginationArgs(params),
      select: medicineSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}

export async function getMedicineById(id: number): Promise<Medicine> {
  const medicine = await prisma.medicine.findUnique({ where: { id }, select: medicineSelect });
  if (!medicine) {
    throw AppError.notFound('Medicine not found');
  }
  return medicine;
}

export async function createMedicine(input: CreateMedicineInput, actorId: number): Promise<Medicine> {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertCategoryExists(tx, input.categoryId);

      const created = await tx.medicine.create({
        data: {
          name: input.name,
          genericName: input.genericName ?? null,
          sku: input.sku.trim().toUpperCase(),
          categoryId: input.categoryId,
          unit: input.unit,
          reorderLevel: input.reorderLevel ?? 0,
          taxRate: input.taxRate ?? null,
          defaultSalePrice: input.defaultSalePrice ?? null,
          isActive: input.isActive ?? true,
        },
        select: medicineSelect,
      });

      await logAudit(
        {
          userId: actorId,
          action: 'CREATE',
          entityType: 'MEDICINE',
          entityId: created.id,
          after: medicineSnapshot(created),
        },
        tx,
      );

      return created;
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(`A medicine with SKU "${input.sku}" already exists`);
    }
    throw error;
  }
}

export async function updateMedicine(
  id: number,
  input: UpdateMedicineInput,
  actorId: number,
): Promise<Medicine> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.medicine.findUnique({ where: { id }, select: medicineSelect });
      if (!existing) {
        throw AppError.notFound('Medicine not found');
      }

      if (input.categoryId !== undefined) {
        await assertCategoryExists(tx, input.categoryId);
      }

      const data: Prisma.MedicineUncheckedUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.genericName !== undefined) data.genericName = input.genericName;
      if (input.sku !== undefined) data.sku = input.sku.trim().toUpperCase();
      if (input.categoryId !== undefined) data.categoryId = input.categoryId;
      if (input.unit !== undefined) data.unit = input.unit;
      if (input.reorderLevel !== undefined) data.reorderLevel = input.reorderLevel;
      if (input.taxRate !== undefined) data.taxRate = input.taxRate;
      if (input.defaultSalePrice !== undefined) data.defaultSalePrice = input.defaultSalePrice;
      if (input.isActive !== undefined) data.isActive = input.isActive;

      const updated = await tx.medicine.update({ where: { id }, data, select: medicineSelect });

      await logAudit(
        {
          userId: actorId,
          action: 'UPDATE',
          entityType: 'MEDICINE',
          entityId: id,
          before: medicineSnapshot(existing),
          after: medicineSnapshot(updated),
        },
        tx,
      );

      return updated;
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(`A medicine with SKU "${input.sku ?? ''}" already exists`);
    }
    throw error;
  }
}
