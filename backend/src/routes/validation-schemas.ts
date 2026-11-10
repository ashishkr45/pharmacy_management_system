import { z } from 'zod';
import { money } from '../utils/money.js';

/** Decimal input: JSON number or numeric string, normalised to 2 dp. */
export const moneyInput = z
  .union([
    z.number().finite().min(0).max(9_999_999_999.99),
    z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a non-negative amount with up to 2 decimals'),
  ])
  .transform((value) => money(value).toFixed(2));

/** Calendar date in `YYYY-MM-DD` (no time, no timezone ambiguity). */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date in YYYY-MM-DD format');
