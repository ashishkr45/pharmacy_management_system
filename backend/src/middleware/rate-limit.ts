import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * FR-1: limit login attempts per IP. Skipped under test so the suite is not
 * rate-limited; the 429 path is exercised manually/against the demo.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count, so a busy but legitimate user is not locked out.
  skipSuccessfulRequests: true,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json(new AppError('RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.').toBody());
  },
});
