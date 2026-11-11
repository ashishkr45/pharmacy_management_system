/**
 * Inclusive UTC range for a pair of `YYYY-MM-DD` days. The `to` day includes
 * its final millisecond, so a sale at 23:59 is still inside the range.
 */
export function dateRangeFilter(
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lte?: Date } | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  return {
    ...(from !== undefined ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to !== undefined ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}
