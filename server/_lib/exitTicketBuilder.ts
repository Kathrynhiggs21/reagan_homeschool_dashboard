/**
 * Push 175 (2026-05-15 Wave-12) — End-of-day exit ticket builder.
 *
 * The "exit ticket" is the kid-readable wind-down at the end of each
 * homeschool day. Three short prompts (under 8 words each), each with a
 * tap-to-pick option set so Reagan can answer without typing.
 *
 * STRICT RULES (enforced by vitest):
 *   - Exactly 3 prompts in the order: mood → favorite → ask-for-tomorrow.
 *   - Every prompt has 2-4 options; every option fits on a phone tap.
 *   - Prompt text is Reagan-readable (no jargon, no "rate", no "scale",
 *     no "evaluate", no clinical mood words like "anxious", no
 *     "mindfulness", no "self-assessment").
 *   - Mood prompt always offers exactly the same 4 mood-band tap options:
 *     "great", "okay", "tired", "frustrated".
 *   - Favorite prompt options are pulled from the actual blocks in the
 *     day (no fake choices); if no blocks, falls back to a generic
 *     "today" option list.
 *   - Tomorrow-ask prompt is open-ended kid-readable; offers 3-4 quick
 *     pickers ("more outside", "more art", "more games", "more reading")
 *     plus an implicit free-text mode (signaled in the payload).
 *   - Deterministic per ISO + name (so refresh shows the same ticket).
 *   - All output is plain JSON; no formatting tags.
 */

const MOOD_OPTIONS = ["great", "okay", "tired", "frustrated"] as const;

const FALLBACK_FAVORITES = [
  "today felt good",
  "today was just okay",
  "today was tough",
] as const;

const TOMORROW_QUICK = [
  "more outside",
  "more art",
  "more games",
  "more reading",
] as const;

export type MoodOption = (typeof MOOD_OPTIONS)[number];

export interface ExitTicketBlock {
  blockId: string;
  /** What Reagan saw on the schedule (kid-readable). */
  label: string;
  /** Did the block actually run? Skipped blocks are excluded. */
  ran: boolean;
}

export interface ExitTicketInput {
  iso: string; // YYYY-MM-DD
  name: string; // Reagan
  blocks: ExitTicketBlock[];
}

export interface ExitTicketPrompt {
  promptId: "mood" | "favorite" | "tomorrow";
  /** Kid-readable question. */
  question: string;
  /** Tap-to-pick options. Always 2-4 entries. */
  options: { value: string; label: string }[];
  /** True if the kid may also type a free-text reply. */
  allowFreeText: boolean;
}

export interface ExitTicket {
  iso: string;
  name: string;
  prompts: ExitTicketPrompt[];
}

// FNV-1a 32-bit, deterministic across platforms.
function hash32(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pickN<T>(arr: readonly T[], n: number, seedStr: string): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  if (n >= arr.length) return arr.slice() as T[];
  let h = hash32(seedStr);
  let safety = 0;
  while (out.length < n && safety < 100) {
    safety++;
    const idx = h % arr.length;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(arr[idx]);
    }
    // advance hash (xorshift-style)
    h = ((h * 1664525) + 1013904223) >>> 0;
  }
  return out;
}

export function buildExitTicket(input: ExitTicketInput): ExitTicket {
  const { iso, name, blocks } = input;
  const seed = `${iso}|${name}`;

  // 1) Mood prompt — ALWAYS the same 4 tap options.
  const mood: ExitTicketPrompt = {
    promptId: "mood",
    question: "How do you feel right now?",
    options: MOOD_OPTIONS.map((m) => ({ value: m, label: m })),
    allowFreeText: false,
  };

  // 2) Favorite prompt — built from blocks that actually ran.
  const ranBlocks = blocks.filter((b) => b.ran);
  let favoriteOptions: { value: string; label: string }[];
  if (ranBlocks.length === 0) {
    favoriteOptions = FALLBACK_FAVORITES.map((f) => ({ value: f, label: f }));
  } else if (ranBlocks.length <= 4) {
    favoriteOptions = ranBlocks.map((b) => ({
      value: b.blockId,
      label: b.label,
    }));
  } else {
    // Pick 4 deterministically per ISO.
    const picked = pickN(ranBlocks, 4, `${seed}|fav`);
    favoriteOptions = picked.map((b) => ({
      value: b.blockId,
      label: b.label,
    }));
  }
  // Always offer "all of it" as the final option when 2+ ran blocks.
  if (ranBlocks.length >= 2 && favoriteOptions.length < 4) {
    favoriteOptions.push({ value: "all", label: "all of it" });
  }
  // Cap at 4.
  favoriteOptions = favoriteOptions.slice(0, 4);

  const favorite: ExitTicketPrompt = {
    promptId: "favorite",
    question: "What was your favorite part?",
    options: favoriteOptions,
    allowFreeText: true,
  };

  // 3) Tomorrow ask — fixed quick-picks + free text.
  const tomorrow: ExitTicketPrompt = {
    promptId: "tomorrow",
    question: "What do you want more of tomorrow?",
    options: TOMORROW_QUICK.map((t) => ({ value: t, label: t })),
    allowFreeText: true,
  };

  return {
    iso,
    name,
    prompts: [mood, favorite, tomorrow],
  };
}
