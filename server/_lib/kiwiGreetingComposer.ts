/**
 * Wave-15 / Push 277 — kiwiGreetingComposer
 *
 * Deterministic one-liner greeting for Kiwi's first appearance
 * per panel per day. Calm, older-cousin voice — never chirpy,
 * never uses Reagan's name in salutation form, never uses pet
 * names, never exclamation marks.
 *
 * Time-of-day buckets (local time):
 *   • morning:   05:00 – 11:59
 *   • afternoon: 12:00 – 16:59
 *   • evening:   17:00 – 20:59
 *   • night:     21:00 – 04:59
 *
 * Each panel × bucket has a small pool; selection is
 * deterministic via (panel + bucket + dayIndex) so the
 * greeting is stable for the day but rotates across days.
 *
 * Pure: no I/O, no clock — localHour and dayIndex are inputs.
 */

const FORBIDDEN_RE =
  /\b(buddy|friend|pal|kiddo|sweetie|sweetheart|champ|hey there|good job|great job|awesome|amazing|woohoo|yay)\b/i;

export type KiwiGreetingPanel =
  | "today"
  | "kiwi"
  | "schedule"
  | "bookshelf"
  | "notebook"
  | "stuck"
  | "feeling"
  | "apps";

export type KiwiGreetingBucket = "morning" | "afternoon" | "evening" | "night";

export interface KiwiGreetingInput {
  panel: KiwiGreetingPanel | string;
  localHour: number;
  dayIndex: number;
}

export interface KiwiGreetingResult {
  greeting: string;
  bucket: KiwiGreetingBucket;
  panel: KiwiGreetingPanel;
}

