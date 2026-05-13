/**
 * Push 88 (2026-05-13) — Free-form agenda prompt → directive list → diff ops.
 *
 * Deterministic keyword/regex parser. Reusable from the AI Agenda Editor
 * preview flow so Mom can type "short fun and easy" or "more focused on
 * math" and immediately see the proposed diff before applying.
 *
 * Pure: no DB, no LLM. The mutation that exposes this scaffold is
 * `agendaEditor.previewPromptDiff` (familyAdminProcedure). LLM-assisted
 * fallback can layer on later; the deterministic path covers the most
 * common Mom-utterances Mom listed in chat.
 */
export type DirectiveKind =
  | "shortenAll"
  | "lengthenAll"
  | "focusSubject"
  | "deprioritizeSubject"
  | "easeUp"
  | "amplifyFun"
  | "bumpDurationFor"
  | "trimDurationFor"
  | "removeSubjectToday";

export interface Directive {
  kind: DirectiveKind;
  subjectSlug?: string;
  deltaMin?: number;
  rationale: string;
}

const SUBJECT_KEYWORDS: Record<string, string> = {
  math: "math",
  mathematics: "math",
  ela: "ela",
  reading: "ela",
  writing: "ela",
  language: "ela",
  spelling: "ela",
  science: "science",
  social: "social-studies",
  history: "social-studies",
  geography: "social-studies",
  art: "specials",
  music: "specials",
  pe: "specials",
  movement: "specials",
};

function detectSubject(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [k, slug] of Object.entries(SUBJECT_KEYWORDS)) {
    if (lower.includes(k)) return slug;
  }
  return null;
}

export function parseAgendaPromptToDirectives(prompt: string): Directive[] {
  const text = (prompt || "").trim().toLowerCase();
  if (!text) return [];
  const out: Directive[] = [];

  // Shorten / lengthen everything.
  if (/\b(shorter|short|quick|quickly|brief|brisk)\b/.test(text)) {
    out.push({ kind: "shortenAll", rationale: "user asked for shorter blocks" });
  }
  if (/\b(longer|deeper|more time|extend)\b/.test(text)) {
    out.push({ kind: "lengthenAll", rationale: "user asked for longer blocks" });
  }

  // Ease-up + fun.
  if (/\b(ease|easy|easier|low.?key|chill|gentle)\b/.test(text)) {
    out.push({ kind: "easeUp", rationale: "user asked for an easier day" });
  }
  if (/\b(fun|playful|game|hands.?on)\b/.test(text)) {
    out.push({ kind: "amplifyFun", rationale: "user asked for more fun" });
  }

  // "Add 5 min to math" / "5 more minutes of math" — explicit duration shift.
  const bumpMatch =
    text.match(/(?:add|plus|\+)\s*(\d{1,2})\s*(?:min|minutes|m)\s*(?:to|of|for)?\s*(math|ela|reading|writing|science|social|history|art|music|pe)?/) ||
    text.match(/(\d{1,2})\s*(?:more)?\s*(?:min|minutes|m)\s*(?:more)?\s*(?:of|to|for)?\s*(math|ela|reading|writing|science|social|history|art|music|pe)/);
  if (bumpMatch) {
    const delta = Math.min(60, parseInt(bumpMatch[1], 10));
    const slug = bumpMatch[2] ? SUBJECT_KEYWORDS[bumpMatch[2]] : detectSubject(text);
    if (slug && delta > 0) {
      out.push({
        kind: "bumpDurationFor",
        subjectSlug: slug,
        deltaMin: delta,
        rationale: `user asked to add ${delta} min to ${slug}`,
      });
    }
  }
  const trimMatch =
    text.match(/(?:cut|minus|trim|-)\s*(\d{1,2})\s*(?:min|minutes|m)\s*(?:from|off|of)?\s*(math|ela|reading|writing|science|social|history|art|music|pe)?/);
  if (trimMatch) {
    const delta = Math.min(60, parseInt(trimMatch[1], 10));
    const slug = trimMatch[2] ? SUBJECT_KEYWORDS[trimMatch[2]] : detectSubject(text);
    if (slug && delta > 0) {
      out.push({
        kind: "trimDurationFor",
        subjectSlug: slug,
        deltaMin: delta,
        rationale: `user asked to trim ${delta} min from ${slug}`,
      });
    }
  }

  // "No science today" / "skip math".
  const skipMatch = text.match(/(?:no|skip|drop)\s+(math|ela|reading|writing|science|social|history|art|music|pe)/);
  if (skipMatch) {
    const slug = SUBJECT_KEYWORDS[skipMatch[1]];
    out.push({
      kind: "removeSubjectToday",
      subjectSlug: slug,
      rationale: `user asked to remove ${slug} today`,
    });
  }

  // "More math" / "more focused on math" / "focus on math".
  const focusMatch =
    text.match(/(?:focus|more|extra|emphasis|emphasise|emphasize|priori\w+)\b[^.]*?(math|ela|reading|writing|science|social|history|art|music|pe)/);
  if (focusMatch && !bumpMatch) {
    const slug = SUBJECT_KEYWORDS[focusMatch[1]];
    out.push({
      kind: "focusSubject",
      subjectSlug: slug,
      rationale: `user asked to focus on ${slug}`,
    });
  }

  // "Less science" — deprioritize.
  const lessMatch = text.match(/(?:less|fewer|de.?priori\w+)\b[^.]*?(math|ela|reading|writing|science|social|history|art|music|pe)/);
  if (lessMatch) {
    const slug = SUBJECT_KEYWORDS[lessMatch[1]];
    out.push({
      kind: "deprioritizeSubject",
      subjectSlug: slug,
      rationale: `user asked for less ${slug}`,
    });
  }

  return out;
}

