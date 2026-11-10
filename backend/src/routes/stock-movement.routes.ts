import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import { listStockMovements } from '../services/inventory-service.js';
import { listQuery } from './query-schemas.js';
import { dateOnly } from './validation-schemas.js';

const movementType = z.enum(['OPENING', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT']);

const listMovementsQuery = listQuery.extend({
  batchId: z.coerce.number().int().positive().optional(),
  type: movementType.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

type ListMovementsQuery = z.infer<typeof listMovementsQuery>;

export const stockMovementRouter = Router();

stockMovementRouter.use(authenticate);

/** GET /api/v1/stock-movements?page&pageSize&batchId&type&from&to */
stockMovementRouter.get('/', validateQuery(listMovementsQuery), async (_req, res) => {
  const query = getValidatedQuery<ListMovementsQuery>(res);
  const result = await listStockMovements(query);
  res.json(result);
});
