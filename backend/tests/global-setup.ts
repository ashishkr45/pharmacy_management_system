import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

/**
 * Applies migrations to the *test* database once per `npm test` run, using the
 * DIRECT_URL from .env.test. Never touches the demo database.
 */
export default function globalSetup(): void {
  const parsed = dotenv.config({ path: '.env.test', override: true }).parsed ?? {};

  if (!parsed.DIRECT_URL) {
    throw new Error('backend/.env.test must define DIRECT_URL (non-pooled test connection)');
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...parsed, NODE_ENV: 'test' },
  });
}
