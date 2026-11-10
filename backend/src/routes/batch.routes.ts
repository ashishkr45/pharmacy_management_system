import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import { getBatchById, listBatches, type BatchView } from '../services/inventory-service.js';
import { parseIdParam } from '../utils/parse-id.js';
import { activeParam, listQuery } from './query-schemas.js';

const listBatchesQuery = listQuery.extend({
  medicineId: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  expired: activeParam,
  hasStock: activeParam,
});

type ListBatchesQuery = z.infer<typeof listBatchesQuery>;

export const batchRouter = Router();

batchRouter.use(authenticate);

/** GET /api/v1/batches?page&pageSize&search&medicineId&supplierId&expired&hasStock */
batchRouter.get('/', validateQuery(listBatchesQuery), async (_req, res) => {
  const query = getValidatedQuery<ListBatchesQuery>(res);
  const result = await listBatches(query);
  res.json(result);
});

/** GET /api/v1/batches/:id */
batchRouter.get('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Batch');
  const batch: BatchView = await getBatchById(id);
  res.json({ data: batch });
});
