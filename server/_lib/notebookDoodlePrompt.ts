/**
 * Push 178 (2026-05-14, Wave-13) — Notebook Doodle prompt-of-the-day.
 *
 * Pure helper. Picks one drawing/doodle/free-write prompt for Reagan for
 * the given school day. Deterministic per ISO + kid name so a refresh shows
 * the same prompt. Reagan-readable: short, one sentence, never timed,
 * never "warm-up", never asks her to perform.
 *
 * Variety rule: each prompt has a category, and we never serve the same
 * category two days in a row when avoidCategoriesYesterday is provided.
 *
 * Anti-pressure rule: every prompt is opt-in by phrasing ("if you want, ..."
 * or "try ..."). No deadlines, no minimum word counts, no grading.
 */

export type DoodleCategory =
  | "draw"
  | "label"
  | "list"
  | "imagine"
  | "kindness"
  | "outside"
  | "silly";

export interface DoodlePrompt {
  /** Stable id for analytics + the don't-repeat rule. */
  id: string;
  category: DoodleCategory;
  /** One sentence, kid-readable, opt-in phrasing. */
  text: string;
}

export interface NotebookDoodlePromptInput {
  dateISO: string;
  kidName?: string;
  /** Yesterday's prompt id, used for the "no repeats day to day" rule. */
  yesterdayPromptId?: string | null;
  /** Yesterday's category, used for the variety rule. */
  yesterdayCategory?: DoodleCategory | null;
  /**
   * Optional pool override (test injection). When omitted, the canonical
   * pool below is used.
   */
  pool?: DoodlePrompt[];
}

export interface NotebookDoodlePromptResult {
  prompt: DoodlePrompt;
  /** "kid-line" the Today/Notebook page can show as the heading. */
  kidLine: string;
}

/* ----------------------------------------------------------------------- */
/* Canonical pool (kid-readable, opt-in, never timed).                     */
/* ----------------------------------------------------------------------- */

export const CANONICAL_DOODLE_POOL: ReadonlyArray<DoodlePrompt> = [
  // draw
  {
    id: "d-bird-from-window",
    category: "draw",
    text: "If you want, draw a bird you saw from the window.",
  },
  {
    id: "d-cloud-shape",
    category: "draw",
    text: "Try drawing a cloud and what it kind of looks like to you.",
  },
  {
    id: "d-favorite-snack",
    category: "draw",
    text: "Draw your favorite snack from this week.",
  },
  {
    id: "d-pet-as-superhero",
    category: "draw",
    text: "If you want, draw a pet (real or pretend) as a superhero.",
  },
  {
    id: "d-self-portrait-mood",
    category: "draw",
    text: "Try a quick self-portrait that shows how you feel today.",
  },

  // label
  {
    id: "l-room-three-things",
    category: "label",
    text: "Pick 3 things in your room and label them in your notebook.",
  },
  {
    id: "l-plant-parts",
    category: "label",
    text: "Sketch a plant from outside and label its parts.",
  },
  {
    id: "l-favorite-book-cover",
    category: "label",
    text: "Draw the cover of a favorite book and label one part you love.",
  },

  // list
  {
    id: "li-five-favorite-words",
    category: "list",
    text: "Write down 5 favorite words. Doodle next to one of them.",
  },
  {
    id: "li-things-i-want-to-learn",
    category: "list",
    text: "List 3 things you want to learn about someday.",
  },
  {
    id: "li-things-that-made-me-smile",
    category: "list",
    text: "List things from this week that made you smile.",
  },

  // imagine
  {
    id: "im-animal-school",
    category: "imagine",
    text: "Imagine a school for animals. Draw the lunchroom.",
  },
  {
    id: "im-time-machine-day",
    category: "imagine",
    text: "If you had a time machine for one day, where would you go? Doodle it.",
  },
  {
    id: "im-tiny-door-in-tree",
    category: "imagine",
    text: "Draw a tiny door in a tree. Who lives behind it?",
  },
  {
    id: "im-floating-house",
    category: "imagine",
    text: "Imagine a house that floats. What keeps it up?",
  },

  // kindness
  {
    id: "k-thank-you-doodle",
    category: "kindness",
    text: "Doodle a tiny thank-you for someone in your house.",
  },
  {
    id: "k-card-for-friend",
    category: "kindness",
    text: "Make a quick card for someone you love. No words needed.",
  },

  // outside
  {
    id: "o-leaf-rubbing",
    category: "outside",
    text: "If you go outside today, try a leaf rubbing in your notebook.",
  },
  {
    id: "o-sky-color-now",
    category: "outside",
    text: "Look at the sky. Color in your notebook the color you see.",
  },
  {
    id: "o-three-sounds",
    category: "outside",
    text: "Step outside for a sec and write down 3 sounds you hear.",
  },

  // silly
  {
    id: "s-spaghetti-hat",
    category: "silly",
    text: "Draw yourself wearing a hat made of spaghetti. Yes, really.",
  },
  {
    id: "s-cat-with-job",
    category: "silly",
    text: "Give a cat a job. Doodle the cat at work.",
  },
  {
    id: "s-pizza-planet",
    category: "silly",
    text: "Draw a planet that's made of pizza. Add at least one moon.",
  },
];

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function isValidISO(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/* ----------------------------------------------------------------------- */
/* Main                                                                     */
/* ----------------------------------------------------------------------- */

export function pickNotebookDoodlePrompt(
  input: NotebookDoodlePromptInput,
): NotebookDoodlePromptResult {
  if (!isValidISO(input.dateISO)) {
    throw new Error(
      `[notebookDoodlePrompt] dateISO must be YYYY-MM-DD; got ${String(input.dateISO)}`,
    );
  }
  const pool =
    input.pool && input.pool.length > 0
      ? input.pool.slice()
      : CANONICAL_DOODLE_POOL.slice();

  const seedKey = `${input.dateISO}|${(input.kidName ?? "kid").toLowerCase().trim()}`;
  const seed = fnv1a(seedKey);

  // Filter: never serve yesterday's exact prompt.
  let candidates = pool.filter((p) => p.id !== input.yesterdayPromptId);
  // Variety: try to also avoid yesterday's category when we have enough left.
  if (input.yesterdayCategory) {
    const filtered = candidates.filter(
      (p) => p.category !== input.yesterdayCategory,
    );
    if (filtered.length > 0) candidates = filtered;
  }
  // Final safety — if filters wiped everything, fall back to the full pool.
  if (candidates.length === 0) candidates = pool.slice();

  // Stable order by id so the seed indexes deterministically.
  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const idx = seed % candidates.length;
  const prompt = candidates[idx]!;

  const kidLine = prompt.text;
  return { prompt, kidLine };
}
