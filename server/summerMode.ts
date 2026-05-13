/**
 * Push 65 (2026-05-13) — Slice 5 summer-mode foundation.
 *
 * Pure helpers, no DB access. All inputs explicit so we can unit-test
 * boundaries (Jun 5 = school, Jun 6 = summer; Aug 15 = summer, Aug 16 =
 * school) without mocking time or the database. The Mom-editable
 * settings are stored as text under canonical keys in app_settings:
 *
 *   summer.autoFlipEnabled  "1" | "0"           — default "1"
 *   summer.start            "MM-DD"             — default "06-06"
 *   summer.end              "MM-DD"             — default "08-15"
 *   summer.override         "on" | "off" | null — manual Mom toggle
 *   summer.vacationRanges   JSON array of { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 *
 * The "off" override blanks summer (e.g. Reagan goes to grandma's
 * intensive math camp in July and Mom wants a normal school day). The
 * "on" override forces summer (e.g. heat wave in May).
 *
 * Block-type variants and the 3-option summer-choice chooser are kept
 * here so adult agendas, the daily PDF, and the kid-side "what's
 * tomorrow?" tile all draw from the same registry.
 */

export interface SummerSettings {
  autoFlipEnabled?: boolean;
  start?: string; // "MM-DD"
  end?: string; // "MM-DD"
  override?: "on" | "off" | null;
  vacationRanges?: Array<{ start: string; end: string }>;
}

const DEFAULT_START = "06-06";
const DEFAULT_END = "08-15";

