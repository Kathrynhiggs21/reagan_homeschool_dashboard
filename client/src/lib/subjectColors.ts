/**
 * Subject color system — single source of truth.
 * Used by Today / Week / Tutor / Curriculum / Adventures / Books / Apps to
 * tint full cards in the subject's color so Reagan instantly knows what's what.
 *
 * Palette is friendly and high-contrast on the cream chalkboard background.
 */

export interface SubjectTint {
  slug: string;
  label: string;
  meaning: string;
  bg: string;       // very soft tint for full card background
  border: string;   // 4px left-border accent
  ink: string;      // text/icon color used in headers
  pillBg: string;   // subject pill background
  pillInk: string;  // subject pill text
  emoji: string;
}

const PALETTE: Record<string, SubjectTint> = {
  math:    { slug: "math",    label: "Math",         meaning: "Numbers, puzzles, money, time", bg: "#fff4e0", border: "#ff9b3d", ink: "#a14a00", pillBg: "#ff9b3d", pillInk: "#fff", emoji: "🔢" },
  ela:     { slug: "ela",     label: "Reading & Writing", meaning: "Stories, vocabulary, writing", bg: "#e0eeff", border: "#3b82f6", ink: "#1e3a8a", pillBg: "#3b82f6", pillInk: "#fff", emoji: "📖" },
  reading: { slug: "reading", label: "Reading",      meaning: "Books, comprehension, read-alouds", bg: "#ffe7d6", border: "#ef4444", ink: "#7a1f1f", pillBg: "#ef4444", pillInk: "#fff", emoji: "📚" },
  writing: { slug: "writing", label: "Writing",      meaning: "Sentences, journals, stories", bg: "#e0eeff", border: "#3b82f6", ink: "#1e3a8a", pillBg: "#3b82f6", pillInk: "#fff", emoji: "✍️" },
  science: { slug: "science", label: "Science",      meaning: "Animals, nature, experiments", bg: "#dcf3df", border: "#22c55e", ink: "#1f5132", pillBg: "#22c55e", pillInk: "#fff", emoji: "🔬" },
  ss:      { slug: "ss",      label: "Social Studies", meaning: "People, history, places, civics", bg: "#fde2e2", border: "#dc2626", ink: "#7a1d1d", pillBg: "#dc2626", pillInk: "#fff", emoji: "🌍" },
  art:     { slug: "art",     label: "Art",          meaning: "Drawing, color, making things", bg: "#f6e1ff", border: "#a855f7", ink: "#581c87", pillBg: "#a855f7", pillInk: "#fff", emoji: "🎨" },
  music:   { slug: "music",   label: "Music",        meaning: "Songs, listening, rhythm", bg: "#ffe0f0", border: "#ec4899", ink: "#831843", pillBg: "#ec4899", pillInk: "#fff", emoji: "🎵" },
  outdoors:{ slug: "outdoors",label: "Outdoors",     meaning: "Move outside, observe, explore", bg: "#dcfce7", border: "#16a34a", ink: "#14532d", pillBg: "#16a34a", pillInk: "#fff", emoji: "🌳" },
  pe:      { slug: "pe",      label: "PE / Move",    meaning: "Move your body, play, walk", bg: "#dcfce7", border: "#16a34a", ink: "#14532d", pillBg: "#16a34a", pillInk: "#fff", emoji: "🤸" },
  snack:   { slug: "snack",   label: "Snack",        meaning: "Snack and water break", bg: "#fef3c7", border: "#eab308", ink: "#7c5e00", pillBg: "#eab308", pillInk: "#fff", emoji: "🍎" },
  break:   { slug: "break",   label: "Break",        meaning: "Brain rest, anything you want", bg: "#fef3c7", border: "#eab308", ink: "#7c5e00", pillBg: "#eab308", pillInk: "#fff", emoji: "💛" },
  catch_up:{ slug: "catch_up",label: "Catch-up",     meaning: "Finish anything you didn't get to", bg: "#e2e8f0", border: "#64748b", ink: "#1f2937", pillBg: "#64748b", pillInk: "#fff", emoji: "↩️" },
  adventure:{ slug:"adventure",label:"Adventure",    meaning: "Choose-your-own activity", bg: "#cffafe", border: "#06b6d4", ink: "#0c4a6e", pillBg: "#06b6d4", pillInk: "#fff", emoji: "🗺️" },
  choice:  { slug: "choice",  label: "Choice",       meaning: "You pick what to do", bg: "#cffafe", border: "#06b6d4", ink: "#0c4a6e", pillBg: "#06b6d4", pillInk: "#fff", emoji: "✨" },
  wonder:  { slug: "wonder",  label: "Wonder",       meaning: "Wonder moments and curiosity", bg: "#ede9fe", border: "#7c3aed", ink: "#4c1d95", pillBg: "#7c3aed", pillInk: "#fff", emoji: "🌟" },
  // App categories double as subject colors:
  academic:{ slug: "academic",label: "Academic",     meaning: "School learning apps", bg: "#e0eeff", border: "#3b82f6", ink: "#1e3a8a", pillBg: "#3b82f6", pillInk: "#fff", emoji: "🧠" },
  creative:{ slug: "creative",label: "Creative",     meaning: "Make things, draw, build", bg: "#f6e1ff", border: "#a855f7", ink: "#581c87", pillBg: "#a855f7", pillInk: "#fff", emoji: "🎨" },
  utility: { slug: "utility", label: "Utility",      meaning: "Tools and helpers", bg: "#e2e8f0", border: "#64748b", ink: "#1f2937", pillBg: "#64748b", pillInk: "#fff", emoji: "🛠" },
  google:  { slug: "google",  label: "Google",       meaning: "Google Classroom, Drive, etc.", bg: "#fef3c7", border: "#eab308", ink: "#7c5e00", pillBg: "#eab308", pillInk: "#fff", emoji: "🅖" },
  video:   { slug: "video",   label: "Video",        meaning: "Educational videos", bg: "#ffe0f0", border: "#ec4899", ink: "#831843", pillBg: "#ec4899", pillInk: "#fff", emoji: "🎬" },
  game:    { slug: "game",    label: "Game",         meaning: "Learning games", bg: "#cffafe", border: "#06b6d4", ink: "#0c4a6e", pillBg: "#06b6d4", pillInk: "#fff", emoji: "🎮" },
};

