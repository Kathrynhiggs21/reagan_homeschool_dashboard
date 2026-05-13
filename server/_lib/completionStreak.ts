/**
 * Push 83 (2026-05-13) — Daily-completion streak helper.
 *
 * Pure. No DB, no clock. Takes an array of ISO `YYYY-MM-DD` day-keys
 * representing days on which Reagan completed at least one block (or
 * earned at least one sticker — same proxy), plus the "as-of" date.
 *
 * Returns the count of consecutive calendar days, ending on `asOf` and
 * walking backward, on which there was at least one completion. A gap
 * of one or more missed days breaks the streak.
 *
 * Examples (asOf = "2026-07-15"):
 *   days = []                                                          → 0
 *   days = ["2026-07-15"]                                              → 1
 *   days = ["2026-07-15","2026-07-14"]                                 → 2
 *   days = ["2026-07-15","2026-07-13"]                                 → 1   (missed 14th)
 *   days = ["2026-07-14","2026-07-13"]                                 → 0   (didn't complete today)
 *
 * Duplicate day-keys are tolerated. Input order doesn't matter; we
 * de-dupe and sort internally for determinism.
 */

export function dailyBlockCompletionStreak(
  days: string[],
  asOf: string,
): number {
  const set = new Set<string>();
  for (const d of days) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
  }
  if (set.size === 0) return 0;
  if (!set.has(asOf)) return 0;
  let streak = 0;
  // Walk backwards day-by-day from asOf until a gap is found.
  let cursor = asOf;
  // Guard the loop to a sane horizon (1 year) in case of bad input.
  for (let i = 0; i < 366; i++) {
    if (!set.has(cursor)) break;
    streak++;
    cursor = previousIsoDay(cursor);
  }
  return streak;
}

/**
 * Add or subtract whole UTC days to an ISO `YYYY-MM-DD` string.
 * Pure, no Date() side effects beyond a single new Date inside.
 */
export function previousIsoDay(iso: string): string {
  return shiftIsoDay(iso, -1);
}

export function shiftIsoDay(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}
