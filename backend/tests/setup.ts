import dotenv from 'dotenv';

/**
 * Runs before every test file, before src/ modules are imported (env.ts reads
 * process.env once at import time). Loads the test configuration and refuses to
 * continue if it does not look like a test environment.
 */
dotenv.config({ path: '.env.test', override: true });

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Tests must run with NODE_ENV=test (check backend/.env.test)');
}

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error('backend/.env.test must define DATABASE_URL, DIRECT_URL and JWT_SECRET');
}
