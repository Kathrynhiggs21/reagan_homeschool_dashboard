/**
 * Push 176 (2026-05-15 Wave-12) — Multi-day mood/behavior trend.
 *
 * Reads a flat list of per-day mood records (any source: exit ticket,
 * Kiwi rollup, manual mom log) and computes a rolling 7-day band shift
 * + an adult-side notice (Mom + Grandma) when the trend is meaningfully
 * worse than the prior comparable window.
 *
 * STRICT RULES (enforced by vitest):
 *   - Input window is the 14 trailing days ending at `todayISO`.
 *   - "Recent" = last 7 days (inclusive of today). "Prior" = 7 days before that.
 *   - Each day's mood is bucketed great=3, okay=2, tired=1, frustrated=0.
 *     Days with no record are excluded (do not count as zero).
 *   - Notice is emitted ONLY when:
 *       a) recent has at least 3 days of data, AND
 *       b) prior has at least 3 days of data, AND
 *       c) recent average is at least 0.6 lower than prior average, AND
 *       d) recent average <= 1.7 (i.e. trend is in tired/frustrated land).
 *   - Notice text is kid-respectful: NEVER mentions "broken", "regressing",
 *     "concerning", "ADHD", or pathological language. Plain English: e.g.
 *     "The last few days have felt harder. Maybe try a lighter day."
 *   - Output is deterministic.
 *   - Records with mood values outside the kid-safe enum are dropped silently.
 */

export type MoodBand = "great" | "okay" | "tired" | "frustrated";

const SCORE: Record<MoodBand, number> = {
  great: 3,
  okay: 2,
  tired: 1,
  frustrated: 0,
};

export interface DailyMoodRecord {
  iso: string; // YYYY-MM-DD
  mood: MoodBand | string;
}

export interface MoodTrendResult {
  recentAvg: number | null;
  priorAvg: number | null;
  recentDays: number;
  priorDays: number;
  /** Negative = trend is worse, positive = trend is better. */
  delta: number | null;
  /** True if a Mom-side notice should fire. */
  notice: boolean;
  /** Kid-respectful headline. Always present. */
  headline: string;
  /** Plain-English suggestion when notice fires; empty otherwise. */
  suggestion: string;
}

function isoDaysBefore(iso: string, daysBack: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function isMoodBand(s: string): s is MoodBand {
  return s === "great" || s === "okay" || s === "tired" || s === "frustrated";
}

export function computeMultiDayMoodTrend(input: {
  todayISO: string;
  records: DailyMoodRecord[];
}): MoodTrendResult {
  const { todayISO, records } = input;

  // Build window ISO sets.
  const recentSet = new Set<string>();
  for (let i = 0; i < 7; i++) recentSet.add(isoDaysBefore(todayISO, i));
  const priorSet = new Set<string>();
  for (let i = 7; i < 14; i++) priorSet.add(isoDaysBefore(todayISO, i));

  // Most recent record per day (deterministic: last in array wins).
  const byDay = new Map<string, MoodBand>();
  for (const r of records) {
    if (!isMoodBand(r.mood)) continue;
    byDay.set(r.iso, r.mood as MoodBand);
  }

  let recentSum = 0;
  let recentN = 0;
  for (const iso of Array.from(recentSet)) {
    const m = byDay.get(iso);
    if (m) {
      recentSum += SCORE[m];
      recentN += 1;
    }
  }
  let priorSum = 0;
  let priorN = 0;
  for (const iso of Array.from(priorSet)) {
    const m = byDay.get(iso);
    if (m) {
      priorSum += SCORE[m];
      priorN += 1;
    }
  }

  const recentAvg = recentN > 0 ? recentSum / recentN : null;
  const priorAvg = priorN > 0 ? priorSum / priorN : null;
  const delta =
    recentAvg !== null && priorAvg !== null ? recentAvg - priorAvg : null;

  const notice =
    recentN >= 3 &&
    priorN >= 3 &&
    delta !== null &&
    delta <= -0.6 &&
    recentAvg !== null &&
    recentAvg <= 1.7;

  let headline: string;
  let suggestion = "";
  if (notice) {
    headline = "The last few days have felt harder.";
    suggestion =
      "Maybe try a lighter day — short blocks, more outside, easy reading. She is doing fine.";
  } else if (recentAvg === null) {
    headline = "Not enough mood notes this week yet.";
  } else if (recentAvg >= 2.4) {
    headline = "Reagan has had a great stretch.";
  } else if (recentAvg >= 1.8) {
    headline = "Steady week.";
  } else {
    headline = "A quieter stretch — keep an eye but no big changes needed.";
  }

  return {
    recentAvg,
    priorAvg,
    recentDays: recentN,
    priorDays: priorN,
    delta,
    notice,
    headline,
    suggestion,
  };
}
