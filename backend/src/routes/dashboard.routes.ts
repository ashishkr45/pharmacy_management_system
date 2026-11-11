import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDashboardSummary } from '../services/dashboard-service.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/** GET /api/v1/dashboard/summary — today's sales, alert counts and recent activity. */
dashboardRouter.get('/summary', async (_req, res) => {
  const summary = await getDashboardSummary();
  res.json({ data: summary });
});
