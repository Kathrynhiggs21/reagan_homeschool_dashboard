/**
 * AI Schedule Proposer (free-form prompt → diff)
 *
 * Given a date, the EXISTING scheduleBlocks for that date, and a free-form
 * adult prompt like "make today shorter" or "swap math for art", ask the LLM
 * to produce a per-block decision list:
 *
 *   - keep    — existing block stays as-is
 *   - modify  — existing block changes (one or more fields)
 *   - remove  — existing block is dropped
 *   - add     — a brand-new block, optionally anchored after an existing one
 *
 * The proposer ONLY returns data — never writes to the DB. The caller (the
 * `plans.aiApplyProposal` mutation) decides which decisions to honor based on
 * what Mom or Grandma accepted in the UI.
 *
 * Pure-ish module: depends on the platform invokeLLM helper. All DB
 * persistence happens in `server/routers.ts`.
 */
import { invokeLLM } from "../_core/llm";
import { buildSeasonalProfile, renderSeasonalPromptFragment } from "./seasonalProfile";
import {
  ALLOWED_BLOCK_TYPES,
  type AllowedBlockType,
  type AIBlockDraft,
  type AISubject,
  sanitizeBlocks,
} from "./aiScheduleGenerator";

/* ------------------------------ public types ------------------------------ */

export type ExistingBlockSnapshot = {
  id: number;
  blockType: AllowedBlockType;
  title: string;
  description: string | null;
  durationMin: number;
  startTime: string | null;
  subjectSlug: string | null;
  curriculumTopicCode: string | null;
  sortOrder: number;
};

/**
 * One decision in the proposal. The shape is a tagged union — kind tells the
 * UI / mutation handler what to render and what to apply.
 */
export type ProposalDecision =
  | { kind: "keep"; existingBlockId: number; reason: string }
  | {
      kind: "modify";
      existingBlockId: number;
      before: AIBlockDraft;
      after: AIBlockDraft;
      reason: string;
    }
  | { kind: "remove"; existingBlockId: number; reason: string }
  | {
      kind: "add";
      after: AIBlockDraft;
      /** Insert the new block immediately after this existing block's sortOrder. null = at the end. */
      insertAfterSortOrder: number | null;
      reason: string;
    };

export type ProposalInput = {
  dateStr: string;
  dayLabel: string;
  studentName: string;
  adultPrompt: string;
  subjects: AISubject[];
  existingBlocks: ExistingBlockSnapshot[];
  /** Defaults to "Reagan" if missing. */
  gradeLevel?: string | null;
};

export type ProposalResult = {
  summary: string;
  decisions: ProposalDecision[];
  warnings: string[];
};

/* ------------------------------ pure helpers ------------------------------ */

/** Reduce an existing-block snapshot to the AIBlockDraft shape (for `before` payloads). */
export function snapshotToBlockDraft(b: ExistingBlockSnapshot): AIBlockDraft {
  return {
    blockType: b.blockType,
    title: b.title,
    description: b.description ?? "",
    durationMin: b.durationMin,
    startTime: b.startTime ?? undefined,
    subjectSlug: b.subjectSlug ?? null,
    curriculumTopicCode: b.curriculumTopicCode ?? null,
  };
}

/**
 * Sanitize the LLM's proposal payload. NEVER throws — bad input becomes a
 * warning + skipped decision. Returns only well-formed decisions that
 * reference real existing block ids (for keep/modify/remove) or carry a
 * complete `after` block (for add).
 */
