import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createPurchase, getPurchaseById, listPurchases } from '../services/purchase-service.js';
import { parseIdParam } from '../utils/parse-id.js';
import { listQuery } from './query-schemas.js';
import { dateOnly, moneyInput } from './validation-schemas.js';

const purchaseItemBody = z.object({
  medicineId: z.coerce.number().int().positive('A medicine is required'),
  batchNo: z
    .string()
    .trim()
    .min(1, 'Batch number is required')
    .max(50, 'Batch number must be at most 50 characters')
    .transform((value) => value.toUpperCase()),
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer').max(1_000_000),
  costPrice: moneyInput,
  salePrice: moneyInput,
  expiryDate: dateOnly,
});

const createPurchaseBody = z.object({
  supplierId: z.coerce.number().int().positive('A supplier is required'),
  supplierInvoiceNo: z.string().trim().min(1, 'Invoice number is required').max(80),
  purchaseDate: dateOnly.optional(),
  items: z.array(purchaseItemBody).min(1, 'Add at least one item').max(100, 'At most 100 items per purchase'),
});

const listPurchasesQuery = listQuery.extend({
  supplierId: z.coerce.number().int().positive().optional(),
});

type CreatePurchaseBody = z.infer<typeof createPurchaseBody>;
type ListPurchasesQuery = z.infer<typeof listPurchasesQuery>;

export const purchaseRouter = Router();

purchaseRouter.use(authenticate);

/** GET /api/v1/purchases?page&pageSize&search&supplierId */
purchaseRouter.get('/', validateQuery(listPurchasesQuery), async (_req, res) => {
  const query = getValidatedQuery<ListPurchasesQuery>(res);
  const result = await listPurchases(query);
  res.json(result);
});

/** GET /api/v1/purchases/:id */
purchaseRouter.get('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Purchase');
  const purchase = await getPurchaseById(id);
  res.json({ data: purchase });
});

/** POST /api/v1/purchases — receive stock: ADMIN or INVENTORY_MANAGER. */
purchaseRouter.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(createPurchaseBody),
  async (req, res) => {
    const auth = currentAuth(req);
    const created = await createPurchase(req.body as CreatePurchaseBody, auth.userId);
    res.status(201).json({ data: created });
  },
);
