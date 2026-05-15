/**
 * Wave-15 / Push 247 — kiwiVoiceSampleBlessings
 *
 * Pure deterministic helper. A small curated set of "blessed"
 * Kiwi replies that have been hand-written in the older-cousin
 * voice. The UI falls back to one of these when the LLM has been
 * drift-flagged twice in a row for the same panel — at that point
 * we stop trying to regenerate and just show a blessed canned
 * line, picked deterministically by panel + a rotation seed so
 * the same line doesn't repeat on consecutive uses.
 *
 * House-rule guarantees on every blessed line:
 *  - No exclamation marks
 *  - No emoji
 *  - No forbidden voice words (buddy, friend, pal, kiddo,
 *    sweetie, yay, woohoo, great job, awesome, amazing)
 *  - Sentence count <= 2 (fits both older_cousin and the tighter
 *    profiles)
 *  - Adult-tone substantive copy (no empty platitudes)
 */

export type KiwiBlessingPanel =
  | "today"
  | "kiwi"
  | "schedule"
  | "bookshelf"
  | "notebook"
  | "apps"
  | "feeling"
  | "stuck";

interface KiwiBlessingPool {
  panel: KiwiBlessingPanel;
  lines: string[];
}

const POOLS: KiwiBlessingPool[] = [
  {
    panel: "today",
    lines: [
      "Take a beat. The list will still be here in five minutes.",
      "Pick one thing on the list and start there. Skip what doesn't feel right.",
      "Today is just a list of options. None of it is graded.",
    ],
  },
  {
    panel: "kiwi",
    lines: [
      "I'm Kiwi. Ask me whatever you want, or close this and come back later.",
      "If something I say sounds off, tell Mom or Grandma. They can change how I talk.",
      "I won't pop up on my own. You're in charge of when we talk.",
    ],
  },
  {
    panel: "schedule",
    lines: [
      "If a time block doesn't work today, send a schedule request. Mom and Grandma both have to OK it.",
      "The schedule is a suggestion. Move things around if you need to.",
      "If you want to swap a subject, the request goes to both of them, not just one.",
    ],
  },
  {
    panel: "bookshelf",
    lines: [
      "Pick a book. Read until you want to stop.",
      "If the print version is easier today, use that. Same content.",
      "Reading log is optional. Skip it if it gets in the way.",
    ],
  },
  {
    panel: "notebook",
    lines: [
      "Write what you want to write. Spelling can come later.",
      "If you draw instead of writing today, that counts.",
      "Notebook stays here. No one reads it unless you show them.",
    ],
  },
  {
    panel: "apps",
    lines: [
      "Pick an app from the list. Close it whenever you want.",
      "If an app needs a password, ask Mom or Grandma to handle that part.",
      "No app on this page is required. They're all just tools.",
    ],
  },
  {
    panel: "feeling",
    lines: [
      "Tough days are normal. You can stop the dashboard whenever.",
      "If something is bothering you, tell Mom or Grandma. I'm not the right person for that.",
      "Take the rest of today off if you need to. Nothing here gets reported.",
    ],
  },
  {
    panel: "stuck",
    lines: [
      "Tell me which part is stuck. Specific is easier than general.",
      "If you've tried twice and it isn't clicking, set it aside. We can come back later.",
      "Stuck is information, not a problem. We work around it.",
    ],
  },
];

const POOL_BY_PANEL = new Map<KiwiBlessingPanel, KiwiBlessingPool>(
  POOLS.map((p) => [p.panel, p]),
);

/**
 * Pick a blessed line for the given panel. Rotation seed is any
 * non-negative integer (caller can pass a turn counter, a millisecond
 * timestamp, etc.); we modulo it against the pool length so the same
 * seed always picks the same line. Unknown panel falls back to the
 * "today" pool which has the safest general lines.
 */
export function pickKiwiBlessedLine(input: {
  panel: KiwiBlessingPanel | string | null | undefined;
  rotationSeed: number;
}): string {
  const panelKey =
    typeof input.panel === "string"
      ? (input.panel.trim().toLowerCase() as KiwiBlessingPanel)
      : ("today" as KiwiBlessingPanel);
  const pool = POOL_BY_PANEL.get(panelKey) ?? POOL_BY_PANEL.get("today")!;
  const lines = pool.lines;
  const seed =
    Number.isFinite(input.rotationSeed) && input.rotationSeed >= 0
      ? Math.floor(input.rotationSeed)
      : 0;
  return lines[seed % lines.length];
}

/** Stable read-only list of all blessed lines for a panel. */
export function listKiwiBlessedLines(panel: KiwiBlessingPanel): readonly string[] {
  const pool = POOL_BY_PANEL.get(panel);
  return pool ? [...pool.lines] : [];
}

/** All known blessing panel ids. */
export function listKiwiBlessingPanels(): readonly KiwiBlessingPanel[] {
  return POOLS.map((p) => p.panel);
}
