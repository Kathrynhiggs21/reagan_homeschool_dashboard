/**
 * agendaBudget.ts — v1 (2026-06-17)
 *
 * Two pure helpers that let the conversational agenda editor honor the kind of
 * prompt Katy actually types:
 *
 *   "start at 1pm, 2–4 hours total, measurement types, a lesson on conversions,
 *    metric info, a worksheet on all of it, then a fun duck activity"
 *
 * The LLM is great at *composing* the blocks (titles, content, ordering) but
 * unreliable at the *time math*. So we split responsibilities:
 *
 *   1. parseBudgetAndStart() — extract a start anchor ("1pm" / "start at 10")
 *      and a total-time window ("2–4 hours" / "3 hrs total") from the prompt.
 *      This gets fed to the LLM as explicit guidance AND used by step 2.
 *
 *   2. layoutInsertedBlocks() — after the LLM returns insert ops, deterministically
 *      (a) scale block durations so their sum lands inside the requested window
 *      and (b) assign sequential startTimes forward from the anchor, skipping
 *      over any existing fixed/appointment blocks already on the day.
 *
 * No DB, no LLM, no I/O — fully unit-testable.
 */

export type ParsedBudget = {
  /** "HH:MM" 24h start anchor, or null if none stated. */
  startTime: string | null;
  /** Lower bound of the total work window in minutes, or null. */
  minMinutes: number | null;
  /** Upper bound of the total work window in minutes, or null. */
  maxMinutes: number | null;
  /** Convenience: the target we aim for (mid of range, or the single value). */
  targetMinutes: number | null;
  /** Raw matched fragments, useful for debugging / warnings. */
  matched: { start?: string; budget?: string };
};

/* -------------------------------------------------------------------------- */
/*  Start-time parsing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Normalize an hour + optional minute + optional am/pm into "HH:MM" 24h.
 * Returns null on anything out of range.
 */
function toHHMM(hour: number, minute: number, ampm: string | null): string | null {
  let h = hour;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // No am/pm: assume a school-day sensible reading. 1–7 → afternoon (13–19),
  // 8–11 → morning, 12 → noon, 0 invalid. This matches how a parent speaks:
  // "start at 1" means 1pm on a school afternoon, "start at 10" means 10am.
  if (!ampm) {
    if (h >= 1 && h <= 7) h += 12;
  }
  if (h < 0 || h > 23 || minute < 0 || minute > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Extract a start-time anchor from a prompt. Handles:
 *   "start at 1pm", "start 10", "begin at 9:30", "starts at 1",
 *   "today starts at 1", "kick off at 10am", "@ 1pm", "1 o'clock"
 */
export function parseStartTime(prompt: string): { startTime: string | null; matched?: string } {
  const text = (prompt || "").toLowerCase();

  // Pattern A: an explicit start verb/preposition followed by a time.
  // e.g. "start at 1pm", "starts at 10", "begin 9:30", "kick off at 10am", "@ 1"
  const startVerb =
    /(?:start(?:s|ing)?|begin(?:s|ning)?|kick(?:s)?\s*off|go(?:es)?|@)\s*(?:at|@|around|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|o'?clock)?/i;
  const mA = text.match(startVerb);
  if (mA) {
    const hour = parseInt(mA[1], 10);
    const minute = mA[2] ? parseInt(mA[2], 10) : 0;
    const ap = normalizeAmPm(mA[3]);
    const hhmm = toHHMM(hour, minute, ap);
    if (hhmm) return { startTime: hhmm, matched: mA[0].trim() };
  }

  // Pattern B: a bare "at 1pm" / "at 10" anchored time, only when am/pm is
  // present (to avoid grabbing "worksheet at the end" type noise).
  const atTime = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i;
  const mB = text.match(atTime);
  if (mB) {
    const hour = parseInt(mB[1], 10);
    const minute = mB[2] ? parseInt(mB[2], 10) : 0;
    const ap = normalizeAmPm(mB[3]);
    const hhmm = toHHMM(hour, minute, ap);
    if (hhmm) return { startTime: hhmm, matched: mB[0].trim() };
  }

  return { startTime: null };
}

function normalizeAmPm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/\./g, "");
  if (v === "am") return "am";
  if (v === "pm") return "pm";
  return null; // "o'clock" etc → no am/pm signal
}

/* -------------------------------------------------------------------------- */
/*  Time-budget parsing                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Extract a total-time budget window from a prompt. Handles:
 *   "2-4 hours", "2 to 4 hrs", "2–4 hours total", "about 3 hours",
 *   "3 hrs total", "90 minutes", "an hour and a half", "no more than 3 hours"
 */
export function parseTimeBudget(prompt: string): {
  minMinutes: number | null;
  maxMinutes: number | null;
  matched?: string;
} {
  const text = (prompt || "").toLowerCase();

  // Range: "2-4 hours", "2 to 4 hrs", "2–4 hour"
  const range =
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|min\b)/i;
  const mR = text.match(range);
  if (mR) {
    const unit = mR[3];
    const lo = unitToMinutes(parseFloat(mR[1]), unit);
    const hi = unitToMinutes(parseFloat(mR[2]), unit);
    if (lo != null && hi != null) {
      return { minMinutes: Math.min(lo, hi), maxMinutes: Math.max(lo, hi), matched: mR[0].trim() };
    }
  }

  // "an hour and a half" / "hour and a half"
  if (/\b(?:an?\s+)?hour and a half\b/.test(text)) {
    return { minMinutes: 90, maxMinutes: 90, matched: "hour and a half" };
  }

  // Single value: "3 hours", "90 minutes", "about 2 hrs", "~3h"
  const single =
    /(?:about|around|approx\.?|~|roughly|no more than|under|up to|at most)?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|min\b)/i;
  const mS = text.match(single);
  if (mS) {
    const v = unitToMinutes(parseFloat(mS[1]), mS[2]);
    if (v != null) {
      // "no more than / up to / under / at most" → treat as a max-only cap.
      const cap = /(no more than|under|up to|at most)/i.test(mS[0]);
      return cap
        ? { minMinutes: null, maxMinutes: v, matched: mS[0].trim() }
        : { minMinutes: v, maxMinutes: v, matched: mS[0].trim() };
    }
  }

  return { minMinutes: null, maxMinutes: null };
}

