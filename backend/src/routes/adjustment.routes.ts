import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createAdjustment, listAdjustments } from '../services/adjustment-service.js';
import { paginationQuery } from './query-schemas.js';
import { dateOnly } from './validation-schemas.js';

const ADJUSTMENT_REASONS = ['DAMAGED', 'EXPIRED', 'COUNT_CORRECTION', 'LOST', 'OTHER'] as const;
const adjustmentReason = z.enum(ADJUSTMENT_REASONS);

const createAdjustmentBody = z.object({
  batchId: z.coerce.number().int().positive('A batch is required'),
  delta: z.coerce
    .number()
    .int('Delta must be a whole number')
    .refine((value) => value !== 0, 'Delta must not be zero')
    .refine((value) => Math.abs(value) <= 1_000_000, 'Delta is too large'),
  reasonCode: adjustmentReason,
  note: z.string().trim().max(500).optional(),
});

const listAdjustmentsQuery = paginationQuery.extend({
  batchId: z.coerce.number().int().positive().optional(),
  reasonCode: adjustmentReason.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

type CreateAdjustmentBody = z.infer<typeof createAdjustmentBody>;
type ListAdjustmentsQuery = z.infer<typeof listAdjustmentsQuery>;

export const adjustmentRouter = Router();

adjustmentRouter.use(authenticate);

/** GET /api/v1/adjustments?page&pageSize&batchId&reasonCode&from&to */
adjustmentRouter.get('/', validateQuery(listAdjustmentsQuery), async (_req, res) => {
  const query = getValidatedQuery<ListAdjustmentsQuery>(res);
  const result = await listAdjustments(query);
  res.json(result);
});

/** POST /api/v1/adjustments — ADMIN or INVENTORY_MANAGER. */
adjustmentRouter.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(createAdjustmentBody),
  async (req, res) => {
    const { userId } = currentAuth(req);
    const created = await createAdjustment(req.body as CreateAdjustmentBody, userId);
    res.status(201).json({ data: created });
  },
);
