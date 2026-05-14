/**
 * Push 142 (2026-05-14) — Weekly schedule balance scorer.
 *
 * Reads a planned week of blocks and reports:
 *   - outdoor minutes vs desk minutes (project rule: outdoor / real-world
 *     activities are preferred — surface them; see Push 138 outdoor tag)
 *   - subject-variety score across math / ela / science / social-studies /
 *     specials (5 canonical subjects)
 *   - kid-friendly headline ("Outdoor-rich", "Desk-heavy", "Light",
 *     "Balanced", "Subject-narrow") with tone band
 *   - per-day desk-minute totals + over-cap days (>180 min desk per day)
 *
 * Slay Charge ⚡ morning_vibe blocks are EXCLUDED from both totals (they
 * don't count toward schoolwork or coverage; see Push 118).
 *
 * Pure module: no DB / no I/O.
 */

export const CANONICAL_SUBJECTS = [
  "math",
  "ela",
  "science",
  "social-studies",
  "specials",
] as const;
export type CanonicalSubject = (typeof CANONICAL_SUBJECTS)[number];

export const DESK_MINUTES_PER_DAY_CAP = 180; // 3 hours of desk work / day soft cap
export const OUTDOOR_RICH_THRESHOLD = 0.35; // outdoor share ≥ 35% → outdoor-rich
export const DESK_HEAVY_THRESHOLD = 0.85; // desk share ≥ 85% → desk-heavy

export type WeeklyScheduleBlockInput = {
  /** ISO local date YYYY-MM-DD; weekend dates are still counted but
   *  flagged via includesWeekend. Caller decides which dates to pass. */
  dateIso: string;
  /** Block type (used to filter morning_vibe). */
  blockType?: string | null;
  /** Subject slug; non-canonical / null → counted as "other" and ignored
   *  for variety score, still counted toward total minutes. */
  subject?: string | null;
  /** Estimated minutes for the block. <=0 / non-finite → 0. */
  estMinutes?: number | null;
  /** True when the block is tagged outdoor / real-world (Push 138). */
  isOutdoor?: boolean | null;
};

export type WeeklyScheduleBalance = {
  totalBlocks: number;
  totalMinutes: number;
  outdoorMinutes: number;
  deskMinutes: number;
  outdoorShare: number; // 0..1
  deskShare: number; // 0..1
  subjectsCovered: CanonicalSubject[];
  subjectsMissing: CanonicalSubject[];
  /** 0..1 — fraction of canonical subjects with at least one minute. */
  subjectVarietyScore: number;
  perDayDeskMinutes: Record<string, number>;
  overDeskCapDays: string[];
  includesWeekend: boolean;
  headline:
    | "Outdoor-rich"
    | "Desk-heavy"
    | "Light"
    | "Balanced"
    | "Subject-narrow"
    | "Empty";
  tone: "good" | "warn" | "info" | "danger";
};

const WEEKDAY = new Set([1, 2, 3, 4, 5]);

function isCanonicalSubject(s: unknown): s is CanonicalSubject {
  if (typeof s !== "string") return false;
  return (CANONICAL_SUBJECTS as readonly string[]).includes(s.toLowerCase());
}

function clampMin(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function isMorningVibeType(t: unknown): boolean {
  if (typeof t !== "string") return false;
  const v = t.toLowerCase();
  return v === "morning_vibe" || v === "morning_warmup";
}

export function scoreWeeklyScheduleBalance(
  blocks: WeeklyScheduleBlockInput[] | null | undefined,
): WeeklyScheduleBalance {
  const subjectsHit = new Set<CanonicalSubject>();
  const perDayDesk: Record<string, number> = {};
  let total = 0;
  let outdoor = 0;
  let desk = 0;
  let counted = 0;
  let includesWeekend = false;

  if (Array.isArray(blocks)) {
    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      if (isMorningVibeType(b.blockType)) continue;
      const min = clampMin(b.estMinutes);
      if (min <= 0) continue;
      counted += 1;
      total += min;

      const dateIso = typeof b.dateIso === "string" ? b.dateIso : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
        // Day-of-week from YYYY-MM-DD treated as UTC date is fine for
        // weekday detection (caller passes family-local dates).
        const d = new Date(dateIso + "T00:00:00Z").getUTCDay();
        if (!WEEKDAY.has(d)) includesWeekend = true;
      }

      if (b.isOutdoor === true) {
        outdoor += min;
      } else {
        desk += min;
        if (dateIso) {
          perDayDesk[dateIso] = (perDayDesk[dateIso] ?? 0) + min;
        }
      }

      if (isCanonicalSubject(b.subject)) {
        subjectsHit.add((b.subject as string).toLowerCase() as CanonicalSubject);
      }
    }
  }

  const safeTotal = total > 0 ? total : 0;
  const outdoorShare = safeTotal > 0 ? outdoor / safeTotal : 0;
  const deskShare = safeTotal > 0 ? desk / safeTotal : 0;
  const subjectsCovered = CANONICAL_SUBJECTS.filter((s) => subjectsHit.has(s));
  const subjectsMissing = CANONICAL_SUBJECTS.filter(
    (s) => !subjectsHit.has(s),
  );
  const variety = subjectsCovered.length / CANONICAL_SUBJECTS.length;
  const overDeskCapDays = Object.entries(perDayDesk)
    .filter(([, m]) => m > DESK_MINUTES_PER_DAY_CAP)
    .map(([d]) => d)
    .sort();

  let headline: WeeklyScheduleBalance["headline"];
  let tone: WeeklyScheduleBalance["tone"];
  if (counted === 0) {
    headline = "Empty";
    tone = "info";
  } else if (safeTotal < 60) {
    headline = "Light";
    tone = "info";
  } else if (subjectsCovered.length <= 2) {
    headline = "Subject-narrow";
    tone = "warn";
  } else if (deskShare >= DESK_HEAVY_THRESHOLD) {
    headline = "Desk-heavy";
    tone = "warn";
  } else if (outdoorShare >= OUTDOOR_RICH_THRESHOLD) {
    headline = "Outdoor-rich";
    tone = "good";
  } else {
    headline = "Balanced";
    tone = "good";
  }
  if (overDeskCapDays.length > 0) {
    tone = tone === "good" ? "warn" : tone;
  }

  return {
    totalBlocks: counted,
    totalMinutes: safeTotal,
    outdoorMinutes: outdoor,
    deskMinutes: desk,
    outdoorShare,
    deskShare,
    subjectsCovered,
    subjectsMissing,
    subjectVarietyScore: variety,
    perDayDeskMinutes: perDayDesk,
    overDeskCapDays,
    includesWeekend,
    headline,
    tone,
  };
}
