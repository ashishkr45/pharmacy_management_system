import { toCalendarDay } from '../utils/clock.js';
import { AppError } from '../utils/app-error.js';

/**
 * FEFO (First Expired, First Out) allocation — the core selling rule (BR-5).
 *
 * This function is deliberately PURE:
 *   * no database, no clock, no Prisma, no I/O;
 *   * `today` is a parameter, so a unit test controls time;
 *   * it never mutates `candidates` or the objects inside it.
 *
 * The sale transaction (B6) loads the candidate batches under `FOR UPDATE`,
 * then calls this function. That separation lets the allocator carry the
 * business rule and its tests, while the transaction carries concurrency.
 */

export interface FefoCandidate {
  batchId: number;
  /** Calendar day (`@db.Date`, UTC midnight). */
  expiryDate: Date;
  quantityOnHand: number;
}

export interface FefoAllocation {
  batchId: number;
  quantity: number;
}

/**
 * Allocates `requested` units across the soonest-expiring usable batches.
 *
 * @throws VALIDATION_ERROR     requested is not a positive integer
 * @throws INSUFFICIENT_STOCK   usable stock (unexpired, positive) is too low
 */
export function allocateFefo(
  candidates: readonly FefoCandidate[],
  requested: number,
  today: Date,
): FefoAllocation[] {
  if (!Number.isInteger(requested) || requested <= 0) {
    throw AppError.validation('Requested quantity must be a positive integer', { requested });
  }

  const todayMs = toCalendarDay(today).getTime();

  // `filter` returns a new array, so sorting it cannot reorder the caller's
  // array. A batch expiring today is already expired (BR-3), and a non-positive
  // quantity is not stock, so both are excluded from `available` too.
  const usable = candidates
    .filter(
      (candidate) =>
        candidate.quantityOnHand > 0 &&
        toCalendarDay(candidate.expiryDate).getTime() > todayMs,
    )
    .sort((a, b) => {
      const byExpiry = toCalendarDay(a.expiryDate).getTime() - toCalendarDay(b.expiryDate).getTime();
      // Stable tie-break: the same order every run, so allocations and tests
      // are deterministic when two batches share an expiry date.
      return byExpiry !== 0 ? byExpiry : a.batchId - b.batchId;
    });

  const available = usable.reduce((total, candidate) => total + candidate.quantityOnHand, 0);
  if (available < requested) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      `Only ${available} units are available for this medicine`,
      { requested, available },
    );
  }

  const allocations: FefoAllocation[] = [];
  let remaining = requested;

  for (const candidate of usable) {
    if (remaining === 0) {
      break;
    }
    const quantity = Math.min(remaining, candidate.quantityOnHand);
    allocations.push({ batchId: candidate.batchId, quantity });
    remaining -= quantity;
  }

  return allocations;
}