export function sanitizeProposal(
  raw: any,
  existingBlocks: ExistingBlockSnapshot[],
  validSlugs: Set<string>,
): { decisions: ProposalDecision[]; warnings: string[]; summary: string } {
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { decisions: [], warnings: ["LLM returned non-object proposal"], summary: "" };
  }

  const existingIds = new Set(existingBlocks.map((b) => b.id));
  const existingById = new Map(existingBlocks.map((b) => [b.id, b]));
  const existingSortOrders = new Set(existingBlocks.map((b) => b.sortOrder));

  const decisions: ProposalDecision[] = [];
  const seenExistingIds = new Set<number>();

  const rawDecisions = Array.isArray(raw.decisions) ? raw.decisions : null;
  if (!rawDecisions) {
    return { decisions: [], warnings: ["LLM proposal has no `decisions` array"], summary: typeof raw.summary === "string" ? raw.summary : "" };
  }

  for (const d of rawDecisions) {
    if (!d || typeof d !== "object") continue;
    const kind = String(d.kind || "").trim();
    const reason = String(d.reason || "").trim().slice(0, 500);

    if (kind === "keep" || kind === "remove") {
      const id = Number(d.existingBlockId);
      if (!Number.isFinite(id) || !existingIds.has(id)) {
        warnings.push(`${kind} decision skipped — existingBlockId ${d.existingBlockId} not found in current blocks`);
        continue;
      }
      if (seenExistingIds.has(id)) {
        warnings.push(`${kind} decision skipped — existingBlockId ${id} already has a decision`);
        continue;
      }
      seenExistingIds.add(id);
      decisions.push({ kind, existingBlockId: id, reason } as ProposalDecision);
      continue;
    }

    if (kind === "modify") {
      const id = Number(d.existingBlockId);
      if (!Number.isFinite(id) || !existingIds.has(id)) {
        warnings.push(`modify decision skipped — existingBlockId ${d.existingBlockId} not found`);
        continue;
      }
      if (seenExistingIds.has(id)) {
        warnings.push(`modify decision skipped — existingBlockId ${id} already has a decision`);
        continue;
      }
      const sanitized = sanitizeBlocks([d.after], validSlugs);
      if (sanitized.warnings.length > 0) warnings.push(...sanitized.warnings);
      const after = sanitized.blocks[0];
      if (!after) {
        warnings.push(`modify decision skipped — invalid \`after\` payload for blockId ${id}`);
        continue;
      }
      const existing = existingById.get(id)!;
      seenExistingIds.add(id);
      decisions.push({
        kind: "modify",
        existingBlockId: id,
        before: snapshotToBlockDraft(existing),
        after,
        reason,
      });
      continue;
    }

    if (kind === "add") {
      const sanitized = sanitizeBlocks([d.after], validSlugs);
      if (sanitized.warnings.length > 0) warnings.push(...sanitized.warnings);
      const after = sanitized.blocks[0];
      if (!after) {
        warnings.push("add decision skipped — invalid `after` payload");
        continue;
      }
      let insertAfterSortOrder: number | null = null;
      if (d.insertAfterSortOrder === null || d.insertAfterSortOrder === undefined) {
        insertAfterSortOrder = null;
      } else {
        const so = Number(d.insertAfterSortOrder);
        if (!Number.isFinite(so) || !existingSortOrders.has(so)) {
          warnings.push(`add decision: insertAfterSortOrder ${d.insertAfterSortOrder} not found in current blocks; appending to end`);
          insertAfterSortOrder = null;
        } else {
          insertAfterSortOrder = so;
        }
      }
      decisions.push({ kind: "add", after, insertAfterSortOrder, reason });
      continue;
    }

    warnings.push(`unknown decision kind "${d.kind}" — skipped`);
  }

  // If the LLM didn't mention every existing block, treat unmentioned ones as
  // implicit `keep` so the UI shows a complete picture (no silent drops).
  for (const b of existingBlocks) {
    if (!seenExistingIds.has(b.id)) {
      decisions.push({ kind: "keep", existingBlockId: b.id, reason: "(unchanged)" });
    }
  }

  const summary = typeof raw.summary === "string" ? raw.summary.slice(0, 1000) : "";
  return { decisions, warnings, summary };
}

