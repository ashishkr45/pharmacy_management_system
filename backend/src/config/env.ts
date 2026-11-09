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
  // Pooled Neon connection string used at runtime by the PrismaPg adapter.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon pooled connection string)'),
  // HS256 signing secret for access tokens.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // JWT lifetime, e.g. "8h" (jsonwebtoken/ms format).
  JWT_EXPIRES_IN: z.string().min(1).default('8h'),
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
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
