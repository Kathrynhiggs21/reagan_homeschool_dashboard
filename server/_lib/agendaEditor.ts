/**
 * Manus-style natural-language agenda editor.
 *
 * Takes a current day's blocks + an instruction in plain English
 * (vague vibes, targeted shifts, surgical edits, bulk reschedule, add/remove)
 * and returns a structured EditPlan that can be previewed, applied, and undone.
 *
 * Design: the LLM never writes to the DB. It only emits an EditPlan, which is a
 * sequence of typed operations that the caller validates and applies in a
 * single transaction. The before-state is snapshotted so an undo restores it
 * exactly.
 */
import { invokeLLM } from "../_core/llm";

export type AgendaBlockSnapshot = {
  id: number;
  title: string;
  description: string | null;
  blockType: string;
  startTime: string | null;     // "HH:MM"
  durationMin: number;
  sortOrder: number;
  status: string;
  subjectSlug: string | null;
  curriculumTopicCode: string | null;
};

export type AgendaPlanContext = {
  planId: number;
  date: string;                  // YYYY-MM-DD
  dayLabel: string;              // "Monday, May 4"
  studentName: string;
  gradeLevel: string;
  tutorOfDayLabel: string | null;
  blocks: AgendaBlockSnapshot[];
  subjects: Array<{ slug: string; name: string }>;
  topicCatalog: Array<{ code: string; title: string; subjectSlug: string }>;
};

/**
 * Operations the LLM can emit. Order matters: ops run sequentially.
 *
 * - update: change any subset of fields on an existing block
 * - delete: remove a block
 * - insert: add a new block (id is null until commit assigns one)
 * - reorder: explicit ordered list of ids defining new sortOrder
 * - shiftAll: shift every block's startTime by +/- minutes (handy for
 *   "start an hour later" / "compress the morning")
 */
export type AgendaEditOp =
  | {
      kind: "update";
      id: number;
      title?: string;
      description?: string | null;
      blockType?: string;
      startTime?: string | null;
      durationMin?: number;
      subjectSlug?: string | null;
      curriculumTopicCode?: string | null;
    }
  | { kind: "delete"; id: number }
  | {
      kind: "insert";
      title: string;
      description?: string | null;
      blockType: string;
      startTime?: string | null;
      durationMin: number;
      subjectSlug?: string | null;
      curriculumTopicCode?: string | null;
      // Where to insert in the order; null = append
      afterBlockId?: number | null;
    }
  | { kind: "reorder"; orderedIds: number[] }
  | { kind: "shiftAll"; minutes: number };

export type AgendaEditPlan = {
  summary: string;             // 1-sentence plain-English description
  intent: "vibe" | "targeted" | "surgical" | "bulk" | "add" | "remove" | "mixed";
  ops: AgendaEditOp[];
  warnings: string[];          // soft warnings (e.g. "no math block found")
  refusalReason?: string;      // set when the model refuses (e.g. asked to delete the whole day)
};