/** Build the LLM messages array. Exported for unit tests. */
export function buildProposalPromptMessages(input: ProposalInput) {
  const blockTypesList = ALLOWED_BLOCK_TYPES.map((t) => `"${t}"`).join(", ");
  const subjectsList = input.subjects.map((s) => `- ${s.slug} (${s.name})`).join("\n");

  // v2.97 (2026-05-27) — Seasonal-aware proposer. Bake the active profile into
  // the system prompt so commands like "long focused day" properly override
  // and commands like "start later" inherit the seasonal default start time
  // (10:00 in summer, 8:30 school-year).
  const parsedDate = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.dateStr ?? "");
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  })();
  const seasonal = buildSeasonalProfile(parsedDate);
  const seasonalFragment = renderSeasonalPromptFragment(seasonal);

  const existingList = input.existingBlocks
    .map(
      (b) =>
        `  { "id": ${b.id}, "sortOrder": ${b.sortOrder}, "blockType": "${b.blockType}", "title": ${JSON.stringify(b.title)}, "durationMin": ${b.durationMin}, "subjectSlug": ${JSON.stringify(b.subjectSlug)}, "description": ${JSON.stringify((b.description ?? "").slice(0, 280))} }`,
    )
    .join(",\n");

  const system = `You are helping a parent, grandparent, or tutor edit a homeschool day's schedule for Reagan.

You are NOT generating from scratch — you are editing an EXISTING list
of blocks. Return decisions for each existing block (keep / modify / remove),
plus any new blocks to add.

${seasonalFragment}

Allowed blockType values: ${blockTypesList}
Valid subject slugs:
${subjectsList || "(none)"}

Honor the adult's intent. Be conservative — only modify or remove a block
when the prompt clearly asks for that. Default to keep.

INTERPRET FREE-FORM ADULT REQUESTS LIBERALLY:
- "Start at 9:30" / "start later" / "begin at 11am"     → shift all block startTimes accordingly
- "End by 2pm" / "short day" / "long day" / "focused day" → adjust durations + block count to fit
- "Crush math" / "math focus" / "all math today"          → replace non-academic blocks with math deep-dive blocks
- "Only ELA and science"                                     → keep those subjects, replace others with adventure/choice
- "More hands-on" / "outdoor day" / "field trip"           → swap worksheet blocks for project/outdoor/maker activities
- "Add a break after lunch" / "break at 11"                  → insert an appointment block at the right slot
- "Move math to the morning"                                 → reorder by sortOrder
- "Make it easier" / "sick day" / "low energy"             → trim duration, drop one block, keep gentle ones
- "Make it harder" / "challenge day"                         → increase duration slightly + replace warmup with extension block
When the request conflicts with the seasonal default (e.g. user says "long focused day" in summer), HONOR THE USER OVERRIDE.

Output a JSON object with this exact shape:
{
  "summary": "1-2 sentence rationale for the parent",
  "decisions": [
    { "kind": "keep",   "existingBlockId": 12,                      "reason": "matches the prompt" },
    { "kind": "modify", "existingBlockId": 13, "after": { ... AIBlockDraft fields ... }, "reason": "shorter math per prompt" },
    { "kind": "remove", "existingBlockId": 14,                      "reason": "user asked to drop it" },
    { "kind": "add",    "after": { ... AIBlockDraft fields ... }, "insertAfterSortOrder": 3, "reason": "filling the gap" }
  ]
}

The "after" object for modify and add must be a complete block draft:
  { "blockType": one of allowed, "title": string, "description": string,
    "durationMin": number 1-180, "subjectSlug": string|null,
    "curriculumTopicCode": string|null, "startTime": "HH:MM"|null }

Do NOT invent existingBlockIds. Only use ids from the list below.`;

  const user = `Date: ${input.dateStr} (${input.dayLabel})
Student: ${input.studentName}${input.gradeLevel ? ` (${input.gradeLevel})` : ""}

Parent's edit request:
"""
${input.adultPrompt}
"""

Existing blocks for this day:
[
${existingList}
]

Return the JSON proposal now.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

/* --------------------------- main entry point ---------------------------- */

export async function proposeScheduleEdit(input: ProposalInput): Promise<ProposalResult> {
  const validSlugs = new Set(input.subjects.map((s) => s.slug));

  // Fast path: no prompt → return all-keep proposal without touching the LLM.
  if (!input.adultPrompt || !input.adultPrompt.trim()) {
    return {
      summary: "(no prompt provided — nothing to change)",
      decisions: input.existingBlocks.map((b) => ({
        kind: "keep" as const,
        existingBlockId: b.id,
        reason: "(no prompt)",
      })),
      warnings: [],
    };
  }

  const messages = buildProposalPromptMessages(input);
  let parsed: any = null;
  let llmWarnings: string[] = [];

  try {
    const response = await invokeLLM({
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "schedule_edit_proposal",
          strict: false,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              decisions: { type: "array" },
            },
            required: ["summary", "decisions"],
            additionalProperties: true,
          },
        },
      } as any,
    });
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content);
      } catch {
        llmWarnings.push("LLM returned non-JSON content; falling back to all-keep");
      }
    } else {
      llmWarnings.push("LLM response had no string content; falling back to all-keep");
    }
  } catch (err) {
    llmWarnings.push(`LLM call failed: ${(err as Error)?.message || "unknown error"}`);
  }

  if (!parsed) {
    return {
      summary: "(could not generate a proposal — kept everything as-is)",
      decisions: input.existingBlocks.map((b) => ({
        kind: "keep" as const,
        existingBlockId: b.id,
        reason: "(LLM unavailable)",
      })),
      warnings: llmWarnings,
    };
  }

  const sanitized = sanitizeProposal(parsed, input.existingBlocks, validSlugs);
  return {
    summary: sanitized.summary,
    decisions: sanitized.decisions,
    warnings: [...llmWarnings, ...sanitized.warnings],
  };
}
