/**
 * Push 151 (2026-05-14) — Free-form Agenda Editor parser (pure helper).
 *
 * Mom's rule: "I want to type plain English at the dashboard and have it
 * just rewrite the day. No menus." Examples:
 *   - "shorter today"            -> shrink every academic block by 25%
 *   - "more math"                -> add a 20m math block before lunch
 *   - "skip science"             -> remove all science blocks today
 *   - "swap reading and math"    -> swap the two block ranges
 *   - "10 minute break after math" -> insert a 10m break after Math
 *   - "start at 10"              -> push the day's start time to 10:00
 *   - "no test days"             -> mark today as a non-test day
 *   - "fun and easy"             -> shorten + add movement / specials
 *
 * This is a *parser* only. It never touches the DB. The caller takes the
 * `EditOp[]` and applies them to the in-memory plan, then commits via
 * the existing `updateBlock` / `createBlock` / `deleteBlock` helpers.
 *
 * Pure: no DB, no IO, deterministic. Runs in <1ms for typical input.
 *
 * Robust by default: unknown phrases produce ZERO edits, NEVER a guess.
 * Mom's input is echoed back as `originalInput` for the undo card.
 */

export type AgendaEditOp =
  | { kind: "scale_durations"; multiplier: number; reason: string }
  | { kind: "insert_block"; subjectSlug: string; durationMin: number; afterSubjectSlug?: string; beforeSubjectSlug?: string; blockType: "academic" | "movement" | "break"; reason: string }
  | { kind: "remove_subject"; subjectSlug: string; reason: string }
  | { kind: "swap_subjects"; firstSubjectSlug: string; secondSubjectSlug: string; reason: string }
  | { kind: "set_start_time"; startTime: string; reason: string }
  | { kind: "tag_no_test_day"; reason: string }
  | { kind: "fun_easy_preset"; reason: string };

export interface AgendaEditorParseResult {
  /** Original user input (kept for undo + audit). */
  originalInput: string;
  /** Recognized edits, in input order. Empty when nothing matched. */
  edits: AgendaEditOp[];
  /** Phrases that didn't match (kid + Grandma readable). */
  unrecognized: string[];
  /** Plain-English summary Mom can read on the Accept / Undo card. */
  summary: string;
}

const SUBJECT_ALIASES: Record<string, string> = {
  math: "math", maths: "math", arithmetic: "math",
  reading: "reading", read: "reading", ela: "reading", language: "reading", "language arts": "reading", lit: "reading", literature: "reading",
  science: "science", sci: "science",
  "social studies": "social_studies", history: "social_studies", geography: "social_studies", civics: "social_studies",
  art: "specials", music: "specials", pe: "specials", gym: "specials", specials: "specials",
};

function findSubject(text: string): string | null {
  const t = text.toLowerCase();
  // Multi-word first.
  if (/\b(social studies|language arts)\b/.test(t)) {
    return /social studies/.test(t) ? "social_studies" : "reading";
  }
  for (const [alias, slug] of Object.entries(SUBJECT_ALIASES)) {
    if (alias.includes(" ")) continue;
    const re = new RegExp(`\\b${alias}\\b`);
    if (re.test(t)) return slug;
  }
  return null;
}

function parseTime(text: string): string | null {
  // Accept "10", "10:30", "10am", "10:30 am", "10 a.m."
  const m = text.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3]?.toLowerCase().replace(/\./g, "");
  if (period === "pm" && h < 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function parseDuration(text: string): number | null {
  const m = text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?|m)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 240) return null;
  return n;
}