function unitToMinutes(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("h")) return Math.round(value * 60);
  if (u.startsWith("m")) return Math.round(value);
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Combined parse                                                            */
/* -------------------------------------------------------------------------- */

export function parseBudgetAndStart(prompt: string): ParsedBudget {
  const start = parseStartTime(prompt);
  const budget = parseTimeBudget(prompt);

  let targetMinutes: number | null = null;
  if (budget.minMinutes != null && budget.maxMinutes != null) {
    targetMinutes = Math.round((budget.minMinutes + budget.maxMinutes) / 2);
  } else if (budget.maxMinutes != null) {
    targetMinutes = budget.maxMinutes;
  } else if (budget.minMinutes != null) {
    targetMinutes = budget.minMinutes;
  }

  return {
    startTime: start.startTime,
    minMinutes: budget.minMinutes,
    maxMinutes: budget.maxMinutes,
    targetMinutes,
    matched: {
      ...(start.matched ? { start: start.matched } : {}),
      ...(budget.matched ? { budget: budget.matched } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Layout: scale durations to budget + assign sequential start times         */
/* -------------------------------------------------------------------------- */

export type LayoutBlock = {
  /** Stable handle so callers can map results back to their op. */
  ref: number;
  durationMin: number;
  /** True for fixed blocks (appointments) that must not move or be rescaled. */
  fixed?: boolean;
  /** Existing start time, used for fixed blocks. */
  startTime?: string | null;
};

export type LayoutResult = {
  ref: number;
  durationMin: number;
  startTime: string | null;
};

function hhmmToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function minutesToHHMM(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Scale the *flexible* (non-fixed) blocks so their total duration lands inside
 * [minMinutes, maxMinutes] (when provided), then lay out start times forward
 * from `startTime`, flowing around any fixed blocks. Per-block durations are
 * clamped to [5, 180] and rounded to 5-minute increments for tidy schedules.
 *
 * Returns one LayoutResult per input block (fixed blocks keep their time/duration).
 */
export function layoutInsertedBlocks(
  blocks: LayoutBlock[],
  opts: { startTime: string | null; minMinutes: number | null; maxMinutes: number | null },
): LayoutResult[] {
  const flex = blocks.filter((b) => !b.fixed);
  const flexTotal = flex.reduce((s, b) => s + Math.max(5, b.durationMin || 0), 0);

  // Decide a target total for the flexible blocks.
  let target = flexTotal;
  if (opts.maxMinutes != null && flexTotal > opts.maxMinutes) target = opts.maxMinutes;
  if (opts.minMinutes != null && flexTotal < opts.minMinutes) target = opts.minMinutes;
  // When both bounds exist and current total is already inside, leave as-is.

  // Scale flexible durations proportionally toward the target.
  let scaled: Map<number, number> = new Map();
  if (flexTotal > 0 && target !== flexTotal) {
    const factor = target / flexTotal;
    for (const b of flex) {
      const raw = Math.max(5, (b.durationMin || 0)) * factor;
      const rounded = clampRound(raw);
      scaled.set(b.ref, rounded);
    }
    // Reconcile rounding drift against the target by nudging the largest block.
    reconcile(scaled, flex, target);
  } else {
    for (const b of flex) scaled.set(b.ref, clampRound(Math.max(5, b.durationMin || 0)));
  }

  // Lay out start times. Walk a cursor forward from the anchor; when a fixed
  // block's window overlaps the cursor, jump the cursor past it.
  const anchor = opts.startTime ? hhmmToMinutes(opts.startTime) : null;
  const fixedWindows = blocks
    .filter((b) => b.fixed && b.startTime)
    .map((b) => {
      const s = hhmmToMinutes(b.startTime as string);
      return s == null ? null : { start: s, end: s + Math.max(5, b.durationMin || 0) };
    })
    .filter((w): w is { start: number; end: number } => w != null)
    .sort((a, b) => a.start - b.start);

  const results: LayoutResult[] = [];
  let cursor = anchor;

  for (const b of blocks) {
    if (b.fixed) {
      results.push({
        ref: b.ref,
        durationMin: Math.max(5, b.durationMin || 0),
        startTime: b.startTime ?? null,
      });
      continue;
    }
    const dur = scaled.get(b.ref) ?? clampRound(Math.max(5, b.durationMin || 0));
    if (cursor == null) {
      // No anchor → leave start times null (caller keeps LLM-provided or none).
      results.push({ ref: b.ref, durationMin: dur, startTime: null });
      continue;
    }
    cursor = skipFixed(cursor, dur, fixedWindows);
    results.push({ ref: b.ref, durationMin: dur, startTime: minutesToHHMM(cursor) });
    cursor += dur;
  }

  return results;
}

function clampRound(min: number): number {
  let v = Math.round(min / 5) * 5;
  if (v < 5) v = 5;
  if (v > 180) v = 180;
  return v;
}

function reconcile(scaled: Map<number, number>, flex: LayoutBlock[], target: number): void {
  const sum = () => Array.from(scaled.values()).reduce((s, v) => s + v, 0);
  let drift = target - sum();
  if (drift === 0) return;
  // Nudge in 5-min steps on the largest blocks until drift is gone or we run out.
  const order = [...flex].sort((a, b) => (scaled.get(b.ref) ?? 0) - (scaled.get(a.ref) ?? 0));
  let i = 0;
  let guard = 0;
  while (drift !== 0 && guard < 1000) {
    const b = order[i % order.length];
    const cur = scaled.get(b.ref) ?? 5;
    const step = drift > 0 ? 5 : -5;
    const next = cur + step;
    if (next >= 5 && next <= 180) {
      scaled.set(b.ref, next);
      drift -= step;
    }
    i++;
    guard++;
  }
}

function skipFixed(
  cursor: number,
  dur: number,
  fixedWindows: Array<{ start: number; end: number }>,
): number {
  let c = cursor;
  let moved = true;
  let guard = 0;
  while (moved && guard < 100) {
    moved = false;
    for (const w of fixedWindows) {
      // Overlap if [c, c+dur) intersects [w.start, w.end)
      if (c < w.end && c + dur > w.start) {
        c = w.end;
        moved = true;
      }
    }
    guard++;
  }
  return c;
}
