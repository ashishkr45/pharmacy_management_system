/** Shared defaults and validation for the read-only report screens. */

export interface ReportRange {
  from: string;
  to: string;
}

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDateInput(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Defaults to the server's UTC calendar so a reconciliation range ending
 * "today" is still checked even when the browser is in another timezone.
 */
export function defaultReportRange(dayCount = 30): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - (dayCount - 1) * MS_PER_DAY);

  return { from: toUtcDateInput(from), to: toUtcDateInput(to) };
}

/** Returns a user-facing message, or null when the range can be requested. */
export function rangeValidationError(from: string, to: string): string | null {
  if (!DATE_INPUT_PATTERN.test(from) || !DATE_INPUT_PATTERN.test(to)) {
    return "Choose both dates.";
  }

  if (from > to) {
    return "From must be on or before To.";
  }

  return null;
}
