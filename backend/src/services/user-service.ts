import { prisma } from '../db/prisma.js';

export interface UserListItem {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'PHARMACIST' | 'INVENTORY_MANAGER';
  isActive: boolean;
  createdAt: Date;
}

/** Admin-only user list (PRD FR-1 / Admin). Never selects passwordHash. */
export async function listUsers(): Promise<UserListItem[]> {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { id: 'asc' },
  });
}
