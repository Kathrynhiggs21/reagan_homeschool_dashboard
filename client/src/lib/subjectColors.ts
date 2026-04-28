/**
 * Subject color system — single source of truth.
 *
 * Design direction (Pass 3 — "Kids Activity Planner" chalkboard):
 *   • Cards on the dark chalkboard are frame-only, with a soft chalk-washed tint
 *     so they read as colorful without shouting. The subject color now lives in
 *     the frame, the title text, the time pill, and a glowing 3D icon tile.
 *   • The fill is either transparent (dark theme) or a soft cream (light theme).
 *   • Active "now" blocks can be filled solid — everyone else gets the chalk wash.
 *
 * Five-subject taxonomy is preserved: Math / Science / Social Studies / ELA /
 * Specials + Other fallback. Rainbow row palette is preserved but softened.
 */

export interface SubjectTint {
  slug: string;
  label: string;
  meaning: string;
  bg: string;       // (reference only — the card uses frame+wash now)
  border: string;   // saturated accent used for frame + 3D shadow
  ink: string;      // deep color used for the TITLE text
  pillBg: string;   // time-pill background (saturated)
  pillInk: string;  // time-pill text (usually white)
  emoji: string;
  soft: string;     // very light tint used for the card wash
}

// Soft palette + saturated accents. `bg` is kept for legacy callers (printables
// still want filled pastels) but day-to-day Today rows use `soft` + `border`.
const PALETTE: Record<string, SubjectTint> = {
  math:     { slug: "math",     label: "Math",           meaning: "Numbers, puzzles, money, time",       bg: "#ffb07a", soft: "#ffdcbd", border: "#ff6a00", ink: "#ffb07a", pillBg: "#ff6a00", pillInk: "#fff", emoji: "🔢" },
  science:  { slug: "science",  label: "Science",        meaning: "Animals, nature, experiments",        bg: "#7fe3c4", soft: "#b9f1dd", border: "#10b981", ink: "#7fe3c4", pillBg: "#10b981", pillInk: "#fff", emoji: "🔬" },
  social:   { slug: "social",   label: "Social Studies", meaning: "People, history, places, civics",     bg: "#c9a7ff", soft: "#dec8ff", border: "#7c3aed", ink: "#c9a7ff", pillBg: "#7c3aed", pillInk: "#fff", emoji: "🌍" },
  ela:      { slug: "ela",      label: "ELA (Reading & Writing)", meaning: "Stories, vocabulary, writing", bg: "#ff9fb2", soft: "#ffc6d2", border: "#e11d6b", ink: "#ff9fb2", pillBg: "#e11d6b", pillInk: "#fff", emoji: "📖" },
  specials: { slug: "specials", label: "Specials",       meaning: "Art, music, PE, health",              bg: "#7ec8ff", soft: "#b4def7", border: "#1d6fe0", ink: "#7ec8ff", pillBg: "#1d6fe0", pillInk: "#fff", emoji: "🎨" },
  other:    { slug: "other",    label: "Other",          meaning: "Everything else",                     bg: "#ffe066", soft: "#ffee9e", border: "#d4a900", ink: "#ffe066", pillBg: "#d4a900", pillInk: "#fff", emoji: "📌" },
};

const ALIASES: Record<string, string> = {
  reading: "ela", writing: "ela", spelling: "ela", grammar: "ela", vocab: "ela", vocabulary: "ela", phonics: "ela", literature: "ela",
  ss: "social", history: "social", geography: "social", civics: "social", government: "social",
  art: "specials", music: "specials", pe: "specials", gym: "specials", health: "specials", dance: "specials",
  snack: "other", break: "other", catch_up: "other", adventure: "other", choice: "other", wonder: "other", outdoors: "science",
  academic: "ela", creative: "specials", utility: "other", google: "other", video: "specials", game: "other", learning: "ela",
  school: "ela", nature: "science", creativity: "specials",
};

const FALLBACK: SubjectTint = PALETTE.other;

export function resolveSlug(slug?: string | null): string {
  if (!slug) return "other";
  const key = slug.toLowerCase();
  if (PALETTE[key]) return key;
  if (ALIASES[key]) return ALIASES[key];
  return "other";
}

export function subjectTint(slug?: string | null): SubjectTint {
  return PALETTE[resolveSlug(slug)] ?? FALLBACK;
}

/**
 * The new card style: frame + soft chalk-washed tint (not a bright filled block).
 * Active block (isActive=true) gets a richer fill.
 */
