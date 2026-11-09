import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { getValidatedQuery, validateBody, validateQuery } from '../middleware/validate.js';
import { createCategory, listCategories } from '../services/category-service.js';
import { listQuery, type ListQuery } from './query-schemas.js';

const createCategoryBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const categoryRouter = Router();

categoryRouter.use(authenticate);

/** GET /api/v1/categories?page&pageSize&search */
categoryRouter.get('/', validateQuery(listQuery), async (_req, res) => {
  const query = getValidatedQuery<ListQuery>(res);
  const result = await listCategories(query);
  res.json(result);
});

/** POST /api/v1/categories — catalogue write: ADMIN or INVENTORY_MANAGER. */
categoryRouter.post(
  '/',
  requireRole('ADMIN', 'INVENTORY_MANAGER'),
  validateBody(createCategoryBody),
  async (req, res) => {
    const auth = currentAuth(req);
    const created = await createCategory(req.body as z.infer<typeof createCategoryBody>, auth.userId);
    res.status(201).json({ data: created });
  },
);
