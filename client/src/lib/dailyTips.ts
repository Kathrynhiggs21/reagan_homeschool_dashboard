/**
 * dailyTips — deterministic rotating one-liner pool for the Today page.
 *
 * Why deterministic? So the tip stays stable all day for Reagan (and reads
 * the same to her if she sees it again later) but rotates day-to-day.
 *
 * Voice rules:
 *   - Talk like Kiwi: warm, soft, never bossy, never performance-y.
 *   - No "you should" / "always". Plenty of "you can" / "if you want".
 *   - Reading-only is just as valid as everything else.
 *
 * Pure function: easy to unit-test (see server/dailyTips.test.ts).
 */
export const DAILY_TIPS: string[] = [
  "If a block feels big, just start with one tiny piece. That counts.",
  "Reading is real schoolwork. \"Just reading\" is plenty for a block.",
  "Tricky brain today? Start with the easiest thing on your list.",
  "Drawing your answer is a real way to turn it in. Promise.",
  "If something feels too hard, you can switch ways \u2014 type, draw, photo, or read.",
  "You can ask Kiwi to read anything to you. That\u2019s not cheating, that\u2019s smart.",
  "Outside counts. A walk and a notice = science.",
  "Snack-break is part of the plan, not a detour.",
  "If you feel stuck, do the next smallest thing.",
  "Mistakes are how brains grow. Yours is growing right now.",
  "You don\u2019t have to do them in order. Pick what looks softest first.",
  "A short block done well > a long block half-done.",
  "Tell Mom how it felt \u2014 \"easy\", \"just right\", \"tricky\", \"really hard\". It helps tomorrow.",
  "Birds notice everything. Be a little birdy today \u2014 notice one thing nobody else does.",
];

/**
 * Pick the tip-of-the-day for a given local date string YYYY-MM-DD.
 * Pure: same date in -> same tip out. No randomness.
 */
export function dailyTipForDate(dateKey: string, pool: string[] = DAILY_TIPS): string {
  if (!pool.length) return "";
  // Hash YYYY-MM-DD into a non-negative int. Simple, deterministic, no deps.
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % pool.length;
  return pool[idx];
}

/** YYYY-MM-DD in the user's local timezone. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