function pickBucket(hour: number): KiwiGreetingBucket {
  if (!Number.isFinite(hour)) return "morning";
  const h = Math.floor(hour);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function normalizePanel(p: string): KiwiGreetingPanel {
  const v = String(p ?? "")
    .trim()
    .toLowerCase() as KiwiGreetingPanel;
  const ok: KiwiGreetingPanel[] = [
    "today",
    "kiwi",
    "schedule",
    "bookshelf",
    "notebook",
    "stuck",
    "feeling",
    "apps",
  ];
  return ok.includes(v) ? v : "today";
}

const POOLS: Record<
  KiwiGreetingPanel,
  Record<KiwiGreetingBucket, string[]>
> = {
  today: {
    morning: [
      "Morning. Today's list is here when you're ready.",
      "Morning. No rush — read through and pick a start point.",
      "Morning. Looking at today already, that's a head start.",
    ],
    afternoon: [
      "Afternoon. Pick up wherever makes sense.",
      "Afternoon check-in. The schedule's the same as earlier.",
      "Back to the list. Whatever's next is fine.",
    ],
    evening: [
      "Evening. Tomorrow's outline is already drafted.",
      "Evening. Anything still open can roll forward.",
      "Evening. Reading the rest is enough for today.",
    ],
    night: [
      "Late check-in. Nothing here has to be done tonight.",
      "Late visit. The list will still be here tomorrow.",
      "Late visit. Tomorrow's plan is already drafted.",
    ],
  },
  kiwi: {
    morning: [
      "Morning. I'm Kiwi. Ask whenever.",
      "Morning. I'm here when there's a question.",
      "Morning. I'm Kiwi. Take your time.",
    ],
    afternoon: [
      "I'm Kiwi. Same as earlier — ask when ready.",
      "I'm Kiwi. Whatever's on your mind is fine.",
      "I'm here. Nothing's a wrong question.",
    ],
    evening: [
      "I'm Kiwi. Short questions are fine.",
      "I'm Kiwi. Evening pace is okay.",
      "I'm here. Tomorrow's questions can wait too.",
    ],
    night: [
      "I'm Kiwi. Late questions are fine.",
      "I'm Kiwi. Quick answers tonight, longer tomorrow.",
      "I'm here. Resting is also a valid answer.",
    ],
  },
  schedule: {
    morning: [
      "Schedule view. Changes still need Mom and Grandma both.",
      "Today's blocks are listed. Same approval rules.",
      "Schedule's here. Requests go through Mom and Grandma.",
    ],
    afternoon: [
      "Schedule view. Same rules as this morning.",
      "Schedule's the same. Requests still need both adults.",
      "Reviewing the day is fine. Changes need approval.",
    ],
    evening: [
      "Schedule view. Tomorrow's draft is editable by request.",
      "Schedule's open. Requests still go through both adults.",
      "Reviewing tomorrow is fine.",
    ],
    night: [
      "Late look. Tomorrow's blocks are drafted.",
      "Late look. Requests still need Mom and Grandma both.",
      "Schedule's here if you want to skim.",
    ],
  },
  bookshelf: {
    morning: [
      "Bookshelf. Pick whatever's next.",
      "Reading list is here. Whatever pace fits.",
      "Bookshelf's open. Nothing has to finish today.",
    ],
    afternoon: [
      "Reading time is flexible.",
      "Bookshelf's here. Whatever feels readable today.",
      "Reading list is open. Skim or settle in.",
    ],
    evening: [
      "Evening reading is optional.",
      "Bookshelf's open. Light reading is also reading.",
      "Reading list is here for tomorrow too.",
    ],
    night: [
      "Late visit. Reading or not reading is both fine.",
      "Bookshelf's here. Tomorrow's chapter can wait.",
      "Late visit. A page or none — both fine.",
    ],
  },
  notebook: {
    morning: [
      "Notebook's open. Drafts don't have to be neat.",
      "Notebook's here. Short entries count.",
      "Notebook's open. Whatever you wrote yesterday is fine.",
    ],
    afternoon: [
      "Notebook view. Pick up an entry or start fresh.",
      "Notebook's open. One sentence is enough.",
      "Notebook's here. Today's entry can be short.",
    ],
    evening: [
      "Notebook's open. Evening entries can be brief.",
      "Notebook view. Closing the day in writing is optional.",
      "Notebook's here. Nothing has to be polished.",
    ],
    night: [
      "Late notebook visit. A line is enough.",
      "Notebook's here. Tomorrow's entry can wait.",
      "Late visit. Skipping tonight is fine.",
    ],
  },
  stuck: {
    morning: [
      "Stuck is information, not a verdict.",
      "Stuck happens. We'll figure the next small step.",
      "Stuck is fine. One small move at a time.",
    ],
    afternoon: [
      "Stuck again is still fine. Same approach.",
      "Stuck happens. One step is enough.",
      "Stuck is information. Tell me what's hard.",
    ],
    evening: [
      "Stuck this late is normal. Tomorrow is still a day.",
      "Stuck happens. Resting is also a move.",
      "Stuck is fine. Tomorrow's fresh.",
    ],
    night: [
      "Stuck tonight is fine. Sleep counts.",
      "Stuck happens late too. Tomorrow's plan can shift.",
      "Stuck is information. Rest counts as a step.",
    ],
  },
  feeling: {
    morning: [
      "Whatever's coming up is okay to say.",
      "No judgment on feelings. Just say what's true.",
      "Whatever's there is fine to name.",
    ],
    afternoon: [
      "Feelings can change in a day. That's normal.",
      "Whatever's there is fine to share with Mom or Grandma.",
      "No judgment on this. Just what's true.",
    ],
    evening: [
      "Evenings can be heavier sometimes. That's normal.",
      "Whatever's there is fine to bring to Mom or Grandma.",
      "No judgment on feelings.",
    ],
    night: [
      "Late feelings are real feelings.",
      "Whatever's there is okay to name with Mom or Grandma.",
      "No judgment on this. Rest counts.",
    ],
  },
  apps: {
    morning: [
      "Apps and tools are here. Pick what fits.",
      "Apps view. Same set as yesterday.",
      "Apps are open. Use what helps.",
    ],
    afternoon: [
      "Apps view. Pick whatever's useful.",
      "Apps are open. Same set.",
      "Apps view. Whichever tool helps.",
    ],
    evening: [
      "Apps view. Evening use is also fine.",
      "Apps are open.",
      "Apps view. Pick what helps now.",
    ],
    night: [
      "Apps are here. Late use is okay too.",
      "Apps view. Whatever's useful tonight.",
      "Apps are open. Pick light tools.",
    ],
  },
};

function nonNegInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  return i >= 0 ? i : -i;
}

export function composeKiwiGreeting(
  input: KiwiGreetingInput,
): KiwiGreetingResult {
  const panel = normalizePanel(input.panel);
  const bucket = pickBucket(input.localHour);
  const pool = POOLS[panel][bucket];
  const idx = nonNegInt(input.dayIndex) % pool.length;
  const greeting = pool[idx];
  return { greeting, bucket, panel };
}

/**
 * Internal export for invariant audits (vitests).
 */
export function _allKiwiGreetings(): string[] {
  const all: string[] = [];
  (Object.keys(POOLS) as KiwiGreetingPanel[]).forEach((p) => {
    (Object.keys(POOLS[p]) as KiwiGreetingBucket[]).forEach((b) => {
      POOLS[p][b].forEach((line) => all.push(line));
    });
  });
  return all;
}

export const _GREETING_FORBIDDEN_RE = FORBIDDEN_RE;
