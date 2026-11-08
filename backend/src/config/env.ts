import 'dotenv/config';
import { z } from 'zod';

/**
 * The ONLY place in the backend allowed to read `process.env`.
 *
 * The app validates its configuration at startup and exits immediately if
 * something is missing or malformed. Failing fast beats failing at 3am on the
 * first request that happens to need a missing variable.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Origin allowed by CORS (the frontend dev server or the deployed Vercel URL).
  FRONTEND_URL: z.url('FRONTEND_URL must be a valid absolute URL, e.g. http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  console.error(
    `Invalid environment configuration:\n${issues}\n\n` +
      'Copy backend/.env.example to backend/.env and fill in the required values.',
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
