/**
 * Wave-15 / Push 210 — adventureLibrarySuggester
 *
 * Pure deterministic helper. Given an indexed Adventure Library
 * (already loaded upstream) + Reagan's recent adventure history,
 * returns three suggested Adventures of the Day for the homepage.
 *
 * Reagan's project description names the bias explicitly:
 *   "Adventure Library indexed by 5th-grade topic, weighted toward
 *    birds, animals, plants, water, swimming, and outdoors."
 *
 * So this picker:
 *   1. Filters by gradeLevel match (default 5).
 *   2. Boosts entries whose tags overlap her preferred-tag pool.
 *   3. Penalizes (does NOT block) entries she did in the last 14 days.
 *   4. Returns 3 deterministic suggestions: a primary + 2 alternates.
 *
 * House rules baked in:
 *   - Non-punitive: never says she "needs" or "should" do anything.
 *     Calm voice. The kidLine just describes the adventure.
 *   - Never imposes: the helper returns suggestions; the UI lets her
 *     pick or ask Kiwi for something else.
 *   - Voice rules: no "buddy / friend / yay / great job".
 *   - Deterministic tie-break order: by score desc, then by id asc,
 *     so the same inputs always produce the same suggestions.
 */

export interface AdventureLibraryEntry {
  id: number;
  title: string;
  shortDescription: string;
  gradeLevel: number; // 1..12
  tags: string[];
  outdoor: boolean;
  estimatedMinutes?: number | null;
}

export interface AdventureHistoryEntry {
  adventureId: number;
  isoDate: string; // YYYY-MM-DD
}

export interface AdventureSuggestion {
  id: number;
  title: string;
  kidLine: string;
  tags: string[];
  outdoor: boolean;
  estimatedMinutes: number | null;
  reason: "preferred_tag" | "outdoor_bonus" | "grade_default" | "fallback";
}

export interface AdventureLibrarySuggestionResult {
  primary: AdventureSuggestion | null;
  alternates: AdventureSuggestion[];
  totalCandidates: number;
  emptyLibrary: boolean;
}

/**
 * Reagan's preferred tags (per project description + Kiwi prompt).
 * Order in this list is irrelevant — what matters is membership.
 */
const PREFERRED_TAGS = new Set<string>([
  "birds",
  "bird",
  "animals",
  "animal",
  "wildlife",
  "plants",
  "plant",
  "botany",
  "water",
  "creek",
  "river",
  "lake",
  "swimming",
  "swim",
  "outdoors",
  "outdoor",
  "hiking",
  "nature",
]);

const RECENT_WINDOW_DAYS = 14;

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T12:00:00`);
  const b = Date.parse(`${bIso}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((a - b) / 86400000));
}

function scoreEntry(
  entry: AdventureLibraryEntry,
  recentIds: Set<number>,
  targetGrade: number,
): { score: number; reason: AdventureSuggestion["reason"] } {
  let score = 0;
  let reason: AdventureSuggestion["reason"] = "grade_default";

  // Grade match anchor.
  if (entry.gradeLevel === targetGrade) score += 10;
  else if (Math.abs(entry.gradeLevel - targetGrade) === 1) score += 4;
  else score += 1;

  // Preferred tag boost — multi-tag stacking allowed but capped.
  const tagHits = entry.tags.filter((t) => PREFERRED_TAGS.has(t.toLowerCase()));
  if (tagHits.length > 0) {
    score += Math.min(tagHits.length, 3) * 7;
    reason = "preferred_tag";
  }

  // Outdoor bonus — Reagan's profile explicitly favors outdoors.
  if (entry.outdoor) {
    score += 4;
    if (reason === "grade_default") reason = "outdoor_bonus";
  }

  // Recent-history penalty (not a block — she can still pick it again).
  if (recentIds.has(entry.id)) score -= 6;

  return { score, reason };
}

function makeKidLine(entry: AdventureLibraryEntry): string {
  // Calm, short, descriptive — no exclamation marks, no flattery.
  const base = entry.shortDescription.trim();
  if (base.length === 0) return entry.title;
  // Strip trailing exclamation marks from upstream copy if any slipped in.
  return base.replace(/!+(\s|$)/g, ".$1");
}

export function suggestAdventures(input: {
  library: AdventureLibraryEntry[];
  history?: AdventureHistoryEntry[];
  todayIso: string;
  targetGrade?: number;
}): AdventureLibrarySuggestionResult {
  const library = Array.isArray(input.library) ? input.library : [];
  const history = Array.isArray(input.history) ? input.history : [];
  const targetGrade = input.targetGrade ?? 5;

  if (library.length === 0) {
    return {
      primary: null,
      alternates: [],
      totalCandidates: 0,
      emptyLibrary: true,
    };
  }

  // Build set of adventure IDs Reagan did in the recent window.
  const recentIds = new Set<number>();
  for (const h of history) {
    if (daysBetween(h.isoDate, input.todayIso) <= RECENT_WINDOW_DAYS) {
      recentIds.add(h.adventureId);
    }
  }

  const scored = library.map((entry) => ({
    entry,
    ...scoreEntry(entry, recentIds, targetGrade),
  }));

  // Deterministic sort: score desc, then id asc.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.id - b.entry.id;
  });

  const top3 = scored.slice(0, 3);
  const toSuggestion = (s: (typeof scored)[number]): AdventureSuggestion => ({
    id: s.entry.id,
    title: s.entry.title,
    kidLine: makeKidLine(s.entry),
    tags: [...s.entry.tags],
    outdoor: s.entry.outdoor,
    estimatedMinutes: s.entry.estimatedMinutes ?? null,
    reason: s.reason,
  });

  const primary = top3[0] ? toSuggestion(top3[0]) : null;
  const alternates = top3.slice(1).map(toSuggestion);

  // If primary scored very low (no overlap whatsoever), mark as fallback.
  if (primary && top3[0].score < 5) {
    primary.reason = "fallback";
  }

  return {
    primary,
    alternates,
    totalCandidates: library.length,
    emptyLibrary: false,
  };
}
