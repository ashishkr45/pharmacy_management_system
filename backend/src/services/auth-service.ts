import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import type { Role } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

const ROLES = ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'] as const;

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface AuthPrincipal {
  userId: number;
  role: Role;
}

/**
 * Compared against when the email is unknown, so a login attempt costs roughly
 * the same time whether or not the account exists (no user enumeration).
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-password-placeholder', 10);

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function signAccessToken(userId: number, role: Role): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    subject: String(userId),
    // env validates presence; the cast narrows "8h" to jsonwebtoken's StringValue.
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
  };
  return jwt.sign({ role }, env.JWT_SECRET, options);
}

/** Verifies signature + expiry and returns the principal, or throws 401. */
export function verifyAccessToken(token: string): AuthPrincipal {
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof verified === 'string') {
      throw new Error('Unexpected JWT payload');
    }
    payload = verified;
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired token');
  }

  const userId = Number(payload.sub);
  const role = payload.role;
  if (!Number.isInteger(userId) || userId <= 0 || !isRole(role)) {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired token');
  }

  return { userId, role };
}

/** One generic message for every failure: never reveal whether the email exists. */
export async function login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true },
  });

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.isActive || !passwordMatches) {
    throw new AppError('UNAUTHENTICATED', 'Invalid email or password');
  }

  return {
    token: signAccessToken(user.id, user.role),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  };
}

export async function getUserById(userId: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required');
  }

  return user;
}
