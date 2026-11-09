/**
 * Injectable clock so tests can control "today" (AGENTS.md §5.14).
 * Business code must never call `new Date()` directly.
 */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Normalises a date to a calendar day at UTC midnight — the same value Prisma
 * reads back from a `@db.Date` column. Expiry logic therefore compares dates,
 * not instants, and is immune to the server's timezone or time of day.
 */
export function toCalendarDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfToday(clock: Clock = systemClock): Date {
  return toCalendarDay(clock());
}

/** BR-3: a batch is expired when expiry_date <= today (expiring today = expired). */
export function isExpired(expiryDate: Date, clock: Clock = systemClock): boolean {
  return toCalendarDay(expiryDate).getTime() <= startOfToday(clock).getTime();
}

/** Whole calendar days from today to the expiry date (negative = already expired). */
export function daysUntilExpiry(expiryDate: Date, clock: Clock = systemClock): number {
  return Math.round((toCalendarDay(expiryDate).getTime() - startOfToday(clock).getTime()) / MS_PER_DAY);
}

/** FR-5: expiring within `windowDays`, but not expired yet. */
export function isNearExpiry(expiryDate: Date, windowDays: number, clock: Clock = systemClock): boolean {
  const days = daysUntilExpiry(expiryDate, clock);
  return days > 0 && days <= windowDays;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
