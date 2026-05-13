/**
 * Push 67 (2026-05-13) — Slice 4 per-type block generators.
 *
 * Pure functions that produce *operable + printable* block payloads for
 * the three block types that have well-defined content recipes:
 *
 *   - reading  → page-numbered slice of one of Reagan's owned printed
 *                books (Tuck Everlasting, Michael's World, Spectrum
 *                Science Grade 5, 180 Days of Language Grade 5).
 *   - adventure → numbered step list + supply list + safety chip.
 *   - practice → primary drill + N deterministic backups drawn from
 *                PRACTICE_LIBRARY when Reagan needs a re-roll.
 *
 * No DB calls and no LLM calls — every input is explicit so the agenda
 * assembler, the nightly-PDF renderer, and vitests all draw from the
 * same source. Each generator returns:
 *
 *   {
 *     kind: "reading" | "adventure" | "practice",
 *     title: string,                 // short header for the schedule chip
 *     instructions: string[],        // numbered steps for the kid card
 *     printable: string,             // pre-formatted line for the nightly PDF
 *     operable: { url?: string; ... },  // one-click jump-in target
 *   }
 *
 * The shape is deliberately rectangular so downstream callers can treat
 * the three generators uniformly.
 */

import { PRACTICE_LIBRARY, type PracticeDrill, type PracticeSubject } from "./practiceLibrary";

export type BlockKind = "reading" | "adventure" | "practice";

export interface GeneratedBlock {
  kind: BlockKind;
  title: string;
  instructions: string[];
  printable: string;
  operable: { url?: string; supplyList?: string[] };
}

// ────────────────────────────────────────────────────────────────────────────
// 1) Reading block
// ────────────────────────────────────────────────────────────────────────────

export type OwnedBookSlug =
  | "tuck-everlasting"
  | "michaels-world"
  | "spectrum-science-5"
  | "180-days-language-5";

export interface OwnedBook {
  slug: OwnedBookSlug;
  title: string;
  totalPages: number | null;
  /** Workbook = numeric pages, novel = chapters. */
  unit: "page" | "chapter";
}

export const OWNED_BOOKS: Readonly<Record<OwnedBookSlug, OwnedBook>> = Object.freeze({
  "tuck-everlasting": { slug: "tuck-everlasting", title: "Tuck Everlasting", totalPages: 139, unit: "chapter" },
  "michaels-world": { slug: "michaels-world", title: "Michael's World", totalPages: null, unit: "chapter" },
  "spectrum-science-5": { slug: "spectrum-science-5", title: "Spectrum Science Grade 5", totalPages: 176, unit: "page" },
  "180-days-language-5": { slug: "180-days-language-5", title: "180 Days of Language Grade 5", totalPages: 208, unit: "page" },
});

export interface ReadingBlockInput {
  bookSlug: OwnedBookSlug;
  startPage: number; // 1-indexed
  pagesPerDay?: number; // default 2 for workbooks, 1 chapter for novels
}

