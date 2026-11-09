import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { getUserById, login } from '../services/auth-service.js';
import { AppError } from '../utils/app-error.js';

const loginSchema = z.object({
  email: z.email('A valid email is required').transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required').max(200),
});

type LoginInput = z.infer<typeof loginSchema>;

export const authRouter = Router();

/** POST /api/v1/auth/login */
authRouter.post('/login', loginRateLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const result = await login(email, password);
  res.json({ data: result });
});

/** GET /api/v1/auth/me */
authRouter.get('/me', authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required');
  }

  const user = await getUserById(auth.userId);
  res.json({ data: user });
});