const SYSTEM_PROMPT = `You are the AI Agenda Editor for Reagan's homeschool dashboard.

The adult talks to you like a friend, not a form. They will say things like:
  - "shorter and fun"          (vibe)
  - "more math today"          (targeted)
  - "swap 10:30 to a nature walk"   (surgical)
  - "start at 9, 25-min blocks"     (bulk)
  - "tutor isn't here today, push everything to tomorrow"   (postpone)
  - "Mom can't tutor, swap with Grandma"                    (tutor swap)
  - "drop the catch-up block"        (remove)
  - "add a 30-min adventure after lunch"   (add)

You receive (1) the current day's blocks as JSON and (2) the adult instruction.
You return ONLY a JSON object matching this exact schema:

{
  "summary": "one sentence plain English of what you changed",
  "intent": "vibe" | "targeted" | "surgical" | "bulk" | "add" | "remove" | "mixed",
  "ops": [ ...ordered operations... ],
  "warnings": [ "..." ]
}

Operation types:
- {"kind":"update","id":N, ...partial fields...}
- {"kind":"delete","id":N}
- {"kind":"insert","title":"...","blockType":"...","durationMin":N, ...}
- {"kind":"reorder","orderedIds":[id1,id2,...]}
- {"kind":"shiftAll","minutes":N}  (negative = earlier)

Allowed blockType values: morning_warmup, math, adventure, read_aloud, choice,
catch_up, appointment, custom.
Allowed subjectSlug values are listed in the input. curriculumTopicCode must
match one in the topicCatalog (or omit it).
startTime is "HH:MM" 24-hour. durationMin is 5–180.

Interpretation rules — be generous, infer intent:
- "shorter / lighter / fun / easy" → trim academic blocks by 5–10 min, optionally
  insert one short adventure or choice block. intent="vibe".
- "more X" / "focus on X" → lengthen X-tagged blocks by 10–20 min, shorten
  others slightly. intent="targeted".
- "swap A to B" → single update op on A, do not delete+insert.
- "start at H:MM" / "begin H:MM" → compute the offset between earliest current
  block and the new time, emit shiftAll for that offset.
- "X-min blocks" / "every block N min" → emit one update per block with
  durationMin=N.
- "push everything to tomorrow" / "move the day to <date>" / "reschedule" →
  emit warnings describing it is a cross-day move (the UI handles that
  separately) and return ops=[] with intent="bulk". Do NOT delete blocks.
- "tutor not here" / "<tutor> can't make it" → if the day is unsalvageable,
  return ops=[] and warnings=["Tutor unavailable — use 'Push day to tomorrow'
  in the schedule view."]. If they only want to swap to another tutor, just
  add a warnings entry noting tutor changes happen in Tutors page — do not
  invent ops.
- "add an adventure / break / read aloud / appointment" → single insert op,
  pick a sensible startTime (slot it after the most recent block) and a
  reasonable durationMin (15–30).
- "drop / remove / cancel X" → a single delete op for the matching block id.
- If asked to wipe the entire day, REFUSE: return ops=[] and warnings=["I only
  do partial edits. Use the daily plan generator to rebuild the day."].
- Always preserve protected appointments unless the adult explicitly removes them.
- Never invent blocks unless the instruction asks to add one.
- Prefer minimal-diff edits. Never re-emit unchanged fields on update.

Return JSON only. No prose, no markdown.`;

export function summarizeBlocksForPrompt(ctx: AgendaPlanContext): string {
  const lines = ctx.blocks.map((b, i) => {
    return `${i + 1}. id=${b.id} ${b.startTime ?? "(no time)"} (${b.durationMin}m) [${b.blockType}${b.subjectSlug ? "/" + b.subjectSlug : ""}${b.curriculumTopicCode ? " " + b.curriculumTopicCode : ""}] ${b.title}`;
  });
  return lines.join("\n");
}

/**
 * Validate an edit plan against the current snapshot. Drops invalid ops and
 * adds explanatory warnings instead of throwing — better UX, the adult can
 * still preview what's safe.
 */
