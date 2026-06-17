/**
 * 2026-06-16 — Shared types for FULL interactive worksheet content.
 *
 * A worksheet is real, workable content (problems, passages, prompts) that
 * Reagan fills in ONLINE — not a to-do list or a link. The same structure
 * renders both the in-app fill-in page and the full printable PDF.
 *
 * Kept in `shared/` so the server generator, the client runner, and the
 * server PDF renderer all agree on one shape (and so vitest under server/**
 * can import it).
 */

export type WorksheetItemKind =
  | "short" // short-answer line (a word / number / phrase)
  | "long" // multi-line written answer
  | "mc" // multiple choice (pick one of `choices`)
  | "passage" // a reading passage to display (no answer field)
  | "prompt" // a writing prompt with `lines` of space
  | "matching" // two-column "draw a line" matching (left `pairs[].left`, right shuffled)
  | "scramble" // unscramble letters -> blank answer line (`prompt` holds the scrambled letters)
  | "fillblank"; // fill-in-the-blank sentence; blanks marked with "____" in `prompt`

/** A single left/right pair for a matching item. */
export type MatchPair = { left: string; right: string };

export type WorksheetItem = {
  /** stable id within the worksheet, e.g. "q1" */
  id: string;
  kind: WorksheetItemKind;
  /** the question / passage text / prompt shown to Reagan */
  prompt: string;
  /** for kind="mc": the answer options */
  choices?: string[];
  /** for kind="long"/"prompt": how many writing lines to show (default 3) */
  lines?: number;
  /** for kind="matching": the correct left->right pairs (right column is shuffled for display) */
  pairs?: MatchPair[];
  /** optional teacher answer key (never shown to Reagan; used for grading/PDF key) */
  answer?: string;
};

export type WorksheetSection = {
  heading?: string;
  /** short kid-friendly instructions for this section */
  instructions?: string;
  /** optional WORD BANK words rendered in a boxed list above the items */
  wordBank?: string[];
  items: WorksheetItem[];
};

export type WorksheetContent = {
  /** worksheet title (usually the block title) */
  title: string;
  /** 1-2 sentence kid-friendly intro / what we're learning */
  intro?: string;
  /** the subject slug this belongs to */
  subjectSlug?: string | null;
  /** owned-book page reference if this maps to a physical book */
  bookRef?: string | null;
  sections: WorksheetSection[];
};

/** True if the value is a usable, non-empty worksheet. */
export function isUsableWorksheet(w: unknown): w is WorksheetContent {
  if (!w || typeof w !== "object") return false;
  const c = w as WorksheetContent;
  if (!Array.isArray(c.sections) || c.sections.length === 0) return false;
  const totalItems = c.sections.reduce(
    (n, s) => n + (Array.isArray(s.items) ? s.items.length : 0),
    0,
  );
  return totalItems > 0;
}

/** Count answerable (non-passage) items. */
export function countAnswerable(w: WorksheetContent): number {
  return w.sections.reduce(
    (n, s) => n + s.items.filter((i) => i.kind !== "passage").length,
    0,
  );
}
