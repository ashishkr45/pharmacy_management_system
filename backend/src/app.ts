import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { docsRouter } from './routes/docs.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { apiRouter } from './routes/index.js';

/**
 * Builds the Express app without opening a port, so integration tests can
 * import `app` and hand it to Supertest. `server.ts` is the only place that
 * calls `listen()`.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');

  // Swagger UI uses a small inline bootstrap script and is mounted before the
  // global helmet CSP so docs can render. API routes still receive helmet.
  app.use(docsRouter);

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL }));
  app.use(express.json({ limit: '100kb' }));

  // `/health` for infrastructure probes, `/api/v1/health` for API clients.
  app.use('/health', healthRouter);
  app.use('/api/v1', apiRouter);

  // Order matters: 404 first, then the single error handler (last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
