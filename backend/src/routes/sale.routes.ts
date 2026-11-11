import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createReturn } from '../services/return-service.js';
import { createSale, getSaleById, listSales } from '../services/sale-service.js';
import { AppError } from '../utils/app-error.js';
import { parseIdParam } from '../utils/parse-id.js';
import { listQuery } from './query-schemas.js';
import { dateOnly } from './validation-schemas.js';

const saleItemBody = z.object({
  medicineId: z.coerce.number().int().positive('A medicine is required'),
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer').max(1_000_000),
});

const createSaleBody = z.object({
  customerName: z.string().trim().min(1).max(120).nullable().optional(),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+()\- ]{5,20}$/, 'Use digits, spaces, +, - or parentheses')
    .nullable()
    .optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI']),
  items: z.array(saleItemBody).min(1, 'Add at least one item').max(50, 'At most 50 lines per sale'),
});

const listSalesQuery = listQuery.extend({
  status: z.enum(['COMPLETED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED']).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

const createReturnBody = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  items: z
    .array(
      z.object({
        saleItemId: z.coerce.number().int().positive('A sale item is required'),
        quantity: z.coerce.number().int().positive('Quantity must be a positive integer').max(1_000_000),
      }),
    )
    .min(1, 'Add at least one item')
    .max(50, 'At most 50 lines per return'),
});

type CreateSaleBody = z.infer<typeof createSaleBody>;
type CreateReturnBody = z.infer<typeof createReturnBody>;
type ListSalesQuery = z.infer<typeof listSalesQuery>;

function readIdempotencyKey(req: Request): string {
  const key = req.header('Idempotency-Key')?.trim();
  if (!key) {
    throw AppError.validation('Idempotency-Key header is required for POST /sales', {
      header: 'Idempotency-Key',
    });
  }
  if (key.length > 100) {
    throw AppError.validation('Idempotency-Key must be at most 100 characters', {
      header: 'Idempotency-Key',
    });
  }
  return key;
}

export const saleRouter = Router();

saleRouter.use(authenticate);

/** GET /api/v1/sales?page&pageSize&search&status&from&to */
saleRouter.get('/', validateQuery(listSalesQuery), async (_req, res) => {
  const query = getValidatedQuery<ListSalesQuery>(res);
  const result = await listSales(query);
  res.json(result);
});

/** GET /api/v1/sales/:id/invoice — printable invoice data (same snapshot as detail). */
saleRouter.get('/:id/invoice', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Sale');
  const sale = await getSaleById(id);
  // Tax-exclusive pricing: tax is added on top of the line subtotal (PRD §Assumptions).
  res.json({ data: { ...sale, taxInclusive: false } });
});

/** GET /api/v1/sales/:id */
saleRouter.get('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Sale');
  const sale = await getSaleById(id);
  res.json({ data: sale });
});

/**
 * POST /api/v1/sales — create a sale: ADMIN or PHARMACIST.
 * Requires an `Idempotency-Key` header; a replay returns the original sale (200).
 */
saleRouter.post(
  '/',
  requireRole('ADMIN', 'PHARMACIST'),
  validateBody(createSaleBody),
  async (req, res) => {
    const { userId } = currentAuth(req);
    const idempotencyKey = readIdempotencyKey(req);
    const result = await createSale(req.body as CreateSaleBody, userId, idempotencyKey);

    if (result.replayed) {
      res.setHeader('Idempotent-Replay', 'true');
    }
    res.status(result.replayed ? 200 : 201).json({ data: result.sale });
  },
);

/**
 * POST /api/v1/sales/:id/returns — process a return: ADMIN or PHARMACIST.
 * Body: `{ reason, items: [{ saleItemId, quantity }] }`.
 */
saleRouter.post(
  '/:id/returns',
  requireRole('ADMIN', 'PHARMACIST'),
  validateBody(createReturnBody),
  async (req, res) => {
    const saleId = parseIdParam(req.params.id, 'Sale');
    const { userId } = currentAuth(req);
    const result = await createReturn(saleId, req.body as CreateReturnBody, userId);
    res.status(201).json({ data: result });
  },
);
