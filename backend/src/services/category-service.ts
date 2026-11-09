import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';
import { isUniqueConstraintError } from '../utils/prisma-errors.js';
import { logAudit } from './audit-service.js';

export interface CategoryListItem {
  id: number;
  name: string;
  medicineCount: number;
  createdAt: Date;
}

export interface ListCategoriesParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

const listSelect = {
  id: true,
  name: true,
  createdAt: true,
  _count: { select: { medicines: true } },
} as const;

export async function listCategories(
  params: ListCategoriesParams,
): Promise<{ data: CategoryListItem[]; meta: PageMeta }> {
  const where: Prisma.CategoryWhereInput = params.search
    ? { name: { contains: params.search, mode: 'insensitive' } }
    : {};

  const [total, rows] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...paginationArgs(params),
      select: listSelect,
    }),
  ]);

  return {
    data: rows.map(({ _count, ...category }) => ({ ...category, medicineCount: _count.medicines })),
    meta: pageMeta(total, params),
  };
}

export async function createCategory(input: { name: string }, actorId: number): Promise<CategoryListItem> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Friendly, case-insensitive duplicate check; the DB unique index is the
      // race backstop below.
      const duplicate = await tx.category.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
        select: { id: true },
      });

      if (duplicate) {
        throw AppError.conflict(`A category named "${input.name}" already exists`);
      }

      const created = await tx.category.create({
        data: { name: input.name },
        select: { id: true, name: true, createdAt: true },
      });

      await logAudit(
        {
          userId: actorId,
          action: 'CREATE',
          entityType: 'CATEGORY',
          entityId: created.id,
          after: { id: created.id, name: created.name },
        },
        tx,
      );

      return { ...created, medicineCount: 0 };
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(`A category named "${input.name}" already exists`);
    }
    throw error;
  }
}
