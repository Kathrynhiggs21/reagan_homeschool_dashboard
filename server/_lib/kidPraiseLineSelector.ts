/**
 * Wave-15 / Push 200 — kidPraiseLineSelector
 *
 * PURE deterministic helper. Picks ONE kid-readable praise line
 * for a given context + seed. Same (context+seed) ⇒ same line so
 * Today re-renders don't flicker.
 */

export type PraiseContext =
  | "book_finished"
  | "chapter_book_finished"
  | "reading_streak"
  | "lesson_done"
  | "doodle_saved"
  | "vault_healthy"
  | "screen_time_wrap"
  | "app_login_success"
  | "mood_pulse_positive"
  | "great_day";

export interface PraiseInput {
  context: PraiseContext;
  seed: string;
  kidName?: string;
}

export interface PraiseLine {
  text: string;
  pillar: "feel_safe" | "understand" | "grow_on_purpose" | "you_are_smart";
}

const POOLS: Record<PraiseContext, PraiseLine[]> = {
  book_finished: [
    { text: "{name}, that's a finished book.", pillar: "grow_on_purpose" },
    { text: "Another one for the shelf, {name}.", pillar: "you_are_smart" },
    { text: "Book done, {name}.", pillar: "you_are_smart" },
    { text: "Finished. That counts, {name}.", pillar: "grow_on_purpose" },
  ],
  chapter_book_finished: [
    { text: "Chapter book, finished. That's a real one, {name}.", pillar: "grow_on_purpose" },
    { text: "Chapter book done, {name}.", pillar: "you_are_smart" },
    { text: "All those pages. You read them, {name}.", pillar: "grow_on_purpose" },
  ],
  reading_streak: [
    { text: "Days in a row of reading, {name}. That's a habit.", pillar: "grow_on_purpose" },
    { text: "Streak's still going, {name}.", pillar: "you_are_smart" },
    { text: "You kept reading, {name}.", pillar: "feel_safe" },
  ],
  lesson_done: [
    { text: "Finished it, {name}.", pillar: "grow_on_purpose" },
    { text: "One lesson, all the way through, {name}.", pillar: "grow_on_purpose" },
    { text: "Done with that one, {name}.", pillar: "you_are_smart" },
  ],
  doodle_saved: [
    { text: "Doodle saved, {name}.", pillar: "feel_safe" },
    { text: "Made by you, kept by you, {name}.", pillar: "you_are_smart" },
    { text: "That one's yours, {name}.", pillar: "feel_safe" },
  ],
  vault_healthy: [
    { text: "Sign-ins are all good, {name}.", pillar: "feel_safe" },
    { text: "Nothing for you to worry about today, {name}.", pillar: "feel_safe" },
    { text: "Passwords are handled, {name}.", pillar: "feel_safe" },
  ],
  screen_time_wrap: [
    { text: "Good focus today, {name}.", pillar: "grow_on_purpose" },
    { text: "Stretch when you want, {name}.", pillar: "feel_safe" },
    { text: "You used your time on purpose, {name}.", pillar: "grow_on_purpose" },
  ],
  app_login_success: [
    { text: "You're in, {name}.", pillar: "grow_on_purpose" },
    { text: "Signed in, {name}.", pillar: "feel_safe" },
    { text: "All set, {name}.", pillar: "feel_safe" },
  ],
  mood_pulse_positive: [
    { text: "Good day, then. Logged, {name}.", pillar: "feel_safe" },
    { text: "Noted, {name}.", pillar: "feel_safe" },
    { text: "Feeling good counts too, {name}.", pillar: "understand" },
  ],
  great_day: [
    { text: "Strong day, {name}.", pillar: "grow_on_purpose" },
    { text: "You showed up today, {name}.", pillar: "you_are_smart" },
    { text: "That was a real one, {name}.", pillar: "feel_safe" },
  ],
};

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const FORBIDDEN = [
  "fail", "wrong", "dumb", "lazy", "behind", "not enough",
  "stupid", "loser", "gave up", "should have",
];

export function selectPraiseLine(input: PraiseInput): PraiseLine {
  const pool = POOLS[input.context];
  if (!pool || pool.length === 0) {
    return {
      text: `${input.kidName ?? "Reagan"}, you showed up. That counts.`,
      pillar: "feel_safe",
    };
  }
  const idx = hashSeed(`${input.context}:${input.seed}`) % pool.length;
  const chosen = pool[idx];
  const name = input.kidName ?? "Reagan";
  const text = chosen.text.replace(/{name}/g, name);
  return { text, pillar: chosen.pillar };
}

export function isLineSafe(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN.some((w) => lower.includes(w));
}

export const __FOR_TEST__ = { POOLS, FORBIDDEN, hashSeed };
