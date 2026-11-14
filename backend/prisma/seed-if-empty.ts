/**
 * Docker-only seed guard.
 *
 * `npm run db:seed` intentionally resets the demo data (it is the documented
 * way to get a clean dataset). A container restart must NOT wipe a reviewer's
 * changes, so the Docker startup command uses this wrapper instead: it seeds
 * only when the database has no users. With the volume kept, repeated
 * `docker compose up` runs are therefore no-ops.
 *
 * `docker compose down -v && docker compose up` starts from an empty volume and
 * runs the full seed again.
 */
import { disconnectPrisma, prisma } from '../src/db/prisma.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log(`Seed skipped: ${userCount} user(s) already exist.`);
    return;
  }

  console.log('Empty database detected; running the demo seed...');
  await seedDatabase();
}

try {
  await main();
} catch (error) {
  console.error('Docker seed failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
