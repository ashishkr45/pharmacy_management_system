import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger UI for the OpenAPI contract.
 *
 * The YAML is served as a static file rather than parsed into this process, so
 * the docs cannot drift from the committed spec and Swagger UI can reload it.
 * The first candidate is the Render deployment layout (root directory
 * `backend`); the second is the local repository layout.
 */
const candidates = [
  resolve(process.cwd(), 'openapi.yaml'),
  resolve(process.cwd(), '../docs/openapi.yaml'),
];
const specPath = candidates.find((candidate) => existsSync(candidate));

export const docsRouter = Router();

if (specPath) {
  docsRouter.get('/openapi.yaml', (_req, res) => {
    res.sendFile(specPath);
  });

  docsRouter.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'Pharmacy Management API',
      swaggerOptions: { url: '/openapi.yaml' },
    }),
  );
}
