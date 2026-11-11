import { describe, expect, it } from 'vitest';
import { lineSubtotal, money, sumMoney, taxOn } from '../../src/utils/money.js';

/** BR-12: one rounding rule, HALF-UP to 2 dp, applied per calculation. */
describe('money helpers', () => {
  it('rounds HALF-UP to 2 decimal places', () => {
    expect(money('1.005').toString()).toBe('1.01');
    expect(money('2.675').toString()).toBe('2.68');
    expect(money('0.004').toString()).toBe('0');
  });

  it('normalises unit prices to 2 dp before multiplying', () => {
    // 0.335 is not a valid currency amount; it is rounded to 0.34 first.
    expect(money('0.335').toString()).toBe('0.34');
    expect(lineSubtotal(3, money('0.335')).toString()).toBe('1.02');
  });

  it('applies rounding per line, not just on the grand total', () => {
    // 0.99 × 12% = 0.1188 -> 0.12 per line; ten lines round to 1.20.
    // Rounding once on the total gives 1.19 instead.
    const perLine = sumMoney(Array.from({ length: 10 }, () => taxOn(money('0.99'), '12')));
    const onceOnTotal = taxOn(sumMoney(Array.from({ length: 10 }, () => money('0.99'))), '12');
    expect(perLine.toString()).toBe('1.2');
    expect(onceOnTotal.toString()).toBe('1.19');
  });

  it('computes tax on the already-rounded line base', () => {
    expect(taxOn(money('100.00'), '5').toString()).toBe('5');
    expect(taxOn(money('99.99'), '12').toString()).toBe('12'); // 11.9988 -> 12
  });

  it('sums decimals without floating-point drift', () => {
    expect(sumMoney([money('0.10'), money('0.20')]).toString()).toBe('0.3');
  });
});
