import { Router } from 'express';
import { env } from '../config/env.js';

export const healthRouter = Router();

/**
 * Liveness probe used by Render and by local checks.
 * Mounted at both `/health` and `/api/v1/health`.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pharmacy-management-api',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
