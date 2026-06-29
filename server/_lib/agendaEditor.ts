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
import { whatWorksPromptAddendum } from "./whatWorks";
import {
  parseAgendaPromptToDirectives,
  type Directive,
} from "./agendaPromptParser";

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
  | { kind: "shiftAll"; minutes: number }
  /**
   * v3.16 (2026-05-30) — Custom worksheet attachment.
   * Triggered when the adult asks the chat to "make a worksheet about X"
   * or attaches a reference image and asks for a practice sheet to match.
   * The handler calls the same worksheet-generation pipeline used by the
   * curriculum builder, then attaches the resulting URL to `targetBlockId`.
   * If `targetBlockId` is null, the handler creates a new block and
   * attaches the worksheet to it.
   */
  | {
      kind: "generate_worksheet";
      targetBlockId: number | null;
      topic: string;            // e.g. "long division with remainders"
      subjectSlug?: string | null;
      gradeLevel?: string | null;
      questionCount?: number;   // default 8
      style?: "practice" | "quiz" | "review" | "writing-prompt";
      sourceAttachmentUrl?: string | null; // when generating from an image/PDF
    }
  /**
   * v3.17 (2026-05-30) — manually queue a review block for a subject
   * or skill code. Triggered when Mom says "review fractions" or
   * "she needs more practice on writing". The handler synthesizes an
   * insert op with blockType="catch_up", an explanatory description
   * naming the strand being reviewed, and slots it after the current
   * day's last block by default. Pure logic in memory; the apply path
   * just turns this into a regular insert with sensible defaults.
   */
  | {
      kind: "queue_review_block";
      subjectSlug?: string | null;       // "math", "ela", etc — either this OR topic must be set
      topic?: string | null;             // free-form topic e.g. "fractions" / "opinion writing"
      curriculumTopicCode?: string | null; // optional precise ladder code (e.g. "OH.5.NF.1")
      durationMin?: number;              // default 25
      afterBlockId?: number | null;      // null = append (slot at end of day)
      reason?: string | null;            // optional plain-English reason that goes into the block description
    }
  /**
   * v1 (2026-06-17) — "several ways → pick one". Emitted ONLY when the adult
   * explicitly asks for choices ("give me several ways", "a few ideas",
   * "options for ..."). This op writes NOTHING to the DB. The chat returns the
   * candidate list to the UI, which renders pickable chips; the adult's pick
   * comes back as a normal follow-up message that the planner turns into a
   * regular insert. This is the one allowed exception to the "make the change,
   * don't propose options" rule.
   */
  | {
      kind: "offer_options";
      prompt: string;                    // short question shown above the choices, e.g. "Pick a duck-themed measurement activity:"
      options: Array<{
        title: string;                   // short label for the chip
        description: string;             // 1–2 sentence explanation of the activity
        blockType?: string;              // suggested block type when picked (default "adventure")
        subjectSlug?: string | null;     // suggested subject when picked
        durationMin?: number;            // suggested duration when picked (5–180)
      }>;
    };

