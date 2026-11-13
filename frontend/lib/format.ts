const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Display-only formatting. The API sends money as 2-dp decimal strings; the
 * number conversion here never feeds back into a calculation.
 */
export function formatMoney(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? moneyFormatter.format(amount) : `₹${value}`;
}

export function formatDate(value: string | Date): string {
  // Calendar dates such as `2026-11-13` must not be shifted by a timezone.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(year, month - 1, day);
    return Number.isNaN(calendarDate.getTime())
      ? "-"
      : dateFormatter.format(calendarDate);
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
}
