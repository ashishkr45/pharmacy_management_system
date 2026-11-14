export const systemClock = () => new Date();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/**
 * Normalises a date to a calendar day at UTC midnight — the same value Prisma
 * reads back from a `@db.Date` column. Expiry logic therefore compares dates,
 * not instants, and is immune to the server's timezone or time of day.
 */
export function toCalendarDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export function startOfToday(clock = systemClock) {
    return toCalendarDay(clock());
}
/** BR-3: a batch is expired when expiry_date <= today (expiring today = expired). */
export function isExpired(expiryDate, clock = systemClock) {
    return toCalendarDay(expiryDate).getTime() <= startOfToday(clock).getTime();
}
/** Whole calendar days from today to the expiry date (negative = already expired). */
export function daysUntilExpiry(expiryDate, clock = systemClock) {
    return Math.round((toCalendarDay(expiryDate).getTime() - startOfToday(clock).getTime()) / MS_PER_DAY);
}
/** FR-5: expiring within `windowDays`, but not expired yet. */
export function isNearExpiry(expiryDate, windowDays, clock = systemClock) {
    const days = daysUntilExpiry(expiryDate, clock);
    return days > 0 && days <= windowDays;
}
export function addDays(date, days) {
    return new Date(date.getTime() + days * MS_PER_DAY);
}
