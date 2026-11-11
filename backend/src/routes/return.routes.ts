import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import { listReturns } from '../services/return-service.js';
import { paginationQuery } from './query-schemas.js';
import { dateOnly } from './validation-schemas.js';

const listReturnsQuery = paginationQuery.extend({
  saleId: z.coerce.number().int().positive().optional(),
  saleItemId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

type ListReturnsQuery = z.infer<typeof listReturnsQuery>;

export const returnRouter = Router();

returnRouter.use(authenticate);

/** GET /api/v1/returns?page&pageSize&saleId&saleItemId&from&to — return history. */
returnRouter.get('/', validateQuery(listReturnsQuery), async (_req, res) => {
  const query = getValidatedQuery<ListReturnsQuery>(res);
  const result = await listReturns(query);
  res.json(result);
});
