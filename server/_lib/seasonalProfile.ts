/**
 * seasonalProfile.ts — v2.97 (2026-05-27)
 *
 * Single source of truth for "what does a default day look like right now?"
 * Used by aiScheduleGenerator + aiScheduleProposer so every AI-generated agenda
 * respects season-of-year defaults unless Mom/Grandma/Tutor explicitly override
 * via natural-language input.
 *
 * Why this exists:
 *   - In summer, Reagan starts later, does fewer blocks, focuses on core
 *     curriculum (math + ELA + one science/SS rotation + one reading),
 *     and gets more outdoor / hands-on activities.
 *   - In the school year, she runs a standard 8:30-start, 6-7 block day with
 *     specials (art / music / choice / PE rotation).
 *   - The AI must NEVER produce a 7-block 8:30am day mid-July just because
 *     its training distribution leans that way.
 *
 * Detection:
 *   - Summer: roughly Memorial Day (last Mon of May) → Labor Day (1st Mon of Sep)
 *   - School year: everything else
 *
 * Output shape:
 *   - Used in system-prompt injection in aiScheduleGenerator.buildSystemPrompt
 *   - Used as the "default profile" in aiScheduleProposer NL parser
 *
 * NOTE: All times are local "HH:MM" 24-hour strings — UI converts to 12-hour
 * via formatTime12h. Block counts are guidance, not hard caps; the AI may
 * pick ±1 if it makes pedagogical sense.
 */

export type SeasonalMode = "summer" | "school-year";

export interface SeasonalProfile {
  mode: SeasonalMode;
  defaultStart: string;       // "HH:MM" 24h
  defaultEnd: string;         // "HH:MM" 24h, soft target
  targetBlockCount: number;   // central tendency, AI can ±1
  minBlockCount: number;
  maxBlockCount: number;
  specialsBudget: number;     // max non-curriculum blocks per day
  focus: ("math" | "ela" | "reading" | "science" | "social_studies" | "art" | "music" | "choice" | "pe" | "outdoor" | "project")[];
  notes: string[];            // free-form hints injected into system prompt
  fridayLighter: boolean;     // Friday = even shorter than weekday default
  weekendDefault: "skip" | "light";
}

/**
 * Last Monday of May for a given year (Memorial Day, US).
 */
export function memorialDay(year: number): Date {
  // May = month 4 (0-indexed). Find the last Monday in May.
  const d = new Date(year, 4, 31); // May 31
  // getDay(): Sun=0, Mon=1, ... Sat=6
  const dayOfWeek = d.getDay();
  const daysBack = (dayOfWeek - 1 + 7) % 7; // back to Monday
  d.setDate(31 - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * First Monday of September for a given year (Labor Day, US).
 */
export function laborDay(year: number): Date {
  const d = new Date(year, 8, 1); // Sep 1
  const dayOfWeek = d.getDay();
  const daysForward = (1 - dayOfWeek + 7) % 7;
  d.setDate(1 + daysForward);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns "summer" if `date` is between Memorial Day (inclusive) and
 * Labor Day (inclusive), otherwise "school-year".
 */
export function detectSeasonalMode(date: Date): SeasonalMode {
  const year = date.getFullYear();
  const md = memorialDay(year);
  const ld = laborDay(year);
  const ts = date.getTime();
  return ts >= md.getTime() && ts <= ld.getTime() ? "summer" : "school-year";
}

const SUMMER_PROFILE: Omit<SeasonalProfile, "mode" | "fridayLighter"> = {
  defaultStart: "10:00",
  defaultEnd: "12:30",
  targetBlockCount: 4,
  minBlockCount: 3,
  maxBlockCount: 5,
  specialsBudget: 1,
  focus: ["math", "ela", "reading", "outdoor"],
  notes: [
    "Summer mode: keep it light, late start, curriculum-focused, fewer specials.",
    "Prefer outdoor / hands-on / real-world activities (bird watching, gardening, water-cycle experiments) over passive worksheet blocks.",
    "Default day is 4 blocks: 1 math, 1 ELA, 1 reading or science/SS rotation, 1 outdoor or choice.",
    "Skip art/music specials unless explicitly requested.",
    "Friday should be even lighter (3 blocks max).",
  ],
  weekendDefault: "skip",
};

const SCHOOL_YEAR_PROFILE: Omit<SeasonalProfile, "mode" | "fridayLighter"> = {
  defaultStart: "08:30",
  defaultEnd: "14:30",
  targetBlockCount: 6,
  minBlockCount: 5,
  maxBlockCount: 7,
  specialsBudget: 2,
  focus: ["math", "ela", "reading", "science", "social_studies"],
  notes: [
    "School-year mode: full curriculum rotation with specials.",
    "Start 8:30 AM. Target 6 blocks: math, ELA, reading, science OR social studies, 1 special (art/music/PE), 1 wrap-up/choice.",
    "Wednesdays often include an adventure / field-trip block.",
    "Fridays may include a project showcase or lighter cap.",
  ],
  weekendDefault: "skip",
};

/**
 * Build the active profile for a given date. The `today` parameter is
 * injectable for testability.
 */
export function buildSeasonalProfile(today: Date = new Date()): SeasonalProfile {
  const mode = detectSeasonalMode(today);
  const fridayLighter = today.getDay() === 5; // 5 = Friday
  if (mode === "summer") {
    return {
      mode,
      ...SUMMER_PROFILE,
      fridayLighter,
      targetBlockCount: fridayLighter
        ? Math.max(SUMMER_PROFILE.minBlockCount, SUMMER_PROFILE.targetBlockCount - 1)
        : SUMMER_PROFILE.targetBlockCount,
    };
  }
  return {
    mode,
    ...SCHOOL_YEAR_PROFILE,
    fridayLighter,
  };
}

/**
 * Render a profile as a system-prompt fragment the LLM can ingest.
 */
export function renderSeasonalPromptFragment(p: SeasonalProfile): string {
  const friday = p.fridayLighter ? " (Friday — keep it lighter than usual)" : "";
  return [
    `=== Seasonal Defaults (mode: ${p.mode})${friday} ===`,
    `Default start time: ${p.defaultStart}`,
    `Default end target: ${p.defaultEnd}`,
    `Target block count: ${p.targetBlockCount} (range ${p.minBlockCount}-${p.maxBlockCount})`,
    `Max non-curriculum specials per day: ${p.specialsBudget}`,
    `Priority subjects: ${p.focus.join(", ")}`,
    `Weekend default: ${p.weekendDefault}`,
    `Guidance:`,
    ...p.notes.map((n) => `- ${n}`),
    `These are defaults. If Mom, Grandma, or the tutor's input explicitly overrides any of them (e.g. "start at 9", "long focused day", "crush math"), follow the override.`,
  ].join("\n");
}
