import { seedDatabase } from '../../prisma/seed.js';
import { prisma } from '../../src/db/prisma.js';

/** Wipes and re-seeds the test database with the same fictional demo data. */
export async function resetDatabase(): Promise<void> {
  await seedDatabase();
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
