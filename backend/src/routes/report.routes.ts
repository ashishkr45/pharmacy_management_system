import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateQuery } from '../middleware/validate.js';
import {
  getExpiryReport,
  getReconciliation,
  getSalesReport,
  getStockValuation,
} from '../services/report-service.js';
import { activeParam } from './query-schemas.js';
import { dateOnly } from './validation-schemas.js';

const rangeQuery = z
  .object({ from: dateOnly, to: dateOnly })
  .refine((value) => value.from <= value.to, {
    message: '`from` must be on or before `to`',
    path: ['to'],
  });

const expiryQuery = z.object({
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

const valuationQuery = z.object({ includeZero: activeParam });

type RangeQuery = z.infer<typeof rangeQuery>;
type ExpiryQuery = z.infer<typeof expiryQuery>;
type ValuationQuery = z.infer<typeof valuationQuery>;

export const reportRouter = Router();

reportRouter.use(authenticate);

/** GET /api/v1/reports/sales?from&to — ADMIN and PHARMACIST. */
reportRouter.get(
  '/sales',
  requireRole('ADMIN', 'PHARMACIST'),
  validateQuery(rangeQuery),
  async (_req, res) => {
    const query = getValidatedQuery<RangeQuery>(res);
    const report = await getSalesReport(query);
    res.json({ data: report });
  },
);

/** GET /api/v1/reports/stock-valuation?includeZero — ADMIN and INVENTORY_MANAGER. */
reportRouter.get(
  '/stock-valuation',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateQuery(valuationQuery),
  async (_req, res) => {
    const query = getValidatedQuery<ValuationQuery>(res);
    const report = await getStockValuation({ includeZero: query.includeZero === true });
    res.json({ data: report });
  },
);

/** GET /api/v1/reports/expiry?days — ADMIN and INVENTORY_MANAGER. */
reportRouter.get(
  '/expiry',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateQuery(expiryQuery),
  async (_req, res) => {
    const query = getValidatedQuery<ExpiryQuery>(res);
    const report = await getExpiryReport({ days: query.days });
    res.json({ data: report });
  },
);

/** GET /api/v1/reports/reconciliation?from&to — ADMIN and INVENTORY_MANAGER. */
reportRouter.get(
  '/reconciliation',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateQuery(rangeQuery),
  async (_req, res) => {
    const query = getValidatedQuery<RangeQuery>(res);
    const report = await getReconciliation(query);
    res.json({ data: report });
  },
);