export function tintCardStyle(slug?: string | null, isActive = false): React.CSSProperties {
  const t = subjectTint(slug);
  return isActive
    ? {
        backgroundColor: t.soft,
        border: `2px solid ${t.border}`,
        borderLeft: `10px solid ${t.border}`,
        color: "#1a1a1a",
        boxShadow: `0 6px 0 rgba(0,0,0,0.3), 0 10px 28px -12px ${t.border}99`,
      } as React.CSSProperties
    : {
        backgroundColor: "transparent",
        backgroundImage: `linear-gradient(180deg, ${t.border}18 0%, ${t.border}0a 100%)`,
        border: `2px solid ${t.border}`,
        borderLeft: `10px solid ${t.border}`,
        boxShadow: `0 6px 0 rgba(0,0,0,0.3), 0 10px 28px -12px ${t.border}66, inset 0 1px 0 rgba(255,255,255,0.04)`,
        ["--row-bg" as any]: "transparent",
        ["--row-fg" as any]: "#f7f1e3",
        ["--row-accent" as any]: t.border,
      } as React.CSSProperties;
}

export function tintInkStyle(slug?: string | null): React.CSSProperties {
  return { color: subjectTint(slug).ink, textShadow: "0 1px 0 rgba(0,0,0,0.35)" };
}

export function tintPillStyle(slug?: string | null): React.CSSProperties {
  const t = subjectTint(slug);
  return {
    backgroundColor: t.pillBg,
    color: t.pillInk,
    boxShadow: `0 3px 0 rgba(0,0,0,0.3), 0 0 12px ${t.border}55`,
  };
}

/** Visible subjects shown in the Color Key — exactly 5 + Other. */
export const COLOR_KEY_SUBJECTS: SubjectTint[] = [
  PALETTE.math, PALETTE.science, PALETTE.social, PALETTE.ela, PALETTE.specials, PALETTE.other,
];

/** App page still uses same 5+1 buckets for consistency. */
export const APP_CATEGORY_KEY: SubjectTint[] = COLOR_KEY_SUBJECTS;


/**
 * RAINBOW LIST PALETTE — used for the Daily Playlist rows so each activity
 * shows in a different rainbow color (independent of subject).
 *
 * New (Pass 3): frame + chalk-wash instead of filled pastel blocks.
 */
export interface RainbowStop {
  name: string;
  bg: string;       // legacy filled bg (kept for printables)
  border: string;   // saturated accent — now the primary visual
  ink: string;      // title color (on dark) / filled-ink (on cream)
}

export const RAINBOW: RainbowStop[] = [
  { name: "coral",    bg: "#ff8fa3", border: "#e11d6b", ink: "#ff9fb2" },
  { name: "peach",    bg: "#ffb07a", border: "#ff6a00", ink: "#ffc7a5" },
  { name: "butter",   bg: "#ffe066", border: "#d4a900", ink: "#ffe788" },
  { name: "mint",     bg: "#7fe3c4", border: "#10b981", ink: "#9fedd2" },
  { name: "sky",      bg: "#7ec8ff", border: "#1d6fe0", ink: "#a1daff" },
  { name: "lavender", bg: "#c9a7ff", border: "#7c3aed", ink: "#dec3ff" },
  { name: "pink",     bg: "#ffaad4", border: "#db2777", ink: "#ffc1df" },
];

function daySeed(date?: Date): number {
  const d = date ?? new Date();
  return d.getDay();
}

export function rainbowStop(index: number, date?: Date): RainbowStop {
  const offset = daySeed(date);
  const i = ((index + offset) % RAINBOW.length + RAINBOW.length) % RAINBOW.length;
  return RAINBOW[i];
}

/** Frame-only card with soft chalk-wash. Active flag fills it brightly. */
export function rainbowCardStyle(index: number, date?: Date, isActive = false): React.CSSProperties {
  const s = rainbowStop(index, date);
  return isActive
    ? {
        backgroundColor: s.bg,
        border: `2px solid ${s.border}`,
        borderLeft: `10px solid ${s.border}`,
        color: "#1a1a1a",
        boxShadow: `0 6px 0 rgba(0,0,0,0.3), 0 12px 28px -10px ${s.border}aa`,
      } as React.CSSProperties
    : {
        backgroundColor: "transparent",
        backgroundImage: `linear-gradient(180deg, ${s.border}18 0%, ${s.border}08 100%)`,
        border: `2px solid ${s.border}`,
        borderLeft: `10px solid ${s.border}`,
        boxShadow: `0 6px 0 rgba(0,0,0,0.3), 0 10px 28px -12px ${s.border}55, inset 0 1px 0 rgba(255,255,255,0.04)`,
        ["--row-bg" as any]: "transparent",
        ["--row-fg" as any]: "#f7f1e3",
        ["--row-accent" as any]: s.border,
      } as React.CSSProperties;
}

export function rainbowPillStyle(index: number, date?: Date): React.CSSProperties {
  const s = rainbowStop(index, date);
  return {
    backgroundColor: s.border,
    color: "#fff",
    boxShadow: `0 3px 0 rgba(0,0,0,0.35), 0 0 14px ${s.border}66`,
  };
}

export function rainbowInkStyle(index: number, date?: Date): React.CSSProperties {
  const s = rainbowStop(index, date);
  return { color: s.ink, textShadow: `0 0 1px rgba(255,255,255,0.25), 0 1px 0 rgba(0,0,0,0.4)` };
}
