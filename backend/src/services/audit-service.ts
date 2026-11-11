import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { dateRangeFilter } from '../utils/date-range.js';
import { pageMeta, paginationArgs, type PageMeta } from '../utils/pagination.js';

export interface AuditLogInput {
  /** The authenticated user performing the action. */
  userId: number;
  /** Verb performed on the entity, e.g. CREATE / UPDATE (later: SALE, RETURN…). */
  action: string;
  /** Domain entity name, e.g. CATEGORY / SUPPLIER / MEDICINE. */
  entityType: string;
  entityId: string | number;
  /** Snapshot before the change (updates/deletes only). Must be JSON-safe. */
  before?: Prisma.InputJsonValue;
  /** Snapshot after the change. */
  after?: Prisma.InputJsonValue;
}

/**
 * Writes one `audit_logs` row (BR-13).
 *
 * Pass the transaction client when the action being audited is itself in a
 * transaction, so the audit row commits or rolls back with the change. `before`
 * and `after` must contain plain JSON values — convert Decimal to string and
 * Date to ISO, never pass JS floats.
 */
export async function logAudit(
  input: AuditLogInput,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: String(input.entityId),
      ...(input.before !== undefined ? { before: input.before } : {}),
      ...(input.after !== undefined ? { after: input.after } : {}),
    },
  });
}

export interface ListAuditLogsParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  userId?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const auditLogSelect = {
  id: true,
  userId: true,
  action: true,
  entityType: true,
  entityId: true,
  before: true,
  after: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

export type AuditLogView = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

/** Admin audit trail, newest first, with the same filters used by the UI. */
export async function listAuditLogs(
  params: ListAuditLogsParams,
): Promise<{ data: AuditLogView[]; meta: PageMeta }> {
  const createdAt = dateRangeFilter(params.from, params.to);
  const where: Prisma.AuditLogWhereInput = {
    ...(params.action
      ? { action: { equals: params.action, mode: 'insensitive' as const } }
      : {}),
    ...(params.entityType
      ? { entityType: { equals: params.entityType, mode: 'insensitive' as const } }
      : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(params.userId !== undefined ? { userId: params.userId } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(params.search
      ? {
          OR: [
            { action: { contains: params.search, mode: 'insensitive' as const } },
            { entityType: { contains: params.search, mode: 'insensitive' as const } },
            { entityId: { contains: params.search } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginationArgs(params),
      select: auditLogSelect,
    }),
  ]);

  return { data: rows, meta: pageMeta(total, params) };
}
