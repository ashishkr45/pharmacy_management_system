import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
/**
 * One Prisma client per process (each client owns a connection pool).
 * The pooled Neon URL keeps serverless/connection-limit issues away; migrations
 * use DIRECT_URL through prisma.config.ts instead.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
export async function disconnectPrisma() {
    await prisma.$disconnect();
}
