// Prisma CLI configuration (Prisma ORM v7).
//
// The CLI (migrate, db push, studio, seed) connects with DIRECT_URL — the
// non-pooled Neon connection — because migrations and shadow databases do not
// work reliably through a pooler. The application itself connects with the
// pooled DATABASE_URL through the PrismaPg adapter (src/db/prisma.ts).
//
// Note: this file runs in the CLI/tooling context, not the app, so reading
// process.env here does not violate the "env only in config/env.ts" rule.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
