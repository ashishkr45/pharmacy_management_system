import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { listUsers } from '../services/user-service.js';

export const usersRouter = Router();

/** GET /api/v1/users — ADMIN only (also the RBAC sample route for B3 tests). */
usersRouter.get('/', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const users = await listUsers();
  res.json({ data: users });
});