export function buildReadingBlock(input: ReadingBlockInput): GeneratedBlock {
  const book = OWNED_BOOKS[input.bookSlug];
  if (!book) throw new Error(`unknown book slug: ${input.bookSlug}`);
  const span = input.pagesPerDay ?? (book.unit === "page" ? 2 : 1);
  const from = Math.max(1, Math.floor(input.startPage));
  const to = book.totalPages != null ? Math.min(book.totalPages, from + span - 1) : from + span - 1;
  const unitLabel = book.unit === "page" ? "pg." : "ch.";
  const range = span > 1 ? `${unitLabel}${from}–${to}` : `${unitLabel}${from}`;
  const title = `Read ${book.title} ${range}`;
  return {
    kind: "reading",
    title,
    instructions: [
      `Open your physical copy of "${book.title}".`,
      `Read ${range} carefully — out loud is fine.`,
      `When you finish, tap "Done" so Kiwi can mark it off.`,
    ],
    printable: `📖 ${book.title} · ${range}`,
    operable: {}, // physical book: no URL — operability = direct printable reference
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2) Adventure block
// ────────────────────────────────────────────────────────────────────────────

export type AdventureTheme =
  | "nature-scavenger"
  | "backyard-science"
  | "library-trip"
  | "art-from-trash"
  | "cooking-fractions"
  | "bird-watching";

export interface AdventureBlockInput {
  theme: AdventureTheme;
  durationMin?: number;
  outdoorOk?: boolean;
}

interface AdventureRecipe {
  title: string;
  steps: string[];
  supplies: string[];
  outdoor: boolean;
}

const ADVENTURE_RECIPES: Readonly<Record<AdventureTheme, AdventureRecipe>> = Object.freeze({
  "nature-scavenger": {
    title: "Nature scavenger hunt",
    steps: [
      "Grab the scavenger card from the kitchen drawer.",
      "Walk the back yard or driveway for 20 minutes.",
      "Check off everything you find — bonus point for a feather!",
      "Snap one picture of your favorite find to keep.",
    ],
    supplies: ["scavenger card", "pencil", "camera (or phone)"],
    outdoor: true,
  },
  "backyard-science": {
    title: "Backyard science experiment",
    steps: [
      "Pick a question from the Spectrum Science prompt list.",
      "Set up your supplies on the patio table.",
      "Run the test 3 times — record what changes.",
      "Draw the result in your science notebook.",
    ],
    supplies: ["Spectrum Science Grade 5", "notebook", "pencil", "household items per prompt"],
    outdoor: true,
  },
  "library-trip": {
    title: "Library trip",
    steps: [
      "Pick 3 new books at the library.",
      "Find one read-aloud, one fact book, one fun pick.",
      "Stamp them into the home shelf log.",
    ],
    supplies: ["library card", "tote bag", "home shelf log"],
    outdoor: false,
  },
  "art-from-trash": {
    title: "Art from trash",
    steps: [
      "Gather 5 'trash' items (cereal box, bottle cap, etc).",
      "Sketch a creature using all 5 as parts.",
      "Tape or glue together — name your creature.",
      "Photograph and add to the Proud Wall folder.",
    ],
    supplies: ["recycling bin", "tape", "scissors", "markers"],
    outdoor: false,
  },
  "cooking-fractions": {
    title: "Cooking fractions",
    steps: [
      "Pick a recipe from the kitchen binder.",
      "Halve OR double the recipe with Mom.",
      "Measure with proper fractions — say each one out loud.",
      "Plate one bite for Kiwi the budgie (no salt!).",
    ],
    supplies: ["recipe binder", "measuring cups", "kitchen scale"],
    outdoor: false,
  },
  "bird-watching": {
    title: "Bird watching",
    steps: [
      "Sit quietly on the back porch for 15 minutes.",
      "Tally each bird species you see.",
      "Sketch the most interesting one.",
      "Compare your tally to the Audubon week chart.",
    ],
    supplies: ["binoculars (optional)", "field notebook", "pencil"],
    outdoor: true,
  },
});

export function buildAdventureBlock(input: AdventureBlockInput): GeneratedBlock {
  const recipe = ADVENTURE_RECIPES[input.theme];
  if (!recipe) throw new Error(`unknown adventure theme: ${input.theme}`);
  const duration = Math.max(10, Math.floor(input.durationMin ?? 30));
  const numberedSteps = recipe.steps.map((s, i) => `${i + 1}. ${s}`);
  const outdoorAllowed = input.outdoorOk !== false;
  const safety = recipe.outdoor && !outdoorAllowed
    ? "⚠️ Indoor-only today — skip outside steps."
    : recipe.outdoor
      ? "🌳 Outside OK — wear sunscreen + hat."
      : "🏠 Indoor activity.";
  return {
    kind: "adventure",
    title: `${recipe.title} (${duration} min)`,
    instructions: [safety, ...numberedSteps],
    printable: `🌟 ${recipe.title} · ${duration} min · supplies: ${recipe.supplies.join(", ")}`,
    operable: { supplyList: [...recipe.supplies] },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3) Practice block (+ backup pool)
// ────────────────────────────────────────────────────────────────────────────

/** Tiny deterministic FNV-1a hash → integer (matches summerMode.ts style). */
function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface PracticeBlockInput {
  subject: PracticeSubject;
  primaryDrillSlug?: string; // if omitted we pick a deterministic one
  backupSize?: number;       // default 3
  seed?: string;             // for deterministic backups
}

export interface PracticeBlockOutput extends GeneratedBlock {
  primary: PracticeDrill;
  backups: PracticeDrill[];
}

export function buildPracticeBlock(input: PracticeBlockInput): PracticeBlockOutput {
  const subjectPool = PRACTICE_LIBRARY.filter((d) => d.subject === input.subject);
  if (subjectPool.length === 0) {
    throw new Error(`no practice drills found for subject: ${input.subject}`);
  }
  const seed = input.seed ?? `${input.subject}-default`;
  const offset = seedHash(seed) % subjectPool.length;
  // Rotate so the same seed always yields the same primary unless explicit.
  const rotated: PracticeDrill[] = [];
  for (let i = 0; i < subjectPool.length; i++) rotated.push(subjectPool[(i + offset) % subjectPool.length]);
  const primary =
    (input.primaryDrillSlug && subjectPool.find((d) => d.slug === input.primaryDrillSlug)) || rotated[0];
  const backupSize = Math.max(0, Math.min(input.backupSize ?? 3, Math.max(0, subjectPool.length - 1)));
  const backups = rotated.filter((d) => d.slug !== primary.slug).slice(0, backupSize);
  return {
    kind: "practice",
    title: `Practice: ${primary.title}`,
    instructions: [
      `Open: ${primary.provider} — ${primary.title}.`,
      primary.blurb,
      `Earn ${primary.coins} Kiwi Coins when you tap "Done".`,
      backups.length > 0 ? `If you want a different one, ${backups.length} backups are queued.` : "",
    ].filter((s) => s.length > 0),
    printable: `🎯 ${primary.title} (${primary.provider}, ~${primary.minutes}m, ${primary.coins} coins)`,
    operable: { url: primary.url },
    primary,
    backups,
  };
}