export function parseAgendaEditorInput(input: string): AgendaEditorParseResult {
  const original = input ?? "";
  const text = original.trim().toLowerCase();
  const edits: AgendaEditOp[] = [];
  const unrecognized: string[] = [];

  if (!text) {
    return { originalInput: original, edits: [], unrecognized: [], summary: "" };
  }

  // Split on commas / "and" / semicolons so "shorter today, more math" -> 2 phrases.
  const phrases = text.split(/\s*(?:,|;|\band\b)\s*/).filter(Boolean);

  for (const raw of phrases) {
    const p = raw.trim();
    if (!p) continue;

    // 1. shorter / shorten today / make shorter
    if (/\b(shorter|shorten|shorten today|make.*shorter|cut.*short)\b/.test(p) && !/\b(longer)\b/.test(p)) {
      edits.push({
        kind: "scale_durations",
        multiplier: 0.75,
        reason: "Make today's blocks 25% shorter.",
      });
      continue;
    }

    // 2. longer today / add more time
    if (/\b(longer today|make.*longer|add more time)\b/.test(p)) {
      edits.push({
        kind: "scale_durations",
        multiplier: 1.25,
        reason: "Make today's blocks 25% longer.",
      });
      continue;
    }

    // 3. skip / remove / no <subject>
    {
      const skipMatch = /\b(skip|remove|no|cancel)\b\s+([a-z ]+)/.exec(p);
      if (skipMatch) {
        const subject = findSubject(skipMatch[2]);
        if (subject) {
          edits.push({
            kind: "remove_subject",
            subjectSlug: subject,
            reason: `Remove all ${subject} blocks today.`,
          });
          continue;
        }
      }
    }

    // 4. swap A and B (already split by 'and' earlier — re-check joined original)
    {
      const swap = /\bswap\s+([a-z ]+?)\s+(?:and|with)\s+([a-z ]+)/.exec(p);
      if (swap) {
        const a = findSubject(swap[1]);
        const b = findSubject(swap[2]);
        if (a && b && a !== b) {
          edits.push({
            kind: "swap_subjects",
            firstSubjectSlug: a,
            secondSubjectSlug: b,
            reason: `Swap ${a} and ${b}.`,
          });
          continue;
        }
      }
    }

    // 5. start at <time> / start time <time>
    {
      const startMatch = /\b(start(?:\s+(?:at|time))?)\s+(.+)/.exec(p);
      if (startMatch) {
        const t = parseTime(startMatch[2]);
        if (t) {
          edits.push({
            kind: "set_start_time",
            startTime: t,
            reason: `Start the day at ${t}.`,
          });
          continue;
        }
      }
    }

    // 6. <duration> break|stretch|movement after|before <subject>
    {
      const insertMatch = /\b(\d{1,3})\s*(?:min(?:ute)?s?|m)\s+(break|stretch|movement|recess|outside|outdoor)\s+(after|before)\s+([a-z ]+)/.exec(p);
      if (insertMatch) {
        const dur = parseInt(insertMatch[1], 10);
        const tagWord = insertMatch[2];
        const placement = insertMatch[3];
        const target = findSubject(insertMatch[4]);
        if (dur > 0 && dur <= 60 && target) {
          edits.push({
            kind: "insert_block",
            subjectSlug: tagWord === "break" ? "break" : "movement",
            durationMin: dur,
            blockType: tagWord === "break" ? "break" : "movement",
            ...(placement === "after" ? { afterSubjectSlug: target } : { beforeSubjectSlug: target }),
            reason: `Add a ${dur}-minute ${tagWord} ${placement} ${target}.`,
          });
          continue;
        }
      }
    }

    // 7. more <subject> / extra <subject> / add [<duration>] <subject>
    {
      const moreMatch = /\b(more|extra|add)\b/.exec(p);
      if (moreMatch) {
        const subject = findSubject(p);
        if (subject && subject !== "specials") {
          const extra = parseDuration(p) ?? 20;
          edits.push({
            kind: "insert_block",
            subjectSlug: subject,
            durationMin: extra,
            blockType: "academic",
            reason: `Add a ${extra}-minute ${subject} block.`,
          });
          continue;
        }
      }
    }

    // 8. no test day / no test today / not a test day
    if (/\bno\s+test\s+(day|today)\b|\bnot\s+a\s+test\s+day\b/.test(p)) {
      edits.push({
        kind: "tag_no_test_day",
        reason: "Today is not a test day.",
      });
      continue;
    }

    // 9. fun and easy / short fun easy / make it fun
    if (/\b(fun and easy|fun easy|make it fun|easy day|light day|chill day)\b/.test(p)) {
      edits.push({
        kind: "fun_easy_preset",
        reason: "Make today fun and easy: shorter blocks, extra movement, no quizzes.",
      });
      continue;
    }

    unrecognized.push(p);
  }

  // Summary string
  let summary = "";
  if (edits.length === 0) {
    summary = "Kiwi didn't recognize anything in that. Try \"shorter today\" or \"more math\".";
  } else if (edits.length === 1) {
    summary = edits[0].reason;
  } else {
    summary = edits.map((e) => "• " + e.reason).join("\n");
  }

  return { originalInput: original, edits, unrecognized, summary };
}