export interface BlockSnapshot {
  id: number;
  title: string;
  subjectSlug?: string | null;
  durationMin: number;
  startTime?: string | null;
  status?: string;
}

export type AgendaDiffOp =
  | {
      kind: "updateDuration";
      blockId: number;
      before: number;
      after: number;
      reason: string;
    }
  | { kind: "skipBlock"; blockId: number; reason: string }
  | { kind: "markFun"; blockId: number; reason: string }
  | { kind: "markEasy"; blockId: number; reason: string };

export interface AgendaDiffResult {
  ops: AgendaDiffOp[];
  summary: string;
  directives: Directive[];
}

export function applyDirectivesAsDiff(
  blocks: BlockSnapshot[],
  directives: Directive[],
): AgendaDiffResult {
  const ops: AgendaDiffOp[] = [];

  for (const dir of directives) {
    if (dir.kind === "shortenAll") {
      for (const b of blocks) {
        if (b.status === "complete") continue;
        const after = Math.max(10, Math.round(b.durationMin * 0.75));
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "lengthenAll") {
      for (const b of blocks) {
        if (b.status === "complete") continue;
        const after = Math.min(120, Math.round(b.durationMin * 1.25));
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "easeUp") {
      for (const b of blocks) {
        if (b.status === "complete") continue;
        ops.push({ kind: "markEasy", blockId: b.id, reason: dir.rationale });
      }
    } else if (dir.kind === "amplifyFun") {
      for (const b of blocks) {
        if (b.status === "complete") continue;
        ops.push({ kind: "markFun", blockId: b.id, reason: dir.rationale });
      }
    } else if (dir.kind === "bumpDurationFor" && dir.subjectSlug && dir.deltaMin) {
      for (const b of blocks) {
        if (b.subjectSlug !== dir.subjectSlug) continue;
        if (b.status === "complete") continue;
        const after = Math.min(120, b.durationMin + dir.deltaMin);
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "trimDurationFor" && dir.subjectSlug && dir.deltaMin) {
      for (const b of blocks) {
        if (b.subjectSlug !== dir.subjectSlug) continue;
        if (b.status === "complete") continue;
        const after = Math.max(10, b.durationMin - dir.deltaMin);
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "focusSubject" && dir.subjectSlug) {
      for (const b of blocks) {
        if (b.subjectSlug !== dir.subjectSlug) continue;
        if (b.status === "complete") continue;
        const after = Math.min(120, b.durationMin + 10);
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "deprioritizeSubject" && dir.subjectSlug) {
      for (const b of blocks) {
        if (b.subjectSlug !== dir.subjectSlug) continue;
        if (b.status === "complete") continue;
        const after = Math.max(10, b.durationMin - 10);
        if (after !== b.durationMin) {
          ops.push({
            kind: "updateDuration",
            blockId: b.id,
            before: b.durationMin,
            after,
            reason: dir.rationale,
          });
        }
      }
    } else if (dir.kind === "removeSubjectToday" && dir.subjectSlug) {
      for (const b of blocks) {
        if (b.subjectSlug !== dir.subjectSlug) continue;
        if (b.status === "complete") continue;
        ops.push({ kind: "skipBlock", blockId: b.id, reason: dir.rationale });
      }
    }
  }

  // Build summary from directives so Mom sees the human read-back.
  const summary =
    directives.length === 0
      ? "No directives detected; nothing will change."
      : directives.map((d) => d.rationale).join("; ");

  return { ops, summary, directives };
}
