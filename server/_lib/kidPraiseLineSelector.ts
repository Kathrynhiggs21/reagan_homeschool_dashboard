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
    { text: "{name}, you finished a whole book — your brain just grew!", pillar: "grow_on_purpose" },
    { text: "Another one for the shelf, {name}. Look at you go.", pillar: "you_are_smart" },
    { text: "Books make you smart in a way that lasts forever, {name}.", pillar: "you_are_smart" },
    { text: "{name}, that's a finished book. That counts a LOT.", pillar: "grow_on_purpose" },
  ],
  chapter_book_finished: [
    { text: "{name} — a CHAPTER book. Big-kid level, unlocked.", pillar: "grow_on_purpose" },
    { text: "Chapter books grow your brain in a special way. Nice work, {name}.", pillar: "you_are_smart" },
    { text: "All those pages, finished by you. That's not nothing, {name}.", pillar: "grow_on_purpose" },
  ],
  reading_streak: [
    { text: "Days in a row of reading, {name}. That's a habit forming.", pillar: "grow_on_purpose" },
    { text: "Streaks are how readers are made. You're making one, {name}.", pillar: "you_are_smart" },
    { text: "{name}, your streak says you LIKE this. That matters.", pillar: "feel_safe" },
  ],
  lesson_done: [
    { text: "{name}, you finished it. Effort always counts.", pillar: "grow_on_purpose" },
    { text: "One lesson, all the way through. Nice work, {name}.", pillar: "grow_on_purpose" },
    { text: "Your brain stretched a little today, {name}. That's good.", pillar: "you_are_smart" },
  ],
  doodle_saved: [
    { text: "Your doodle is saved, {name}. The world has more art now.", pillar: "feel_safe" },
    { text: "Made by you, kept by you, {name}. Nobody else makes things this way.", pillar: "you_are_smart" },
    { text: "{name}, that doodle is yours forever. Promise.", pillar: "feel_safe" },
  ],
  vault_healthy: [
    { text: "{name}, all your sign-ins are healthy today. Smooth.", pillar: "feel_safe" },
    { text: "Nothing to worry about, {name}. Grown-ups got it.", pillar: "feel_safe" },
    { text: "All good on the password side, {name}. Keep going.", pillar: "feel_safe" },
  ],
  screen_time_wrap: [
    { text: "{name}, nice focus today. That's a real skill.", pillar: "grow_on_purpose" },
    { text: "Want to stretch a bit, {name}? Screens love a little break.", pillar: "feel_safe" },
    { text: "You used your time on purpose today, {name}. That's the win.", pillar: "grow_on_purpose" },
  ],
  app_login_success: [
    { text: "{name}, you got in! Logging in counts as a tiny win.", pillar: "grow_on_purpose" },
    { text: "Nice — signed in and ready, {name}.", pillar: "feel_safe" },
    { text: "All set, {name}. Have fun.", pillar: "feel_safe" },
  ],
  mood_pulse_positive: [
    { text: "Glad it's a good one today, {name}. Your feelings are real.", pillar: "feel_safe" },
    { text: "{name}, your mood matters. Always.", pillar: "feel_safe" },
    { text: "Feeling good is a fact too, {name}. Keep noticing.", pillar: "understand" },
  ],
  great_day: [
    { text: "{name}, today was a strong one. Effort + heart, both.", pillar: "grow_on_purpose" },
    { text: "Great day, {name}. Brain + body + heart all showed up.", pillar: "you_are_smart" },
    { text: "You showed up today, {name}. That's the whole game.", pillar: "feel_safe" },
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
