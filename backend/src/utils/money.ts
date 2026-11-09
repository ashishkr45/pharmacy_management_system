import { Prisma } from '../generated/prisma/client.js';

/**
 * The single money/rounding rule (BR-12):
 *   * all amounts are Decimal(12,2), never JS floats;
 *   * every amount is rounded HALF-UP to 2 dp at the point it is computed
 *     (per line, not on the grand total).
 */
export type Money = Prisma.Decimal;

const { Decimal } = Prisma;

export const MONEY_SCALE = 2;

export function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** quantity × unit price, rounded to 2 dp. */
export function lineSubtotal(quantity: number, unitPrice: Prisma.Decimal): Prisma.Decimal {
  return money(new Decimal(unitPrice).mul(quantity));
}

/** Tax on a (rounded) amount at a percentage rate, rounded to 2 dp. */
export function taxOn(amount: Prisma.Decimal, ratePercent: Prisma.Decimal | string | number): Prisma.Decimal {
  return money(new Decimal(amount).mul(ratePercent).div(100));
}

export function sumMoney(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.add(value), new Decimal(0));
}