const FALLBACK: SubjectTint = {
  slug: "default", label: "Other", meaning: "Other / mixed", bg: "#f5f5f4", border: "#a8a29e",
  ink: "#1f2937", pillBg: "#a8a29e", pillInk: "#fff", emoji: "📌",
};

export function subjectTint(slug?: string | null): SubjectTint {
  if (!slug) return FALLBACK;
  return PALETTE[slug.toLowerCase()] ?? FALLBACK;
}

/** Inline style helpers — apply to a card to fully tint it. */
export function tintCardStyle(slug?: string | null): React.CSSProperties {
  const t = subjectTint(slug);
  return {
    backgroundColor: t.bg,
    borderLeft: `4px solid ${t.border}`,
  };
}

export function tintInkStyle(slug?: string | null): React.CSSProperties {
  return { color: subjectTint(slug).ink };
}

export function tintPillStyle(slug?: string | null): React.CSSProperties {
  const t = subjectTint(slug);
  return { backgroundColor: t.pillBg, color: t.pillInk };
}

/** Visible subjects shown in the Color Key (skips aliases like "writing"). */
export const COLOR_KEY_SUBJECTS: SubjectTint[] = [
  PALETTE.math, PALETTE.ela, PALETTE.reading, PALETTE.science, PALETTE.ss,
  PALETTE.art, PALETTE.music, PALETTE.outdoors, PALETTE.snack, PALETTE.adventure,
  PALETTE.wonder, PALETTE.catch_up,
];

export const APP_CATEGORY_KEY: SubjectTint[] = [
  PALETTE.academic, PALETTE.creative, PALETTE.video, PALETTE.game, PALETTE.google, PALETTE.utility,
];
