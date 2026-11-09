import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../db/prisma.js';
import type { Role } from '../generated/prisma/client.js';
import { verifyAccessToken } from '../services/auth-service.js';
import { AppError } from '../utils/app-error.js';

/**
 * Requires `Authorization: Bearer <jwt>`. Verifies the token, then re-reads the
 * user so deactivated accounts and role changes take effect immediately
 * (the DB, not the token, is the source of truth).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new AppError('UNAUTHENTICATED', 'Authentication required');
    }

    const token = header.slice('bearer '.length).trim();
    const principal = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: { role: true, isActive: true },
    });

    if (!user?.isActive) {
      throw new AppError('UNAUTHENTICATED', 'Authentication required');
    }

    req.auth = { userId: principal.userId, role: user.role };
    next();
  } catch (error: unknown) {
    next(error instanceof AppError ? error : new AppError('UNAUTHENTICATED', 'Authentication required'));
  }
}

/** Use after `authenticate`. Role checks always happen server-side (BR-14). */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError('UNAUTHENTICATED', 'Authentication required'));
      return;
    }

    if (!allowed.includes(req.auth.role)) {
      next(new AppError('FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}

/**
 * Returns the authenticated principal or throws 401. Handlers use this instead
 * of `req.auth!` so a mis-ordered middleware chain fails safely.
 */
export function currentAuth(req: Request): { userId: number; role: Role } {
  if (!req.auth) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required');
  }
  return req.auth;
}