export function validateEditPlan(
  plan: AgendaEditPlan,
  ctx: AgendaPlanContext,
): AgendaEditPlan {
  const blockIds = new Set(ctx.blocks.map(b => b.id));
  const subjectSlugs = new Set(ctx.subjects.map(s => s.slug));
  const topicCodes = new Set(ctx.topicCatalog.map(t => t.code.toUpperCase()));
  const validBlockTypes = new Set([
    "morning_warmup", "math", "adventure", "read_aloud", "choice",
    "catch_up", "appointment", "custom",
  ]);

  const cleanOps: AgendaEditOp[] = [];
  const warnings = [...(plan.warnings ?? [])];

  for (const op of plan.ops ?? []) {
    if (!op || typeof op !== "object") continue;
    switch (op.kind) {
      case "update":
        if (!blockIds.has(op.id)) {
          warnings.push(`Skipped update for unknown block id ${op.id}.`);
          continue;
        }
        if (op.blockType && !validBlockTypes.has(op.blockType)) {
          warnings.push(`Dropped invalid blockType "${op.blockType}" on update.`);
          delete (op as any).blockType;
        }
        if (op.subjectSlug && !subjectSlugs.has(op.subjectSlug)) {
          warnings.push(`Dropped unknown subject "${op.subjectSlug}".`);
          (op as any).subjectSlug = undefined;
        }
        if (op.curriculumTopicCode && !topicCodes.has(op.curriculumTopicCode.toUpperCase())) {
          warnings.push(`Dropped unknown topic code "${op.curriculumTopicCode}".`);
          (op as any).curriculumTopicCode = undefined;
        }
        if (op.durationMin != null && (op.durationMin < 5 || op.durationMin > 180)) {
          warnings.push(`Clamped durationMin ${op.durationMin} into [5,180].`);
          op.durationMin = Math.max(5, Math.min(180, op.durationMin));
        }
        if (op.startTime && !/^\d{1,2}:\d{2}$/.test(op.startTime)) {
          warnings.push(`Dropped invalid startTime "${op.startTime}".`);
          (op as any).startTime = undefined;
        }
        cleanOps.push(op);
        break;
      case "delete":
        if (!blockIds.has(op.id)) {
          warnings.push(`Skipped delete for unknown block id ${op.id}.`);
          continue;
        }
        cleanOps.push(op);
        break;
      case "insert":
        if (!validBlockTypes.has(op.blockType)) {
          warnings.push(`Skipped insert with invalid blockType "${op.blockType}".`);
          continue;
        }
        if (op.subjectSlug && !subjectSlugs.has(op.subjectSlug)) {
          warnings.push(`Dropped unknown subject "${op.subjectSlug}" on insert.`);
          op.subjectSlug = null;
        }
        if (op.curriculumTopicCode && !topicCodes.has(op.curriculumTopicCode.toUpperCase())) {
          warnings.push(`Dropped unknown topic code on insert.`);
          op.curriculumTopicCode = null;
        }
        if (op.durationMin == null || op.durationMin < 5 || op.durationMin > 180) {
          op.durationMin = Math.max(5, Math.min(180, op.durationMin || 30));
        }
        cleanOps.push(op);
        break;
      case "reorder": {
        const seen = new Set<number>();
        const filtered = (op.orderedIds ?? []).filter(id => {
          if (!blockIds.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (filtered.length === 0) {
          warnings.push("Skipped reorder with no valid ids.");
          continue;
        }
        cleanOps.push({ kind: "reorder", orderedIds: filtered });
        break;
      }
      case "shiftAll":
        if (typeof op.minutes !== "number" || Math.abs(op.minutes) > 720) {
          warnings.push("Dropped shiftAll with out-of-range minutes.");
          continue;
        }
        cleanOps.push(op);
        break;
    }
  }

  return { ...plan, ops: cleanOps, warnings };
}

/**
 * Apply an edit plan to a snapshot in memory. Returns the resulting block
 * list, used for the diff preview. The DB-side commit must mirror this logic.
 */
export function applyEditPlanInMemory(
  ctx: AgendaPlanContext,
  plan: AgendaEditPlan,
): AgendaBlockSnapshot[] {
  let next = ctx.blocks.map(b => ({ ...b }));
  let nextSyntheticId = -1;

  for (const op of plan.ops) {
    switch (op.kind) {
      case "update": {
        const idx = next.findIndex(b => b.id === op.id);
        if (idx < 0) break;
        const cur = next[idx];
        next[idx] = {
          ...cur,
          ...(op.title !== undefined ? { title: op.title } : {}),
          ...(op.description !== undefined ? { description: op.description } : {}),
          ...(op.blockType !== undefined ? { blockType: op.blockType } : {}),
          ...(op.startTime !== undefined ? { startTime: op.startTime } : {}),
          ...(op.durationMin !== undefined ? { durationMin: op.durationMin } : {}),
          ...(op.subjectSlug !== undefined ? { subjectSlug: op.subjectSlug } : {}),
          ...(op.curriculumTopicCode !== undefined ? { curriculumTopicCode: op.curriculumTopicCode } : {}),
        };
        break;
      }
      case "delete":
        next = next.filter(b => b.id !== op.id);
        break;
      case "insert": {
        const fresh: AgendaBlockSnapshot = {
          id: nextSyntheticId--,
          title: op.title,
          description: op.description ?? null,
          blockType: op.blockType,
          startTime: op.startTime ?? null,
          durationMin: op.durationMin,
          sortOrder: 0,
          status: "not_started",
          subjectSlug: op.subjectSlug ?? null,
          curriculumTopicCode: op.curriculumTopicCode ?? null,
        };
        if (op.afterBlockId == null) {
          next.push(fresh);
        } else {
          const idx = next.findIndex(b => b.id === op.afterBlockId);
          if (idx < 0) next.push(fresh);
          else next.splice(idx + 1, 0, fresh);
        }
        break;
      }
      case "reorder": {
        const byId = new Map(next.map(b => [b.id, b]));
        const reordered: AgendaBlockSnapshot[] = [];
        for (const id of op.orderedIds) {
          const b = byId.get(id);
          if (b) {
            reordered.push(b);
            byId.delete(id);
          }
        }
        // Anything not mentioned keeps its original relative order at the end.
        for (const b of next) if (byId.has(b.id)) reordered.push(b);
        next = reordered;
        break;
      }
      case "shiftAll": {
        next = next.map(b => {
          if (!b.startTime) return b;
          const m = b.startTime.match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return b;
          const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + op.minutes;
          if (total < 0 || total >= 24 * 60) return b;
          const hh = Math.floor(total / 60).toString().padStart(2, "0");
          const mm = (total % 60).toString().padStart(2, "0");
          return { ...b, startTime: `${hh}:${mm}` };
        });
        break;
      }
    }
  }

  return next.map((b, i) => ({ ...b, sortOrder: i }));
}

/**
 * Ask the LLM for an edit plan. Caller is expected to validate + preview.
 */
export async function generateAgendaEditPlan(
  ctx: AgendaPlanContext,
  instruction: string,
): Promise<AgendaEditPlan> {
  const userMsg = [
    `Date: ${ctx.dayLabel} (${ctx.date})`,
    `Student: ${ctx.studentName}, ${ctx.gradeLevel}`,
    ctx.tutorOfDayLabel ? `Tutor today: ${ctx.tutorOfDayLabel}` : "Tutor today: none",
    "",
    "Current blocks:",
    summarizeBlocksForPrompt(ctx),
    "",
    `Allowed subject slugs: ${ctx.subjects.map(s => s.slug).join(", ")}`,
    `Allowed topic codes (sample): ${ctx.topicCatalog.slice(0, 30).map(t => t.code).join(", ")}${ctx.topicCatalog.length > 30 ? ", ..." : ""}`,
    "",
    `Adult instruction: ${instruction}`,
  ].join("\n");

  const resp = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "agenda_edit_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            intent: { type: "string", enum: ["vibe", "targeted", "surgical", "bulk", "add", "remove", "mixed"] },
            ops: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "intent", "ops", "warnings"],
          additionalProperties: false,
        },
      },
    },
  });

  let parsed: AgendaEditPlan;
  try {
    const content = (resp as any)?.choices?.[0]?.message?.content ?? "{}";
    parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch (e) {
    return {
      summary: "Could not understand instruction.",
      intent: "vibe",
      ops: [],
      warnings: ["The AI could not produce a valid edit plan. Try rephrasing."],
    };
  }
  return validateEditPlan(parsed, ctx);
}
