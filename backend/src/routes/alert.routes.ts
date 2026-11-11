import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import { listExpired, listLowStock, listNearExpiry } from '../services/alert-service.js';
import { listQuery, type ListQuery } from './query-schemas.js';

export const alertRouter = Router();

alertRouter.use(authenticate);

/** GET /api/v1/alerts/low-stock?page&pageSize&search — all roles. */
alertRouter.get('/low-stock', validateQuery(listQuery), async (_req, res) => {
  const query = getValidatedQuery<ListQuery>(res);
  const result = await listLowStock(query);
  res.json(result);
});

/** GET /api/v1/alerts/near-expiry?page&pageSize&search — window from settings. */
alertRouter.get('/near-expiry', validateQuery(listQuery), async (_req, res) => {
  const query = getValidatedQuery<ListQuery>(res);
  const result = await listNearExpiry(query);
  res.json(result);
});

/** GET /api/v1/alerts/expired?page&pageSize&search — expired stock still on hand. */
alertRouter.get('/expired', validateQuery(listQuery), async (_req, res) => {
  const query = getValidatedQuery<ListQuery>(res);
  const result = await listExpired(query);
  res.json(result);
});
