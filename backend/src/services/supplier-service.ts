import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { isUniqueConstraintError } from '../utils/prisma-errors.js';
import { logAudit } from './audit-service.js';

export interface SupplierListItem {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListSuppliersParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  isActive?: boolean | undefined;
}

export interface CreateSupplierInput {
  name: string;
  contactPerson?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  isActive?: boolean | undefined;
}

const supplierSelect = {
  id: true,
  name: true,
  contactPerson: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listSuppliers(
  params: ListSuppliersParams,
): Promise<{ data: SupplierListItem[]; meta: PageMeta }> {
  const where: Prisma.SupplierWhereInput = {
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' as const } },
            { contactPerson: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...paginationArgs(params),
      select: supplierSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}

export async function createSupplier(
  input: CreateSupplierInput,
  actorId: number,
): Promise<SupplierListItem> {
  try {
    return await prisma.$transaction(async (tx) => {
      const duplicate = await tx.supplier.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
        select: { id: true },
      });

      if (duplicate) {
        throw AppError.conflict(`A supplier named "${input.name}" already exists`);
      }

      const created = await tx.supplier.create({
        data: {
          name: input.name,
          contactPerson: input.contactPerson ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          isActive: input.isActive ?? true,
        },
        select: supplierSelect,
      });

      await logAudit(
        {
          userId: actorId,
          action: 'CREATE',
          entityType: 'SUPPLIER',
          entityId: created.id,
          after: { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() },
        },
        tx,
      );

      return created;
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(`A supplier named "${input.name}" already exists`);
    }
    throw error;
  }
}
