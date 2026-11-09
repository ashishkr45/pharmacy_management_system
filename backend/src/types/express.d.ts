import type { Role } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware. */
      auth?: {
        userId: number;
        role: Role;
      };
    }
  }
}

export {};
