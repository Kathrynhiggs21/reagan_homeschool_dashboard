/**
 * Wave-15 / Push 202 — todayHeroStripBuilder
 * PURE deterministic helper. Composes the kid-facing "hero strip"
 * shown at the top of the Today page.
 */

export interface HeroChip {
  kind: "app" | "badge" | "book" | "doodle";
  label: string;
  hint?: string;
  appKey?: string;
  badgeId?: string;
}

export interface HeroStrip {
  headline: string;
  sub?: string;
  chips: HeroChip[];
  pillar: "feel_safe" | "understand" | "grow_on_purpose" | "you_are_smart";
  source: "default" | "screen_time_wrap" | "great_day" | "book_finished";
}

export interface HeroInput {
  praiseHeadline: string;
  praisePillar: "feel_safe" | "understand" | "grow_on_purpose" | "you_are_smart";
  praiseContext?: "default" | "screen_time_wrap" | "great_day" | "book_finished";
  appChips: ReadonlyArray<{ appKey: string; label: string; hint?: string }>;
  recentBadge?: { id: string; label: string };
  recentBook?: { title: string };
  recentDoodle?: { promptLabel: string };
  kidEmail?: string;
  overrideHeadline?: string;
  sub?: string;
}

const BLOCKED_EMAIL = "reagan.higgs33@ihsd.us";
const MAX_CHIPS = 4;

export function buildTodayHeroStrip(input: HeroInput): HeroStrip {
  const headline = (input.overrideHeadline ?? input.praiseHeadline).trim();
  const safeHeadline = headline.length > 0 ? headline : "Welcome back, friend.";

  const chips: HeroChip[] = [];

  if (input.recentBadge && chips.length < MAX_CHIPS) {
    chips.push({
      kind: "badge",
      badgeId: input.recentBadge.id,
      label: input.recentBadge.label,
    });
  }
  if (input.recentBook && chips.length < MAX_CHIPS) {
    chips.push({ kind: "book", label: input.recentBook.title });
  }
  if (input.recentDoodle && chips.length < MAX_CHIPS) {
    chips.push({ kind: "doodle", label: input.recentDoodle.promptLabel });
  }

  const seen = new Set<string>();
  for (const a of input.appChips ?? []) {
    if (chips.length >= MAX_CHIPS) break;
    if (!a.appKey || !a.label) continue;
    if (seen.has(a.appKey)) continue;
    seen.add(a.appKey);
    if (input.kidEmail && input.kidEmail.toLowerCase() === BLOCKED_EMAIL) {
      continue;
    }
    chips.push({ kind: "app", appKey: a.appKey, label: a.label, hint: a.hint });
  }

  return {
    headline: safeHeadline,
    sub: input.sub,
    chips,
    pillar: input.praisePillar,
    source: input.praiseContext ?? "default",
  };
}

export const __FOR_TEST__ = { BLOCKED_EMAIL, MAX_CHIPS };
