/**
 * dayStartSanity.ts — guard against the AM/PM "+12h" corruption.
 *
 * Why this exists (2026-06-17):
 *   Several generated days were found stored with morning warm-ups timestamped
 *   at 21:00–23:30 instead of 09:00–11:30. Root cause: an upstream generator
 *   (LLM proposer/editor) emitted evening "HH:MM" values for what are clearly
 *   morning blocks — the classic 12-hour AM/PM mixup ("10" → "22:00"). Nothing
 *   downstream clamped it, so those blocks landed in the late evening.
 *
 * Two observed shapes:
 *   1. WHOLE day shifted (e.g. 2026-05-05: 21:00→21:30→21:45→lunch 22:30).
 *   2. SPLIT day (e.g. 2026-06-18): the morning warm-ups corrupted to 22:xx
 *      while the afternoon (lunch 12:00, adventure 13:00) was already correct.
 *
 * Reagan's homeschool day NEVER legitimately starts in the 18:00–04:59 band.
 * The safe, narrow fix is: pull back by 12h ONLY the contiguous LEADING run of
 * evening-banded blocks (those at index 0,1,2… that sit in 18:00–23:59) up
 * until the first block that is already a normal daytime time. This repairs a
 * corrupted morning without ever touching a legitimately-correct afternoon.
 *
 * Pure + side-effect free; the DB write happens in the caller.
 */

export type TimedItem = { startTime?: string | null; durationMin?: number };

const EVENING_INTENT =
  /\b(pm|p\.m\.|evening|night|tonight|after\s*dinner|bedtime|overnight)\b/i;

const EVENING_BAND_START = 18 * 60; // 18:00
const PREDAWN_BAND_END = 5 * 60; // before 05:00

/** Parse "HH:MM" 24h → minutes since midnight, or null if malformed. */
export function hhmmToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** minutes since midnight → "HH:MM" (wraps into 0..1439). */
export function minToHHMM(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** True when a single start-minute sits in the never-legitimate band. */
export function isCorruptStartMin(min: number | null): boolean {
  if (min == null) return false;
  return min >= EVENING_BAND_START || min < PREDAWN_BAND_END;
}

/**
 * Whether the day's EARLIEST timed start looks like an AM/PM corruption.
 * (Kept for callers that only need a yes/no on the whole day.)
 */
export function isLikelyAmPmCorruption(
  earliestStartMin: number | null,
  intentText?: string | null,
): boolean {
  if (earliestStartMin == null) return false;
  if (intentText && EVENING_INTENT.test(intentText)) return false;
  return isCorruptStartMin(earliestStartMin);
}

/**
 * Normalize a day's timed blocks. Returns a new array.
 *
 * Strategy (narrow + safe):
 *   - Walk blocks in order. While we are still in the LEADING run AND a timed
 *     block sits in the evening/pre-dawn band, shift just that block by ∓12h.
 *   - The leading run ends at the first timed block that is already a normal
 *     daytime time (05:00–17:59) — everything from there on is left untouched.
 *   - Untimed blocks don't break the leading run (they're skipped, not shifted).
 *
 * This repairs the 2026-06-18 split-day case (morning fixed, afternoon kept)
 * and the whole-day case (every leading block is evening, so all get fixed).
 *
 * Honors explicit evening/overnight intent text by doing nothing.
 */
export function normalizeDayStart<T extends TimedItem>(
  items: T[],
  intentText?: string | null,
): { items: T[]; corrected: boolean } {
  if (intentText && EVENING_INTENT.test(intentText)) {
    return { items, corrected: false };
  }

  let corrected = false;
  let inLeadingRun = true;

  const out = items.map((b) => {
    const m = hhmmToMin(b.startTime);
    if (m == null) {
      // Untimed block — does not end the leading run.
      return b;
    }
    if (!inLeadingRun) return b;
    if (isCorruptStartMin(m)) {
      const shift = m >= EVENING_BAND_START ? -12 * 60 : +12 * 60;
      corrected = true;
      return { ...b, startTime: minToHHMM(m + shift) };
    }
    // First normal daytime block → the leading run is over.
    inLeadingRun = false;
    return b;
  });

  return { items: out, corrected };
}
