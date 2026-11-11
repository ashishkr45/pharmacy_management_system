import { describe, expect, it } from 'vitest';
import { allocateFefo, type FefoCandidate } from '../../src/services/fefo.js';
import { AppError } from '../../src/utils/app-error.js';

/**
 * Unit tests for the pure FEFO allocator: no database, no Nest/Express, no clock.
 * `today` is fixed so "expired" never depends on when the suite runs.
 */

const TODAY = new Date('2026-11-10T00:00:00.000Z');

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function candidate(batchId: number, expiryDate: string, quantityOnHand: number): FefoCandidate {
  return { batchId, expiryDate: day(expiryDate), quantityOnHand };
}

/** Runs the allocator and returns the AppError it threw (fails if it did not throw). */
function captureError(run: () => unknown): AppError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the allocator to throw, but it returned normally');
}

describe('allocateFefo', () => {
  it('takes everything from one batch when it holds enough', () => {
    const result = allocateFefo([candidate(1, '2027-01-31', 10)], 4, TODAY);
    expect(result).toEqual([{ batchId: 1, quantity: 4 }]);
  });

  it('spills across batches in expiry order', () => {
    const result = allocateFefo(
      [candidate(2, '2027-06-30', 10), candidate(1, '2026-12-31', 3)],
      8,
      TODAY,
    );

    expect(result).toEqual([
      { batchId: 1, quantity: 3 },
      { batchId: 2, quantity: 5 },
    ]);
  });

  it('breaks expiry ties by batch id', () => {
    const result = allocateFefo(
      [candidate(5, '2027-03-31', 2), candidate(2, '2027-03-31', 2)],
      3,
      TODAY,
    );

    expect(result).toEqual([
      { batchId: 2, quantity: 2 },
      { batchId: 5, quantity: 1 },
    ]);
  });

  it('skips expired batches, today-expiring batches and empty batches', () => {
    const result = allocateFefo(
      [
        candidate(1, '2026-10-01', 50), // expired
        candidate(2, '2026-11-10', 50), // expires today = expired (BR-3)
        candidate(3, '2027-01-01', 0), // no stock
        candidate(4, '2027-01-02', 5),
      ],
      2,
      TODAY,
    );

    expect(result).toEqual([{ batchId: 4, quantity: 2 }]);
  });

  it('throws INSUFFICIENT_STOCK with requested and usable available', () => {
    const error = captureError(() =>
      allocateFefo(
        [
          candidate(1, '2026-09-01', 100), // expired, must not count as available
          candidate(2, '2027-01-01', 3),
          candidate(3, '2027-02-01', 2),
        ],
        8,
        TODAY,
      ),
    );

    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.details).toEqual({ requested: 8, available: 5 });
  });

  it.each([0, -1, 1.5])('rejects a non-positive or fractional request: %s', (requested) => {
    const error = captureError(() => allocateFefo([candidate(1, '2027-01-01', 10)], requested, TODAY));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('does not mutate the input array or its objects', () => {
    const input: FefoCandidate[] = [
      candidate(2, '2027-06-30', 10),
      candidate(1, '2026-12-31', 3),
    ];
    const snapshot = input.map((item) => ({
      batchId: item.batchId,
      expiryMs: item.expiryDate.getTime(),
      quantityOnHand: item.quantityOnHand,
    }));

    allocateFefo(input, 8, TODAY);

    expect(
      input.map((item) => ({
        batchId: item.batchId,
        expiryMs: item.expiryDate.getTime(),
        quantityOnHand: item.quantityOnHand,
      })),
    ).toEqual(snapshot);
  });

  it('allocates exactly the requested quantity and no more', () => {
    const result = allocateFefo(
      [candidate(1, '2027-01-01', 10), candidate(2, '2027-02-01', 10)],
      10,
      TODAY,
    );

    expect(result).toEqual([{ batchId: 1, quantity: 10 }]);
    expect(result.reduce((sum, allocation) => sum + allocation.quantity, 0)).toBe(10);
  });
});
