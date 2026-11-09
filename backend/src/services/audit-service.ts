import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

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