export type AgendaEditPlan = {
  summary: string;             // 1-sentence plain-English description
  intent: "vibe" | "targeted" | "surgical" | "bulk" | "add" | "remove" | "mixed";
  ops: AgendaEditOp[];
  warnings: string[];          // soft warnings (e.g. "no math block found")
  refusalReason?: string;      // set when the model refuses (e.g. asked to delete the whole day)
  /**
   * 2026-06-29 — ANSWER MODE. When the adult's message is a QUESTION or a
   * general request for information/ideas rather than a schedule edit, the
   * assistant answers conversationally instead of forcing an empty diff.
   * When `answer` is set, `ops` is normally empty and the chat surface shows
   * this text as the reply. `mode` records which path produced the plan so the
   * UI / tests can distinguish "I changed the schedule" from "I answered you".
   */
  answer?: string;
  mode?: "edit" | "answer";
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
  - "here's a worksheet she just got — work it into today"  (uploaded image/PDF)
  - "make a 1-page worksheet on multiplying fractions"   (asks you to create one)

The adult may attach a file (image or PDF). When attached, treat it as either:
  (a) an existing worksheet/assignment they want scheduled → emit one insert op
      with title="Work the attached worksheet: <subject/topic>",
      blockType="math"|"adventure"|... matching the worksheet, durationMin=20–40.
      Put a 1-sentence description that names the worksheet contents.
  (b) a reference image (e.g. a photo of a textbook page she's on) → use it to
      infer the right subject/topic and adapt the existing block instead of
      adding one. Add a warning citing the page if obvious ("Looks like
      Spectrum Math pg 148").

When the adult asks you to *create* a worksheet, prefer the
generate_worksheet op (see operation types below) so the system can
author the questions properly. Fall back to a plain insert op with
blockType="custom" only if the adult explicitly says "just add a
placeholder" or similar. Do NOT generate file URLs.

You receive (1) the current day's blocks as JSON, (2) the adult instruction,
and optionally (3) an attached file.
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
- {"kind":"generate_worksheet","targetBlockId":N|null,"topic":"...","questionCount":8,"style":"practice"|"quiz"|"review"|"writing-prompt","subjectSlug":"..."}
  Use this when the adult asks you to *create* a real worksheet ("make a
  worksheet on X", "build a quick quiz on Y", "give her 10 problems on Z").
  Set targetBlockId to an existing block id when the worksheet should
  attach to that block; set targetBlockId=null to create a new custom
  block to host the worksheet. Prefer this op over insert+description when
  the adult specifically wants graded-style content.
- {"kind":"queue_review_block","subjectSlug":"math"|null,"topic":"fractions"|null,"curriculumTopicCode":"OH.5.NF.1"|null,"durationMin":25,"reason":"..."}
  Use this when the adult says "review X", "she needs more practice on Y",
  "loop back on Z", "give her another go at X". You MUST set EITHER
  subjectSlug OR topic (not necessarily both). The handler picks the right
  ladder row to review and slots a catch-up block at the end of the day.
  Prefer this over a plain insert when the adult's intent is clearly
  remediation rather than adding new content.
- {"kind":"offer_options","prompt":"Pick one:","options":[{"title":"...","description":"...","blockType":"adventure","subjectSlug":"...","durationMin":30}, ...]}
  Use this ONLY when the adult EXPLICITLY asks for choices to pick from —
  phrases like "give me several ways", "a few ideas", "some options", "a
  couple of choices", "list a few". Provide 3–5 distinct, concrete options.
  This op writes NOTHING — it just presents the choices; the adult will pick
  one and you'll insert it on the next turn. If the adult did NOT ask for
  choices, do NOT use this op — just make the single best change.
  IMPORTANT: when a request mixes a definite build ("add measurement lesson +
  worksheet") AND an explicit ask for choices ("...then a fun activity, give
  me several ways"), emit the definite ops (insert/generate_worksheet) AND a
  trailing offer_options for the choice part, in the same plan.

Allowed blockType values: morning_warmup, math, adventure, read_aloud, choice,
catch_up, appointment, custom.

CRITICAL OUTPUT RULES (failure to follow = your output is rejected):
- Every op MUST include a "kind" field.
- update ops MUST include "id" AND at least one of: title, description,
  blockType, startTime, durationMin, subjectSlug, curriculumTopicCode.
- delete ops MUST include "id".
- insert ops MUST include "title", "blockType", and "durationMin".
- reorder ops MUST include a non-empty "orderedIds" array.
- shiftAll ops MUST include a numeric "minutes" (negative = earlier).
- NEVER emit {} or partial ops as placeholders. If you have nothing to do,
  return ops:[] (empty array) and put the reason in warnings.
- For requests like "no math today" or "drop science": find every block whose
  subjectSlug or blockType matches and emit one delete op per matching id.
- For requests like "shorter" / "more X": emit one update per affected block
  with a real durationMin change. Do NOT emit updates with no field changes.

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

QUESTIONS vs EDITS (read this first): You handle BOTH. If the adult is asking
you to CHANGE the schedule, emit ops as described below. But if the message is
a QUESTION or a general request for information or ideas — e.g. "how is she
doing in fractions?", "what did she work on this week?", "is she keeping up?",
"suggest a calm bird-themed afternoon", "any ideas for a science adventure?",
or general homeschool/parenting questions — then DO NOT invent a schedule edit.
Return ops:[] (empty) with intent="vibe" and leave the answering to the system,
which will reply conversationally with full context about Reagan. Only emit
ops when the adult actually wants the day's blocks changed. A request that
mixes a question AND an edit ("she's behind in fractions, add a review block")
should emit the edit ops — the edit wins.

You ARE the schedule editor, not a suggestion bot. By default the adult expects
you to make the change, not propose options or ask which one they'd prefer.
Decide the single best interpretation and emit the ops for it. Only return
ops=[] when the request is genuinely a cross-day move, a tutor swap, or a
full-day wipe (the cases listed above) — never because you're unsure which
option they want.
THE ONE EXCEPTION: if the adult EXPLICITLY asks for choices ("give me several
ways", "a few ideas", "some options"), use the offer_options op for that part
instead of guessing a single one. This is the only time you may present
choices.

TIME BUDGET & START TIME: if the adult states a start time ("start at 1",
"10am") and/or a total time window ("2–4 hours", "about 3 hrs total"), compose
the new blocks so their durations roughly sum to that window and the first new
block begins at the stated start. The system will also deterministically
re-lay start times and scale durations to fit, so just aim for a sensible split
— don't stress the exact minutes.

Assignments, videos, lessons, links — handle them as block content:
- "swap the science video for X" / "change the math video" → a single update op
  on the matching block: set title and put the new video/resource intent in
  description (e.g. "Watch: <topic> video"). Do NOT delete+insert.
- "change her reading assignment to chapter 4" → update the matching block's
  title/description to the new assignment.
- "add a video about volcanoes after lunch" → one insert op, blockType matching
  the subject, durationMin 10–20, description "Watch: volcanoes video."
- "give her a worksheet on X" / "build a quiz on Y" → generate_worksheet op.
Never fabricate a real file URL; describe the resource in the description and
let the system attach the actual material.

Return JSON only. No prose, no markdown.

${whatWorksPromptAddendum()}

When the adult mentions Reagan is anxious, struggling, in a yellow zone, or asks to "shorten", "make easier", "go gentler", lean on the AVOID/DO guidance above. Specifically: cut writing tasks first, switch to verbal/scribe support, add a short adventure or choice block, and never add timed work or surprise assessments.`;

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
// Normalize loose blockType values from the LLM into the canonical set.
// Lots of natural variants showed up in production ("break", "reading",
// "science", "snack") that USED to be silently dropped — now they get
// mapped to the closest legal type so the user's request actually applies.
function normalizeBlockType(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  const direct = new Set([
    "morning_warmup", "math", "adventure", "read_aloud", "choice",
    "catch_up", "appointment", "custom",
  ]);
  if (direct.has(v)) return v;
  // Map common variants that the LLM likes to emit:
  const map: Record<string, string> = {
    warmup: "morning_warmup",
    "morning-warmup": "morning_warmup",
    morning: "morning_warmup",
    reading: "read_aloud",
    "read-aloud": "read_aloud",
    readaloud: "read_aloud",
    book: "read_aloud",
    ela: "read_aloud",
    writing: "custom",
    spelling: "custom",
    grammar: "custom",
    math_practice: "math",
    arithmetic: "math",
    science: "adventure",
    "social-studies": "adventure",
    social: "adventure",
    art: "adventure",
    music: "adventure",
    pe: "adventure",
    walk: "adventure",
    nature: "adventure",
    outdoor: "adventure",
    break: "choice",
    snack: "choice",
    lunch: "choice",
    free: "choice",
    rest: "choice",
    catchup: "catch_up",
    "catch-up": "catch_up",
    review: "catch_up",
    appt: "appointment",
    therapy: "appointment",
  };
  if (map[v]) return map[v];
  return "custom"; // last-resort: never silently drop the op
}

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
    // Defensive: even with the tightened schema, a model could emit an
    // object with kind === undefined. Drop those before the switch so the
    // op count we report to the user matches reality.
    if (!(op as any).kind) {
      warnings.push("Dropped op with no `kind` field (malformed LLM output).");
      continue;
    }
    // Reject ops that have a kind but ZERO usable per-kind fields. This is
    // what was causing the May 7 'Apply 0 changes' UX: the LLM emitted
    // {kind: "update"} with nothing else and validation passed it through.
    const opAny = op as any;
    if (opAny.kind === "update" && opAny.id == null) {
      warnings.push("Dropped update op missing `id`.");
      continue;
    }
    if (opAny.kind === "update") {
      const hasAnyFieldChange = [
        "title", "description", "blockType", "startTime",
        "durationMin", "subjectSlug", "curriculumTopicCode",
      ].some(k => opAny[k] !== undefined);
      if (!hasAnyFieldChange) {
        warnings.push(`Dropped update for block ${opAny.id}: no field changes proposed.`);
        continue;
      }
    }
    if (opAny.kind === "delete" && opAny.id == null) {
      warnings.push("Dropped delete op missing `id`.");
      continue;
    }
    if (opAny.kind === "insert" && (!opAny.title || !opAny.blockType)) {
      warnings.push("Dropped insert op missing `title` or `blockType`.");
      continue;
    }
    if (opAny.kind === "reorder" && (!Array.isArray(opAny.orderedIds) || opAny.orderedIds.length === 0)) {
      warnings.push("Dropped reorder op with no `orderedIds`.");
      continue;
    }
    if (opAny.kind === "shiftAll" && typeof opAny.minutes !== "number") {
      warnings.push("Dropped shiftAll op missing numeric `minutes`.");
      continue;
    }
    switch (op.kind) {
      case "update":
        if (!blockIds.has(op.id)) {
          warnings.push(`Skipped update for unknown block id ${op.id}.`);
          continue;
        }
        if (op.blockType) {
          const norm = normalizeBlockType(op.blockType);
          if (norm && norm !== op.blockType) {
            warnings.push(`Mapped blockType "${op.blockType}" → "${norm}".`);
            (op as any).blockType = norm;
          }
        }
        if (op.subjectSlug && !subjectSlugs.has(op.subjectSlug)) {
          // Don't drop the whole subject change — keep the op, just clear the
          // unknown slug and warn. The op still has its other field changes.
          warnings.push(`Unknown subject "${op.subjectSlug}" — keeping the rest of the edit.`);
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
      case "insert": {
        const norm = normalizeBlockType(op.blockType);
        if (norm && norm !== op.blockType) {
          warnings.push(`Mapped insert blockType "${op.blockType}" → "${norm}".`);
          op.blockType = norm;
        }
        if (!validBlockTypes.has(op.blockType)) {
          // Last-resort — even normalize couldn't save it. Convert to custom
          // instead of dropping (the user's intent matters more than the type).
          warnings.push(`Coerced unknown insert blockType to "custom".`);
          op.blockType = "custom";
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
      }
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
      case "queue_review_block": {
        // v3.17 (2026-05-30) — manual review-queue op.
        const opR = op as any;
        const hasSubject = opR.subjectSlug && subjectSlugs.has(opR.subjectSlug);
        const hasTopic = typeof opR.topic === "string" && opR.topic.trim().length >= 2;
        const hasCode =
          typeof opR.curriculumTopicCode === "string" &&
          topicCodes.has(opR.curriculumTopicCode.toUpperCase());
        if (!hasSubject && !hasTopic && !hasCode) {
          warnings.push(
            "Dropped queue_review_block op: must specify subjectSlug, topic, or curriculumTopicCode.",
          );
          continue;
        }
        if (opR.subjectSlug && !subjectSlugs.has(opR.subjectSlug)) {
          warnings.push(
            `Dropped unknown subject "${opR.subjectSlug}" on queue_review_block.`,
          );
          opR.subjectSlug = null;
        }
        if (opR.curriculumTopicCode && !hasCode) {
          warnings.push(
            `Dropped unknown topic code "${opR.curriculumTopicCode}" on queue_review_block.`,
          );
          opR.curriculumTopicCode = null;
        }
        if (opR.durationMin != null) {
          const n = Math.floor(opR.durationMin);
          if (!Number.isFinite(n) || n < 5 || n > 90) {
            warnings.push(
              `Clamped queue_review_block durationMin ${opR.durationMin} into [5,90].`,
            );
            opR.durationMin = Math.max(5, Math.min(90, Number.isFinite(n) ? n : 25));
          } else {
            opR.durationMin = n;
          }
        }
        if (opR.afterBlockId != null && !blockIds.has(opR.afterBlockId)) {
          warnings.push(
            `queue_review_block afterBlockId ${opR.afterBlockId} not found — will append at end of day.`,
          );
          opR.afterBlockId = null;
        }
        cleanOps.push(op);
        break;
      }
      case "generate_worksheet": {
        // v3.16 (2026-05-30) — custom worksheet attachment.
        if (!op.topic || op.topic.trim().length < 3) {
          warnings.push("Dropped generate_worksheet op missing `topic`.");
          continue;
        }
        if (op.targetBlockId != null && !blockIds.has(op.targetBlockId)) {
          warnings.push(
            `generate_worksheet targetBlockId ${op.targetBlockId} not found — will create a new block.`,
          );
          (op as any).targetBlockId = null;
        }
        if (op.subjectSlug && !subjectSlugs.has(op.subjectSlug)) {
          warnings.push(`Dropped unknown subject "${op.subjectSlug}" on generate_worksheet.`);
          (op as any).subjectSlug = null;
        }
        if (op.questionCount != null) {
          const n = Math.floor(op.questionCount);
          if (!Number.isFinite(n) || n < 1 || n > 50) {
            warnings.push(`Clamped generate_worksheet questionCount ${op.questionCount} into [1,50].`);
            (op as any).questionCount = Math.max(1, Math.min(50, Number.isFinite(n) ? n : 8));
          } else {
            (op as any).questionCount = n;
          }
        }
        if (op.style && !["practice", "quiz", "review", "writing-prompt"].includes(op.style)) {
          warnings.push(`Dropped invalid style "${op.style}" on generate_worksheet.`);
          (op as any).style = "practice";
        }
        cleanOps.push(op);
        break;
      }
      case "offer_options": {
        // v1 (2026-06-17) — "several ways → pick one". Writes nothing; just
        // validates the candidate list before the chat returns it to the UI.
        const raw = Array.isArray((op as any).options) ? (op as any).options : [];
        const clean = raw
          .filter((o: any) => o && typeof o === "object" && typeof o.title === "string" && o.title.trim().length > 0)
          .slice(0, 6)
          .map((o: any) => {
            const bt = normalizeBlockType(o.blockType) || (validBlockTypes.has(o.blockType) ? o.blockType : "adventure");
            let dur = Math.floor(Number(o.durationMin));
            if (!Number.isFinite(dur)) dur = 30;
            dur = Math.max(5, Math.min(180, dur));
            const slug = typeof o.subjectSlug === "string" && subjectSlugs.has(o.subjectSlug) ? o.subjectSlug : null;
            return {
              title: String(o.title).trim().slice(0, 120),
              description: typeof o.description === "string" ? o.description.trim().slice(0, 400) : "",
              blockType: bt,
              subjectSlug: slug,
              durationMin: dur,
            };
          });
        if (clean.length < 2) {
          warnings.push("Dropped offer_options op with fewer than 2 valid choices.");
          continue;
        }
        (op as any).options = clean;
        (op as any).prompt = typeof (op as any).prompt === "string" && (op as any).prompt.trim()
          ? String((op as any).prompt).trim().slice(0, 200)
          : "Pick one:";
        cleanOps.push(op);
        break;
      }
    }
  }

  return { ...plan, ops: cleanOps, warnings };
}

/**
 * If the LLM returned a non-empty plan but validation stripped everything,
 * rewrite the summary so the user understands WHY the diff is empty instead
 * of seeing a misleading "I changed things" header on top of a 0-change diff.
 * This is the May 5 "Apply 0 changes" bug guard.
 */
export function annotateNoOpDiff(
  validated: AgendaEditPlan,
  llmRaw: AgendaEditPlan | null,
): AgendaEditPlan {
  const validatedOps = validated.ops?.length ?? 0;
  const rawOps = llmRaw?.ops?.length ?? 0;
  if (validatedOps === 0 && rawOps > 0) {
    return {
      ...validated,
      summary:
        `The AI proposed ${rawOps} edit(s) but every op was rejected by validation. ` +
        `See warnings below — try rephrasing more specifically (e.g. name the block).`,
      warnings: [
        ...(validated.warnings ?? []),
        `[debug] Original LLM ops: ${JSON.stringify(llmRaw?.ops ?? []).slice(0, 400)}`,
      ],
    };
  }
  if (validatedOps === 0 && !validated.refusalReason) {
    return {
      ...validated,
      summary: validated.summary || "No change needed for that request.",
    };
  }
  return validated;
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
      case "queue_review_block": {
        // v3.17 (2026-05-30) — synthesize a catch-up block for review.
        const opR = op as any;
        const subjectName = opR.subjectSlug
          ? (ctx.subjects.find((s) => s.slug === opR.subjectSlug)?.name ?? opR.subjectSlug)
          : null;
        const topicLabel = opR.topic ?? opR.curriculumTopicCode ?? subjectName ?? "this material";
        const title = `Review: ${topicLabel}`;
        const descParts = [
          `Catch-up review on ${topicLabel}.`,
          opR.reason ? `Why: ${opR.reason}.` : null,
          "Pull a few practice problems from her current ladder row and check her work together.",
        ].filter(Boolean);
        const fresh: AgendaBlockSnapshot = {
          id: nextSyntheticId--,
          title,
          description: descParts.join(" "),
          blockType: "catch_up",
          startTime: null,
          durationMin: opR.durationMin ?? 25,
          sortOrder: 0,
          status: "not_started",
          subjectSlug: opR.subjectSlug ?? null,
          curriculumTopicCode: opR.curriculumTopicCode ?? null,
        };
        if (opR.afterBlockId == null) {
          next.push(fresh);
        } else {
          const idx = next.findIndex((b) => b.id === opR.afterBlockId);
          if (idx < 0) next.push(fresh);
          else next.splice(idx + 1, 0, fresh);
        }
        break;
      }
    }
  }

  return next.map((b, i) => ({ ...b, sortOrder: i }));
}

/**
 * Ask the LLM for an edit plan. Caller is expected to validate + preview.
 *
 * @param attachment optional image/pdf the adult attached (S3 URL + mime type).
 *                   When present it is added to the user message as multimodal
 *                   content so the LLM can read the worksheet/page directly.
 */
export async function generateAgendaEditPlan(
  ctx: AgendaPlanContext,
  instruction: string,
  attachment?: { url: string; mimeType: string },
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

  const userContent: any = attachment
    ? [
        { type: "text", text: userMsg },
        attachment.mimeType.startsWith("image/")
          ? { type: "image_url", image_url: { url: attachment.url, detail: "high" } }
          : { type: "file_url", file_url: { url: attachment.url, mime_type: attachment.mimeType } },
      ]
    : userMsg;

  // 45-second hard timeout so the UI spinner can never hang forever.
  // If the gateway / model takes longer, we fall back to the deterministic
  // keyword planner so common requests STILL apply instead of returning a
  // "took too long" no-op (the root cause of "the editor never works").
  const TIMEOUT_MS = 45_000;
  let resp: any;
  try {
    resp = await Promise.race([
      invokeLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        // CRITICAL latency fix: the edit plan is a tiny JSON payload, but the
        // shared invokeLLM helper otherwise lets the model emit up to 32k
        // output tokens, which routinely blew past the timeout. Cap it small.
        max_tokens: 1500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agenda_edit_plan",
            // NOTE: not `strict: true` because we need oneOf + per-op required
            // fields, and the OpenAI strict mode forbids oneOf at the moment.
            // Validation still happens in validateEditPlan() server-side.
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                intent: { type: "string", enum: ["vibe", "targeted", "surgical", "bulk", "add", "remove", "mixed"] },
                ops: {
                  type: "array",
                  items: {
                    type: "object",
                    // The discriminator field is REQUIRED. This alone fixes the
                    // May 7 "7 empty {} ops\" bug — the model can no longer
                    // emit `{}` placeholders.
                    properties: {
                      kind: {
                        type: "string",
                        enum: ["update", "delete", "insert", "reorder", "shiftAll", "generate_worksheet", "queue_review_block", "offer_options"],
                      },
                      // ---- update fields ----
                      id: { type: "number" },
                      title: { type: "string" },
                      description: { type: ["string", "null"] },
                      blockType: { type: "string" },
                      startTime: { type: ["string", "null"] },
                      durationMin: { type: "number" },
                      subjectSlug: { type: ["string", "null"] },
                      curriculumTopicCode: { type: ["string", "null"] },
                      // ---- insert extra ----
                      afterBlockId: { type: ["number", "null"] },
                      // ---- reorder ----
                      orderedIds: {
                        type: "array",
                        items: { type: "number" },
                      },
                      // ---- shiftAll ----
                      minutes: { type: "number" },
                      // ---- generate_worksheet ----
                      targetBlockId: { type: ["number", "null"] },
                      topic: { type: ["string", "null"] },
                      gradeLevel: { type: ["string", "null"] },
                      questionCount: { type: "number" },
                      style: { type: "string", enum: ["practice", "quiz", "review", "writing-prompt"] },
                      sourceAttachmentUrl: { type: ["string", "null"] },
                      // ---- queue_review_block ----
                      reason: { type: ["string", "null"] },
                      // ---- offer_options ----
                      prompt: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            blockType: { type: "string" },
                            subjectSlug: { type: ["string", "null"] },
                            durationMin: { type: "number" },
                          },
                          required: ["title"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["kind"],
                    additionalProperties: false,
                  },
                },
                warnings: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "intent", "ops", "warnings"],
              additionalProperties: false,
            },
          },
        },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("LLM_TIMEOUT")), TIMEOUT_MS)),
    ]);
  } catch (err: any) {
    const isTimeout = String(err?.message || "").includes("LLM_TIMEOUT");
    // Don't give up — try the deterministic planner so the request still lands.
    const fb = buildDeterministicEditPlan(ctx, instruction);
    if (fb.ops.length > 0) {
      return {
        ...fb,
        warnings: [
          ...(fb.warnings ?? []),
          isTimeout
            ? "The AI was slow, so I applied this with the built-in planner."
            : "The AI was unreachable, so I applied this with the built-in planner.",
        ],
      };
    }
    // No deterministic edit either — if it's a question, try answering.
    const answered = await maybeAnswerInstead(ctx, instruction, attachment);
    if (answered) return answered;
    return {
      summary: isTimeout
        ? "The AI took too long and I couldn't map that request automatically. Try naming the block or subject (e.g. \"add a 30 min math block at 9am\")."
        : `The AI couldn't be reached (${String(err?.message || err).slice(0, 120)}). Try again, or use the manual editor below.`,
      intent: "vibe",
      ops: [],
      warnings: [isTimeout ? "timeout" : "upstream-error"],
    };
  }

  let parsed: AgendaEditPlan;
  try {
    const content = (resp as any)?.choices?.[0]?.message?.content ?? "{}";
    parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch (e) {
    const fb = buildDeterministicEditPlan(ctx, instruction);
    if (fb.ops.length > 0) return fb;
    const answered = await maybeAnswerInstead(ctx, instruction, attachment);
    if (answered) return answered;
    return {
      summary: "Could not understand instruction.",
      intent: "vibe",
      ops: [],
      warnings: ["The AI could not produce a valid edit plan. Try rephrasing."],
    };
  }
  const validated = validateEditPlan(parsed, ctx);
  const annotated = annotateNoOpDiff(validated, parsed);
  // Final safety net: if the LLM came back with zero usable ops but the
  // instruction clearly maps to a deterministic edit, apply that instead of
  // surfacing an empty diff. This is what makes the editor feel like it
  // "always works" for everyday requests.
  if ((annotated.ops?.length ?? 0) === 0) {
    const fb = buildDeterministicEditPlan(ctx, instruction);
    if (fb.ops.length > 0) {
      return {
        ...fb,
        warnings: [...(fb.warnings ?? []), ...(annotated.warnings ?? [])].slice(0, 12),
      };
    }
    // 2026-06-29 ANSWER MODE: the model found no edit to make and the
    // deterministic planner had nothing either. If this reads like a
    // question / general request, answer it conversationally instead of
    // returning a confusing empty "nothing changed" diff.
    const hasOffered = (annotated.ops ?? []).some((o) => o.kind === "offer_options");
    if (!hasOffered && !annotated.refusalReason) {
      const answered = await maybeAnswerInstead(ctx, instruction, attachment);
      if (answered) return answered;
    }
  }
  return annotated;
}

/**
 * 2026-06-29 — Route a non-edit message to a conversational answer.
 * Returns an answer-mode AgendaEditPlan, or null when the message does not
 * look like a question (so the caller keeps the normal empty-diff behavior).
 *
 * `db` is lazily imported to avoid a static import cycle with the very large
 * db.ts (agendaEditor is imported by routers which imports db).
 */
export async function maybeAnswerInstead(
  ctx: AgendaPlanContext,
  instruction: string,
  attachment?: { url: string; mimeType: string },
): Promise<AgendaEditPlan | null> {
  const { isLikelyQuestion, generateAgendaAnswer } = await import("./agendaAnswer");
  if (!isLikelyQuestion(instruction)) return null;
  const db = await import("../db");
  const answer = await generateAgendaAnswer(ctx, instruction, db, attachment);
  return {
    summary: answer,
    intent: "vibe",
    ops: [],
    warnings: [],
    answer,
    mode: "answer",
  };
}

/**
 * Deterministic, no-LLM agenda editor used as a fallback when the model times
 * out, errors, or returns zero usable ops. It covers the everyday requests
 * Mom/Grandma actually type, so the editor never silently does nothing:
 *   - "shorter / lighter", "longer"            -> proportional durationMin updates
 *   - "more math", "less science", "+10 to ela" -> subject-targeted updates
 *   - "no science today", "drop math"          -> delete matching blocks
 *   - "start at 9", "begin 9:30"               -> shiftAll to that start
 *   - "push everything 15 min later/earlier"    -> shiftAll by minutes
 *   - "add a 30 min math block at 9am"          -> insert op
 * Every op is run back through validateEditPlan by the caller path's apply
 * logic, but we also build legal ops here so they pass validation directly.
 */
export function buildDeterministicEditPlan(
  ctx: AgendaPlanContext,
  instruction: string,
): AgendaEditPlan {
  const text = (instruction || "").trim();
  const lower = text.toLowerCase();
  const ops: AgendaEditOp[] = [];
  const warnings: string[] = [];
  const editable = ctx.blocks.filter((b) => b.status !== "complete");

  const SUBJECT_WORD_TO_SLUG: Record<string, string> = {
    math: "math", mathematics: "math", arithmetic: "math",
    ela: "ela", reading: "ela", writing: "ela", language: "ela",
    spelling: "ela", grammar: "ela", phonics: "ela",
    science: "science",
    social: "social-studies", history: "social-studies", geography: "social-studies",
    art: "specials", music: "specials", pe: "specials", movement: "specials",
  };
  const knownSlugs = new Set(ctx.subjects.map((s) => s.slug));
  const resolveSlug = (word?: string): string | null => {
    if (!word) return null;
    const slug = SUBJECT_WORD_TO_SLUG[word.toLowerCase()] ?? word.toLowerCase();
    return slug;
  };

  const blockMatchesSubject = (b: AgendaBlockSnapshot, slug: string): boolean => {
    if (b.subjectSlug === slug) return true;
    // Fall back to blockType heuristics when subjectSlug isn't set.
    if (slug === "math" && b.blockType === "math") return true;
    if (slug === "ela" && (b.blockType === "read_aloud")) return true;
    return false;
  };

  // ---- 1. Explicit "add a block" --------------------------------------
  // e.g. "add a 30 minute math block at 9am about fractions"
  const addMatch = /\b(add|insert|create|put in)\b/.test(lower);
  if (addMatch) {
    const durMatch = lower.match(/(\d{1,3})\s*(?:min|minute|minutes|m)\b/);
    const dur = durMatch ? Math.max(5, Math.min(180, parseInt(durMatch[1], 10))) : 30;
    // start time like "9am", "9:30", "at 14:00"
    let startTime: string | null = null;
    const t12 = lower.match(/\bat\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (t12) {
      let hh = parseInt(t12[1], 10);
      const mm = t12[2] ? parseInt(t12[2], 10) : 0;
      const mer = t12[3];
      if (mer === "pm" && hh < 12) hh += 12;
      if (mer === "am" && hh === 12) hh = 0;
      if (hh >= 0 && hh < 24 && mm < 60) {
        startTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
    }
    // subject / block type
    let subjectSlug: string | null = null;
    for (const word of Object.keys(SUBJECT_WORD_TO_SLUG)) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) { subjectSlug = resolveSlug(word); break; }
    }
    let blockType = "custom";
    if (subjectSlug === "math") blockType = "math";
    else if (subjectSlug === "ela") blockType = "read_aloud";
    else if (/\b(adventure|walk|nature|outdoor|outside|explore)\b/.test(lower)) blockType = "adventure";
    else if (/\b(read aloud|story|book|reading)\b/.test(lower)) blockType = "read_aloud";
    else if (/\b(break|snack|free|choice|rest)\b/.test(lower)) blockType = "choice";
    else if (/\b(warm.?up|morning)\b/.test(lower)) blockType = "morning_warmup";
    // crude topic: text after "about" / "on"
    const topicM = text.match(/\b(?:about|on|for)\s+([^.,;]{3,60})/i);
    const topic = topicM ? topicM[1].trim() : null;
    const subjName = subjectSlug
      ? (ctx.subjects.find((s) => s.slug === subjectSlug)?.name ?? subjectSlug)
      : null;
    const title = topic
      ? `${subjName ? subjName + ": " : ""}${topic.charAt(0).toUpperCase()}${topic.slice(1)}`
      : `${subjName ?? "New"} block`;
    ops.push({
      kind: "insert",
      title,
      description: topic ? `Work on ${topic}.` : null,
      blockType,
      startTime,
      durationMin: dur,
      subjectSlug,
      afterBlockId: null,
    });
  }

  // ---- 2. Start-at / shift everything ---------------------------------
  const startAt = lower.match(/\b(?:start|begin|starts?|beginning)\b[^0-9]*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (startAt && editable.some((b) => b.startTime)) {
    let hh = parseInt(startAt[1], 10);
    const mm = startAt[2] ? parseInt(startAt[2], 10) : 0;
    const mer = startAt[3];
    if (mer === "pm" && hh < 12) hh += 12;
    if (mer === "am" && hh === 12) hh = 0;
    if (hh >= 0 && hh < 24 && mm < 60) {
      const timed = editable.filter((b) => b.startTime).map((b) => b.startTime!);
      const earliest = timed.sort()[0];
      const em = earliest.match(/^(\d{1,2}):(\d{2})$/);
      if (em) {
        const earliestMin = parseInt(em[1], 10) * 60 + parseInt(em[2], 10);
        const targetMin = hh * 60 + mm;
        const delta = targetMin - earliestMin;
        if (delta !== 0) ops.push({ kind: "shiftAll", minutes: delta });
      }
    }
  } else {
    const shiftM = lower.match(/\b(?:push|move|shift|everything|all)\b[^0-9]*?(\d{1,3})\s*(?:min|minute|minutes|m)\s*(later|earlier)?/);
    if (shiftM) {
      const mins = parseInt(shiftM[1], 10);
      const dir = shiftM[2] === "earlier" ? -1 : 1;
      if (mins > 0) ops.push({ kind: "shiftAll", minutes: mins * dir });
    }
  }

  // ---- 3. Drop a subject ----------------------------------------------
  const dropM = lower.match(/\b(?:no|skip|drop|cancel|remove)\s+(math|ela|reading|writing|science|social|history|art|music|pe)\b/);
  if (dropM) {
    const slug = resolveSlug(dropM[1]);
    if (slug) {
      for (const b of editable) {
        if (blockMatchesSubject(b, slug)) ops.push({ kind: "delete", id: b.id });
      }
      if (!ops.some((o) => o.kind === "delete")) {
        warnings.push(`No ${slug} block found to remove.`);
      }
    }
  }

  // ---- 4. Vibe / subject duration changes (keyword parser) ------------
  // Run these UNLESS we already produced a shift or delete op (those are
  // structurally incompatible with simultaneous proportional reshaping in a
  // single deterministic pass). An `insert` from step 1 is fine to combine
  // with "shorter"/"more math" so multi-part requests like "make today
  // shorter and add a nature walk" apply BOTH parts.
  const hasShiftOrDelete = ops.some((o) => o.kind === "shiftAll" || o.kind === "delete");
  if (!hasShiftOrDelete) {
    const directives: Directive[] = parseAgendaPromptToDirectives(text);
    for (const dir of directives) {
      switch (dir.kind) {
        case "shortenAll":
          for (const b of editable) {
            const after = Math.max(10, Math.round(b.durationMin * 0.75));
            if (after !== b.durationMin) ops.push({ kind: "update", id: b.id, durationMin: after });
          }
          break;
        case "lengthenAll":
          for (const b of editable) {
            const after = Math.min(120, Math.round(b.durationMin * 1.25));
            if (after !== b.durationMin) ops.push({ kind: "update", id: b.id, durationMin: after });
          }
          break;
        case "bumpDurationFor":
        case "focusSubject": {
          const slug = dir.subjectSlug!;
          const delta = dir.deltaMin ?? 10;
          for (const b of editable) {
            if (!blockMatchesSubject(b, slug)) continue;
            const after = Math.min(120, b.durationMin + delta);
            if (after !== b.durationMin) ops.push({ kind: "update", id: b.id, durationMin: after });
          }
          break;
        }
        case "trimDurationFor":
        case "deprioritizeSubject": {
          const slug = dir.subjectSlug!;
          const delta = dir.deltaMin ?? 10;
          for (const b of editable) {
            if (!blockMatchesSubject(b, slug)) continue;
            const after = Math.max(10, b.durationMin - delta);
            if (after !== b.durationMin) ops.push({ kind: "update", id: b.id, durationMin: after });
          }
          break;
        }
        case "removeSubjectToday": {
          const slug = dir.subjectSlug!;
          for (const b of editable) {
            if (blockMatchesSubject(b, slug)) ops.push({ kind: "delete", id: b.id });
          }
          break;
        }
        case "easeUp":
        case "amplifyFun":
          // No structural change we can make safely without the LLM; trim
          // academic blocks a touch so the day feels lighter.
          for (const b of editable) {
            if (b.blockType === "math" || b.blockType === "read_aloud" || b.blockType === "custom") {
              const after = Math.max(10, Math.round(b.durationMin * 0.85));
              if (after !== b.durationMin) ops.push({ kind: "update", id: b.id, durationMin: after });
            }
          }
          break;
      }
    }
  }

  const summary = ops.length === 0
    ? "I couldn't map that to an automatic edit — try naming a block, subject, time, or duration."
    : `Applied ${ops.length} change${ops.length === 1 ? "" : "s"} with the built-in planner.`;
  const validated = validateEditPlan(
    { summary, intent: "mixed", ops, warnings },
    ctx,
  );
  return validated;
}
