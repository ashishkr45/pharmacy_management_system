import { Router } from 'express';
import { healthRouter } from './health.routes.js';

/** Everything under `/api/v1`. Routers are added here as phases land. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
