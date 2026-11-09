import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createMedicine, getMedicineById, listMedicines, updateMedicine, } from '../services/medicine-service.js';
import { money } from '../utils/money.js';
import { parseIdParam } from '../utils/parse-id.js';
import { activeParam, listQuery } from './query-schemas.js';

/** Decimal input: JSON number or numeric string, normalised to 2 dp. */
const moneyInput = z
  .union([
    z.number().finite().min(0).max(9_999_999_999.99),
    z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a non-negative amount with up to 2 decimals'),
  ])
  .transform((value) => money(value).toFixed(2));

const taxRateInput = moneyInput.refine((value) => Number(value) <= 100, 'Tax rate must be between 0 and 100');

const createMedicineBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be at most 150 characters'),
  genericName: z.string().trim().min(1).max(150).nullable().optional(),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be at most 50 characters')
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'SKU may contain letters, digits and hyphens only')
    .transform((value) => value.toUpperCase()),
  categoryId: z.coerce.number().int().positive('A category is required'),
  unit: z.string().trim().min(1, 'Unit is required').max(30, 'Unit must be at most 30 characters'),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  taxRate: taxRateInput.nullable().optional(),
  defaultSalePrice: moneyInput.nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateMedicineBody = createMedicineBody
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

const listMedicinesQuery = listQuery.extend({
  categoryId: z.coerce.number().int().positive().optional(),
  isActive: activeParam,
});

type CreateMedicineBody = z.infer<typeof createMedicineBody>;
type UpdateMedicineBody = z.infer<typeof updateMedicineBody>;
type ListMedicinesQuery = z.infer<typeof listMedicinesQuery>;

export const medicineRouter = Router();

medicineRouter.use(authenticate);

/** GET /api/v1/medicines?page&pageSize&search&categoryId&isActive */
medicineRouter.get('/', validateQuery(listMedicinesQuery), async (_req, res) => {
  const query = getValidatedQuery<ListMedicinesQuery>(res);
  const result = await listMedicines(query);
  res.json(result);
});

/** GET /api/v1/medicines/:id */
medicineRouter.get('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Medicine');
  const medicine = await getMedicineById(id);
  res.json({ data: medicine });
});

/** POST /api/v1/medicines — catalogue write: ADMIN or INVENTORY_MANAGER. */
medicineRouter.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(createMedicineBody),
  async (req, res) => {
    const auth = currentAuth(req);
    const created = await createMedicine(req.body as CreateMedicineBody, auth.userId);
    res.status(201).json({ data: created });
  },
);

/**
 * PATCH /api/v1/medicines/:id — partial update, including
 * `{ "isActive": false }` (deactivate) and `{ "isActive": true }` (reactivate).
 */
medicineRouter.patch(
  '/:id',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(updateMedicineBody),
  async (req, res) => {
    const auth = currentAuth(req);
    const id = parseIdParam(req.params.id, 'Medicine');
    const updated = await updateMedicine(id, req.body as UpdateMedicineBody, auth.userId);
    res.json({ data: updated });
  },
);
