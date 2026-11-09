import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createSupplier, listSuppliers } from '../services/supplier-service.js';
import { activeParam, listQuery } from './query-schemas.js';

const listSuppliersQuery = listQuery.extend({ isActive: activeParam });

const createSupplierBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be at most 150 characters'),
  contactPerson: z.string().trim().min(1).max(120).nullable().optional(),
  phone: z.string().trim().regex(/^[+()\d\s-]{3,30}$/, 'Phone must contain 3-30 digits and phone symbols').nullable().optional(),
  email: z.email('A valid email is required').max(150).nullable().optional(),
  address: z.string().trim().min(1).max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

type ListSuppliersQuery = z.infer<typeof listSuppliersQuery>;
type CreateSupplierBody = z.infer<typeof createSupplierBody>;

export const supplierRouter = Router();

supplierRouter.use(authenticate);

/** GET /api/v1/suppliers?page&pageSize&search&isActive */
supplierRouter.get('/', validateQuery(listSuppliersQuery), async (_req, res) => {
  const query = getValidatedQuery<ListSuppliersQuery>(res);
  const result = await listSuppliers(query);
  res.json(result);
});

/** POST /api/v1/suppliers — catalogue write: ADMIN or INVENTORY_MANAGER. */
supplierRouter.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(createSupplierBody),
  async (req, res) => {
    const auth = currentAuth(req);
    const created = await createSupplier(req.body as CreateSupplierBody, auth.userId);
    res.status(201).json({ data: created });
  },
);
