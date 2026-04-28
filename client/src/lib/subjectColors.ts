/**
 * Subject color system — single source of truth.
 * Five-subject taxonomy: Math / Science / Social Studies / ELA / Specials + Other fallback.
 * Palette is groovy-retro bright pastel — chosen so each subject is instantly
 * distinguishable on the dark chalkboard backdrop.
 *
 * Palette reference (Daily Schedule Cards, groovy-retro):
 *   Coral pink   #ff6f91  → ELA (stories, hearts)
 *   Peach        #ffb07a  → Math (orange-family, numbers)
 *   Mint green   #7fe3c4  → Science (nature)
 *   Lavender     #c9a7ff  → Social Studies (history, people)
 *   Sky blue     #7ec8ff  → Specials (art, music, PE)
 *   Butter yellow #ffe066 → Other / fallback
 */

export interface SubjectTint {
  slug: string;
  label: string;
  meaning: string;
  bg: string;       // bright pastel fill used on the card
  border: string;   // saturated accent line + 8px left border
  ink: string;      // deep text/icon color on the pastel fill
  pillBg: string;   // subject pill background
  pillInk: string;  // subject pill text
  emoji: string;
}

// Bright, saturated pastels — readable on dark chalkboard + sufficient contrast for ink text
const PALETTE: Record<string, SubjectTint> = {
  math:     { slug: "math",     label: "Math",           meaning: "Numbers, puzzles, money, time",   bg: "#ffb07a", border: "#ff6a00", ink: "#4a1a00", pillBg: "#ff6a00", pillInk: "#fff", emoji: "🔢" },
  science:  { slug: "science",  label: "Science",        meaning: "Animals, nature, experiments",    bg: "#7fe3c4", border: "#10b981", ink: "#063c2d", pillBg: "#10b981", pillInk: "#fff", emoji: "🔬" },
  social:   { slug: "social",   label: "Social Studies", meaning: "People, history, places, civics", bg: "#c9a7ff", border: "#7c3aed", ink: "#2a0e66", pillBg: "#7c3aed", pillInk: "#fff", emoji: "🌍" },
  ela:      { slug: "ela",      label: "ELA (Reading & Writing)", meaning: "Stories, vocabulary, writing", bg: "#ff9fb2", border: "#e11d6b", ink: "#5a0724", pillBg: "#e11d6b", pillInk: "#fff", emoji: "📖" },
  specials: { slug: "specials", label: "Specials",       meaning: "Art, music, PE, health",          bg: "#7ec8ff", border: "#1d6fe0", ink: "#062a5c", pillBg: "#1d6fe0", pillInk: "#fff", emoji: "🎨" },
  other:    { slug: "other",    label: "Other",          meaning: "Everything else",                 bg: "#ffe066", border: "#d4a900", ink: "#4a3600", pillBg: "#d4a900", pillInk: "#fff", emoji: "📌" },
};

// Legacy slug aliases — any older data points to one of the 5
const ALIASES: Record<string, string> = {
  // ELA family
  reading: "ela", writing: "ela", spelling: "ela", grammar: "ela", vocab: "ela", vocabulary: "ela", phonics: "ela", literature: "ela",
  // Social Studies family
  ss: "social", history: "social", geography: "social", civics: "social", government: "social",
  // Specials family
  art: "specials", music: "specials", pe: "specials", gym: "specials", health: "specials", dance: "specials",
  // Other / break / misc (keep Reagan's existing flow visually coherent)
  snack: "other", break: "other", catch_up: "other", adventure: "other", choice: "other", wonder: "other", outdoors: "science",
  // App category aliases → map to the 5 visual buckets
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
 * Inline style helpers — apply to a card to fully tint it with vibrant fill + 8px accent.
 * Groovy-retro look: bright pastel body, chunky saturated border, deep ink text.
 */
export function tintCardStyle(slug?: string | null): React.CSSProperties {
  const t = subjectTint(slug);
  return {
    backgroundColor: t.bg,
    borderLeft: `8px solid ${t.border}`,
    color: t.ink,
    boxShadow: "0 4px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)",
    ["--row-bg" as any]: t.bg,
    ["--row-fg" as any]: t.ink,
    ["--row-accent" as any]: t.border,
    ["--row-border" as any]: "rgba(0,0,0,0.14)",
  } as React.CSSProperties;
}

export function tintInkStyle(slug?: string | null): React.CSSProperties {
  return { color: subjectTint(slug).ink };
}

export function tintPillStyle(slug?: string | null): React.CSSProperties {
  const t = subjectTint(slug);
  return { backgroundColor: t.pillBg, color: t.pillInk };
}

/** Visible subjects shown in the Color Key — exactly 5 + Other. */
export const COLOR_KEY_SUBJECTS: SubjectTint[] = [
  PALETTE.math, PALETTE.science, PALETTE.social, PALETTE.ela, PALETTE.specials, PALETTE.other,
];

/** App page still uses same 5+1 buckets for consistency. */
export const APP_CATEGORY_KEY: SubjectTint[] = COLOR_KEY_SUBJECTS;
