import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import { listAuditLogs, type ListAuditLogsParams } from '../services/audit-service.js';
import { dateOnly } from './validation-schemas.js';
import { listQuery } from './query-schemas.js';

const listAuditLogsQuery = listQuery.extend({
  action: z.string().trim().min(1).max(50).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  entityId: z.string().trim().min(1).max(100).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>;

export const auditLogRouter = Router();

auditLogRouter.use(authenticate, requireRole('ADMIN'));

/** GET /api/v1/audit-logs?page&pageSize&search&action&entityType&entityId&userId&from&to */
auditLogRouter.get('/', validateQuery(listAuditLogsQuery), async (_req, res) => {
  const query = getValidatedQuery<ListAuditLogsQuery>(res);
  const result = await listAuditLogs(query as ListAuditLogsParams);
  res.json(result);
});