/** Parse "YYYY-MM-DD" to a Date (UTC midnight) without timezone drift. */
function parseISODate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`bad ISO date: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Auto window check: does `date` fall in [start, end] inclusive (same calendar year)? */
export function isSummerWindow(
  isoDate: string,
  opts: { start?: string; end?: string } = {},
): boolean {
  const start = opts.start ?? DEFAULT_START;
  const end = opts.end ?? DEFAULT_END;
  const mmdd = isoDate.slice(5); // "MM-DD"
  // Lexicographic compare on MM-DD works because of the zero-padded format.
  return mmdd >= start && mmdd <= end;
}

/** Is `isoDate` inside ANY of the parent's declared vacation ranges? */
export function isInVacationRanges(
  isoDate: string,
  ranges: Array<{ start: string; end: string }> | null | undefined,
): boolean {
  if (!ranges || ranges.length === 0) return false;
  for (const r of ranges) {
    if (!r?.start || !r?.end) continue;
    if (isoDate >= r.start && isoDate <= r.end) return true;
  }
  return false;
}

export interface SummerStatus {
  active: boolean;
  reason: "auto" | "manual-on" | "manual-off" | "vacation" | "school-year";
}

/** Combined: manual override > vacation > auto window > school year. */
export function effectiveSummerActive(
  isoDate: string,
  settings: SummerSettings | null | undefined,
): SummerStatus {
  const s = settings ?? {};
  // 1) Manual override is highest priority for Mom + Grandma.
  if (s.override === "off") return { active: false, reason: "manual-off" };
  if (s.override === "on") return { active: true, reason: "manual-on" };
  // 2) Declared vacation range trumps auto window.
  if (isInVacationRanges(isoDate, s.vacationRanges ?? null))
    return { active: false, reason: "vacation" };
  // 3) Auto flip if enabled (default on) and inside the window.
  const autoOn = s.autoFlipEnabled !== false; // default true
  if (autoOn && isSummerWindow(isoDate, { start: s.start, end: s.end })) {
    return { active: true, reason: "auto" };
  }
  return { active: false, reason: "school-year" };
}

/** ----- Block-type summer variants registry ----- */

export type SummerVariantKind = "outdoor" | "library" | "game" | "hands-on";

export interface SummerVariant {
  kind: SummerVariantKind;
  title: string;
  blurb: string;
  /** Reagan-side recommendation chip — keep short so it fits on the chooser button. */
  chip: string;
}

/**
 * Frozen registry. Each block-type ("reading", "math", "adventure",
 * "practice", "choice") has its 4 summer variants. The PDF generator,
 * the kid-side chooser, and the agenda picker all read from this map.
 */
export const SUMMER_BLOCK_VARIANTS: Readonly<Record<string, Readonly<SummerVariant[]>>> =
  Object.freeze({
    reading: Object.freeze<SummerVariant[]>([
      { kind: "outdoor", title: "Read in the hammock", blurb: "30 minutes of free-choice reading outside.", chip: "🌳 Hammock" },
      { kind: "library", title: "Library trip", blurb: "Pick 3 new books at the library.", chip: "📚 Library" },
      { kind: "game", title: "Story dice", blurb: "Build a story using 5 random dice prompts.", chip: "🎲 Story dice" },
      { kind: "hands-on", title: "Read-aloud + sketch", blurb: "Sketch a scene as Mom reads aloud.", chip: "✏️ Sketch" },
    ]),
    math: Object.freeze<SummerVariant[]>([
      { kind: "outdoor", title: "Sidewalk-chalk fractions", blurb: "Draw a giant fraction wall in chalk.", chip: "🖍️ Chalk math" },
      { kind: "library", title: "Math read-aloud", blurb: "Read a Sir Cumference book at the library.", chip: "📐 Math story" },
      { kind: "game", title: "24 game / dice", blurb: "Play one round of the 24 game with cards.", chip: "🎯 24 game" },
      { kind: "hands-on", title: "Kitchen measuring", blurb: "Halve or double a recipe with Mom.", chip: "🥣 Kitchen" },
    ]),
    adventure: Object.freeze<SummerVariant[]>([
      { kind: "outdoor", title: "Nature scavenger hunt", blurb: "10-item summer scavenger list.", chip: "🍃 Scavenger" },
      { kind: "library", title: "Local-history corner", blurb: "Pick one Cincinnati history book.", chip: "🏛️ History" },
      { kind: "game", title: "Backyard Olympics", blurb: "Invent 3 events with the cousins.", chip: "🏅 Olympics" },
      { kind: "hands-on", title: "Bird-feeder build", blurb: "Build a feeder from a milk jug.", chip: "🐦 Feeder" },
    ]),
    practice: Object.freeze<SummerVariant[]>([
      { kind: "outdoor", title: "Driveway flashcards", blurb: "Bounce-the-ball-each-answer practice.", chip: "🏀 Driveway" },
      { kind: "library", title: "Quiet review hour", blurb: "30 min of any practice app, library wifi.", chip: "📖 Library hour" },
      { kind: "game", title: "Spelling B with budgies", blurb: "Mom calls out 10 words, Kiwi cheers.", chip: "🐤 Spelling" },
      { kind: "hands-on", title: "Manipulatives tray", blurb: "Use base-10 blocks on the porch.", chip: "🧮 Tray" },
    ]),
    choice: Object.freeze<SummerVariant[]>([
      { kind: "outdoor", title: "Garden", blurb: "Tend the tomato + herb pots.", chip: "🍅 Garden" },
      { kind: "library", title: "Library club", blurb: "Drop in on the summer reading club.", chip: "🎟️ Club" },
      { kind: "game", title: "Roblox bonus", blurb: "Earned Roblox time as a choice block.", chip: "🎮 Roblox" },
      { kind: "hands-on", title: "Art kit", blurb: "Free-choice from the art kit shelf.", chip: "🎨 Art" },
    ]),
  });

/** Tiny deterministic hash so a given seed always yields the same 3 picks. */
function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic 3-of-4 picker — Reagan sees the same 3 options if she
 * refreshes, but they rotate day-to-day. We never repeat options inside
 * one call.
 */
export function summerChoiceOptions(
  blockType: keyof typeof SUMMER_BLOCK_VARIANTS,
  seed: string,
): SummerVariant[] {
  const pool = SUMMER_BLOCK_VARIANTS[blockType];
  if (!pool || pool.length === 0) return [];
  // Pick 3 without replacement. We rotate by seed-based offset, then drop one.
  const offset = seedHash(seed) % pool.length;
  const rotated: SummerVariant[] = [];
  for (let i = 0; i < pool.length; i++) rotated.push(pool[(i + offset) % pool.length]);
  return rotated.slice(0, 3);
}

/**
 * Streak boost multiplier — base economy is 1× coins per block. During
 * summer mode, every full 5-day streak adds +0.5×, capped at 3×.
 * Outside summer the boost is always 1× (regular economy).
 */
export function streakBoostMultiplier(streakDays: number, summerActive: boolean): number {
  if (!summerActive) return 1;
  if (!Number.isFinite(streakDays) || streakDays <= 0) return 1;
  const steps = Math.floor(streakDays / 5);
  const m = 1 + 0.5 * steps;
  return Math.min(3, m);
}

/** Convenience: hydrate SummerSettings from the flat appSettings rows. */
export function summerSettingsFromKv(
  kv: Record<string, string | null | undefined>,
): SummerSettings {
  const out: SummerSettings = {};
  if (kv["summer.autoFlipEnabled"] != null) {
    out.autoFlipEnabled = kv["summer.autoFlipEnabled"] === "1";
  }
  if (kv["summer.start"]) out.start = kv["summer.start"] as string;
  if (kv["summer.end"]) out.end = kv["summer.end"] as string;
  const ov = kv["summer.override"];
  if (ov === "on" || ov === "off") out.override = ov;
  const raw = kv["summer.vacationRanges"];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.vacationRanges = parsed;
    } catch {
      // ignore malformed JSON — treat as no ranges
    }
  }
  return out;
}
