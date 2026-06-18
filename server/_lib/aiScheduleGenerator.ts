/**
 * AI Daily Schedule Generator
 *
 * Given a date, an optional adult prompt (e.g. "half day, focus on planets +
 * triangles"), and Reagan's profile context, ask the LLM to draft a structured
 * list of schedule blocks. Returns the raw blocks; the caller decides whether
 * to preview-only or commit them to the database.
 *
 * Pure-ish module — only depends on the platform's invokeLLM helper. All DB
 * persistence happens in server/routers.ts so this stays easy to test.
 */
import { invokeLLM } from "../_core/llm";
import { loadKnowledgeBundle } from "./knowledgeBundle";
import { layoutInsertedBlocks, type LayoutBlock } from "./agendaBudget";
import { normalizeDayStart } from "./dayStartSanity";
import { buildSeasonalProfile, renderSeasonalPromptFragment } from "./seasonalProfile";

export const ALLOWED_BLOCK_TYPES = [
  "morning_warmup",
  "math",
  "adventure",
  "read_aloud",
  "choice",
  "catch_up",
  "appointment",
  "custom",
] as const;
export type AllowedBlockType = typeof ALLOWED_BLOCK_TYPES[number];

export type AISubject = { slug: string; name: string };

export type AIBlockDraft = {
  blockType: AllowedBlockType;
  title: string;
  description: string;
  durationMin: number;
  startTime?: string;        // HH:MM 24h, optional
  subjectSlug?: string | null;
  /** Curriculum standard code (e.g. "5.OA.1", "RL.5.2"). REQUIRED for every academic block. */
  curriculumTopicCode?: string | null;
  /** Resolved at commit time from curriculumTopicCode against the live curriculumTopics table. */
  curriculumTopicId?: number | null;
};

export type AICurriculumTopicHint = {
  code: string;          // "5.OA.1"
  title: string;         // "Order of operations with parentheses"
  subjectSlug: string;   // "math"
  status: string;        // "notStarted" | "inProgress" | "done"
};

export type AIGenerateInput = {
  dateStr: string;            // YYYY-MM-DD
  dayLabel: string;           // "Friday, May 1" — for prompt
  studentName: string;
  gradeLevel?: string | null;
  interests?: string[];
  whatWorks?: string[];
  whatHarms?: string[];
  recentMoodNotes?: string[]; // last 3 strings, optional
  adultPrompt?: string | null; // free text from parent
  dayLength?: "full" | "half" | "off"; // hint for total minutes
  subjects: AISubject[];      // valid slugs the LLM may use
  /** Live, not-yet-done topics from curriculumTopics — the ONLY codes the LLM may use. */
  topicCatalog?: AICurriculumTopicHint[];
  /** Tutor + therapist windows for the day, surfaced in the prompt so blocks respect them. */
  tutorOfDay?: { name: string; arrival: string; departure: string; role?: string | null } | null;
  /** Reagan's owned printed books — the AI should reference these by page/chapter rather than inventing. */
  ownedBooks?: AIOwnedBookHint[];
  /**
   * Push 33 (2026-05-13) — Hard-reject mode.
   *
   * When true, the generator REJECTS any academic block returned by
   * the LLM that lacks a `curriculumTopicCode` and triggers a single
   * retry with a stricter system message reminding the model that
   * curriculumTopicCode is mandatory for academic blocks. The retry's
   * output is sanitized again; if academic blocks STILL come back
   * un-tagged, those rows are dropped (rather than committed un-tagged)
   * and the dropped count is surfaced in `warnings`.
   *
   * Default false preserves the existing warning-only behavior so
   * unit tests + offline calls keep working.
   */
  enforceTopic?: boolean;
  /**
   * v1 (2026-06-17) — Budget + start-anchor support for conversational prompts.
   * When the adult prompt states a start time ("start at 1pm") and/or a total
   * time window ("2–4 hours"), the caller parses them with agendaBudget.ts and
   * passes them here. The prompt surfaces them as explicit guidance, and a
   * deterministic post-pass (applyBudgetLayout) scales block durations to fit
   * the window and lays start times forward from the anchor — because the LLM
   * is unreliable at exact time math.
   */
  startTime?: string | null;          // "HH:MM" 24h anchor
  budgetMinMinutes?: number | null;    // lower bound of total work window
  budgetMaxMinutes?: number | null;    // upper bound of total work window
};

export type AIOwnedBookHint = {
  title: string;
  type: "workbook" | "novel" | "reference" | "audiobook" | "chapter_book";
  subjectSlug?: string | null;
  status: "not_started" | "in_progress" | "in_progress_unstructured" | "done" | "shelved";
  /** Suggested page span the scheduler should use today (already skips known-done pages). */
  suggestedPageSpan?: { from: number; to: number } | null;
  currentChapter?: number | null;
  totalChapters?: number | null;
  totalPages?: number | null;
  topicCodes?: string[];
  notes?: string | null;
};

export type AIGenerateResult = {
  blocks: AIBlockDraft[];
  summary: string;            // 1–2 sentence rationale for the parent
  warnings: string[];         // any subject slug it wanted to use but couldn't
};

/* ----------------------- pure helpers (unit-tested) ----------------------- */

/** Block types that MUST resolve to a curriculum topic code. */
const ACADEMIC_BLOCK_TYPES = new Set<AllowedBlockType>([
  "morning_warmup",
  "math",
  "read_aloud",
  "choice",
  "catch_up",
  "custom",
]);

/** Clamp + sanitize the LLM's raw block array. Drops invalid rows, never throws. */
export function sanitizeBlocks(
  raw: any,
  validSlugs: Set<string>,
  validTopicCodes?: Set<string>,
  dayLength?: "full" | "half" | "off",
): { blocks: AIBlockDraft[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { blocks: [], warnings: ["LLM returned non-array"] };
  const out: AIBlockDraft[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const blockType = String(r.blockType || "").trim() as AllowedBlockType;
    if (!ALLOWED_BLOCK_TYPES.includes(blockType)) {
      warnings.push(`skipped block — invalid blockType "${r.blockType}"`);
      continue;
    }
    const title = String(r.title || "").trim().slice(0, 200);
    if (!title) { warnings.push("skipped block — empty title"); continue; }
    const description = String(r.description || "").trim().slice(0, 4000);
    let durationMin = Number(r.durationMin);
    if (!Number.isFinite(durationMin) || durationMin <= 0) durationMin = 30;
    if (durationMin > 180) durationMin = 180;
    const startTime = typeof r.startTime === "string" && /^\d{1,2}:\d{2}$/.test(r.startTime)
      ? r.startTime.padStart(5, "0")
      : undefined;
    let subjectSlug: string | null | undefined = r.subjectSlug ? String(r.subjectSlug).trim().toLowerCase() : null;
    if (subjectSlug && !validSlugs.has(subjectSlug)) {
      warnings.push(`unknown subject slug "${subjectSlug}" — left blank`);
      subjectSlug = null;
    }
    let curriculumTopicCode: string | null = typeof r.curriculumTopicCode === "string"
      ? r.curriculumTopicCode.trim().toUpperCase().slice(0, 30)
      : null;
    if (curriculumTopicCode && validTopicCodes && validTopicCodes.size > 0 && !validTopicCodes.has(curriculumTopicCode)) {
      warnings.push(`block "${title}" — topicCode "${curriculumTopicCode}" not in catalog; cleared so commit step can prompt for one`);
      curriculumTopicCode = null;
    }
    // Advisory only — never blocks the schedule. Skip emission when no
    // catalog was supplied (offline use, unit tests, ad-hoc calls), so the
    // warning is reserved for real LLM output that should have grounded a
    // code from the live curriculum catalog.
    if (
      ACADEMIC_BLOCK_TYPES.has(blockType) &&
      !curriculumTopicCode &&
      validTopicCodes &&
      validTopicCodes.size > 0
    ) {
      warnings.push(`block "${title}" — academic block missing curriculumTopicCode; will need adult tag before scheduling`);
    }
    out.push({ blockType, title, description, durationMin, startTime, subjectSlug, curriculumTopicCode });
  }

  // 2026-05-30 — Day-length aware bounds. A homeschool day is 2–5 hours
  // / 4–10 blocks for a full day; half days run smaller; off days are empty.
  // Upper bound: hard cap (the LLM occasionally emits 16+ blocks despite the
  // seasonal hint). Lower bound: warning-only — we don't synthesize blocks,
  // we just flag so callers (or the user) can re-roll.
  const MAX_BLOCKS = 10;
  const MAX_TOTAL_MIN = 300; // 5 hours
  const capped: AIBlockDraft[] = [];
  let totalMin = 0;
  for (const b of out) {
    if (capped.length >= MAX_BLOCKS) {
      warnings.push(`dropped extra block "${b.title}" — day cap of ${MAX_BLOCKS} blocks reached`);
      continue;
    }
    if (totalMin + b.durationMin > MAX_TOTAL_MIN) {
      warnings.push(`dropped extra block "${b.title}" — day cap of ${MAX_TOTAL_MIN} min (5h) reached`);
      continue;
    }
    capped.push(b);
    totalMin += b.durationMin;
  }

  // Lower-bound advisory — only applies on full days. Off days are empty by
  // design; half days are intentionally smaller. We warn (not throw) so the
  // caller can decide whether to re-roll or accept a thin day.
  if (dayLength === "full" || dayLength === undefined) {
    const MIN_BLOCKS = 4;
    const MIN_TOTAL_MIN = 120; // 2 hours
    if (capped.length > 0 && capped.length < MIN_BLOCKS) {
      warnings.push(`thin day — only ${capped.length} block(s); a full day expects at least ${MIN_BLOCKS}`);
    }
    if (capped.length > 0 && totalMin < MIN_TOTAL_MIN) {
      warnings.push(`thin day — total ${totalMin} min; a full day expects at least ${MIN_TOTAL_MIN} min (2h)`);
    }
  }

  return { blocks: capped, warnings };
}

/**
 * v1 (2026-06-17) — Deterministic budget/start-anchor post-pass.
 *
 * After the LLM drafts blocks, this scales the flexible (non-appointment) block
 * durations so their total lands inside the adult's stated window and lays
 * start times forward from the anchor, flowing around appointment blocks (which
 * keep their own time). Capped at the existing 300-min/day ceiling so it can
 * never contradict sanitizeBlocks. A no-op when neither a start anchor nor a
 * budget was supplied, so existing callers are unaffected.
 */
export function applyBudgetLayout(
  blocks: AIBlockDraft[],
  opts: { startTime?: string | null; minMinutes?: number | null; maxMinutes?: number | null },
): AIBlockDraft[] {
  const hasAnchor = !!opts.startTime;
  const hasBudget = opts.minMinutes != null || opts.maxMinutes != null;
  if (blocks.length === 0) return blocks;
  // Even when there is no anchor/budget to lay out, the LLM may have emitted
  // per-block startTimes with an AM/PM mixup (morning blocks landing at 22:xx).
  // normalizeDayStart repairs only the corrupted leading evening run, so it is
  // safe to run unconditionally before any early return.
  if (!hasAnchor && !hasBudget) return normalizeDayStart(blocks).items;

  // Respect the day-wide 300-min ceiling enforced by sanitizeBlocks: never let
  // a budget push the total above it.
  const HARD_CAP = 300;
  const maxMinutes = opts.maxMinutes != null ? Math.min(opts.maxMinutes, HARD_CAP) : null;
  // Clamp the minimum to the ceiling too — a budget like "6 hours" (min=max=360)
  // must never scale the day above the 300-min/day cap sanitizeBlocks enforces.
  const minMinutes = opts.minMinutes != null ? Math.min(opts.minMinutes, HARD_CAP) : null;

  const layoutInput: LayoutBlock[] = blocks.map((b, i) => ({
    ref: i,
    durationMin: b.durationMin,
    fixed: b.blockType === "appointment",
    startTime: b.startTime ?? null,
  }));
  const laid = layoutInsertedBlocks(layoutInput, {
    startTime: opts.startTime ?? null,
    minMinutes,
    maxMinutes,
  });
  const byRef = new Map(laid.map((l) => [l.ref, l]));
  const out = blocks.map((b, i) => {
    const l = byRef.get(i);
    if (!l) return b;
    return {
      ...b,
      durationMin: l.durationMin,
      startTime: l.startTime ?? b.startTime,
    };
  });
  // Final guard: an upstream LLM AM/PM mixup can land morning blocks in the
  // evening band (e.g. "10" -> "22:00"). normalizeDayStart repairs only the
  // corrupted leading run, leaving any legitimately-correct afternoon alone.
  return normalizeDayStart(out).items;
}

/** Build the LLM messages array. Exported so tests can pin the prompt shape. */
export function buildPromptMessages(input: AIGenerateInput) {
  const subjectsList = input.subjects.map(s => `- ${s.slug} (${s.name})`).join("\n");
  const blockTypesList = ALLOWED_BLOCK_TYPES.map(t => `"${t}"`).join(", ");

  // v2.97 (2026-05-27) — Seasonal-aware defaults. Parse the dateStr robustly
  // so the profile reflects the day being PLANNED, not the day the LLM call
  // happens to fire on (matters when nightly jobs plan tomorrow at midnight).
  const parsedDate = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.dateStr ?? "");
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  })();
  const seasonal = buildSeasonalProfile(parsedDate);
  const seasonalFragment = renderSeasonalPromptFragment(seasonal);

  // Day-length hint now defers to seasonal target when caller didn't override.
  // "full" = use seasonal target, "half" = halve it, "off" = no blocks.
  const seasonalTargetMin = seasonal.targetBlockCount * 35; // ~35 min avg block
  // v1 (2026-06-17) — an explicit budget from the adult prompt OVERRIDES the
  // seasonal default. The deterministic post-pass enforces the exact math, but
  // we still tell the LLM so it sizes the right number/length of blocks.
  const hasBudget = input.budgetMinMinutes != null || input.budgetMaxMinutes != null;
  const budgetText = hasBudget
    ? (input.budgetMinMinutes != null && input.budgetMaxMinutes != null
        ? `${input.budgetMinMinutes}–${input.budgetMaxMinutes} minutes total (the adult asked for this exact window — size blocks to fit it)`
        : input.budgetMaxMinutes != null
          ? `no more than ${input.budgetMaxMinutes} minutes total (adult-specified cap)`
          : `at least ${input.budgetMinMinutes} minutes total (adult-specified minimum)`)
    : null;
  const totalMinHint =
    budgetText ? budgetText :
    input.dayLength === "off" ? "0 (just one optional rest block)" :
    input.dayLength === "half" ? `around ${Math.round(seasonalTargetMin / 2)}–${Math.round(seasonalTargetMin * 0.75)} minutes total` :
    `around ${seasonalTargetMin}–${seasonalTargetMin + 60} minutes total (seasonal default: ${seasonal.mode} mode, ${seasonal.targetBlockCount} blocks starting ${seasonal.defaultStart})`;
  const startLine = input.startTime
    ? `- The school day STARTS at ${input.startTime} (24h). Assign startTime to each block in order beginning at ${input.startTime}; the system will finalize exact times.`
    : null;

  const knowledge = loadKnowledgeBundle();
  const topicCatalog = (input.topicCatalog || []).slice(0, 80);
  const topicCatalogText = topicCatalog.length
    ? topicCatalog
        .map(t => `  ${t.code} [${t.subjectSlug}] (${t.status}) — ${t.title}`)
        .join("\n")
    : "(catalog empty — fall back to known Common Core / Ohio 5 codes like 5.OA.1, 5.NF.3, RL.5.2, RI.5.4, W.5.2)";
  const tutorLine = input.tutorOfDay
    ? `Tutor today: ${input.tutorOfDay.name}${input.tutorOfDay.role ? ` (${input.tutorOfDay.role})` : ""}, here ${input.tutorOfDay.arrival}–${input.tutorOfDay.departure}. Schedule academic blocks inside that window when possible.`
    : `No tutor scheduled today — Mom-only day. Keep blocks gentle and self-directed.`;

  const ownedBooks = (input.ownedBooks || []).filter(b => b.status !== "shelved" && b.status !== "done");
  const ownedBooksText = ownedBooks.length
    ? ownedBooks.map((b) => {
        const span = b.suggestedPageSpan ? `pages ${b.suggestedPageSpan.from}–${b.suggestedPageSpan.to}` : null;
        const chap = b.currentChapter != null ? `Chapter ${b.currentChapter + 1}` : null;
        const next = b.type === "novel" || b.type === "chapter_book" ? chap : span;
        const tail = b.notes ? ` (${b.notes.slice(0, 120)})` : "";
        const codes = b.topicCodes?.length ? ` topics:${b.topicCodes.slice(0, 5).join(",")}` : "";
        return `  • "${b.title}" [${b.type}, ${b.subjectSlug || "?"}, ${b.status}]${codes} — next: ${next || "start"}${tail}`;
      }).join("\n")
    : "(no owned-books context provided)";

  const sys = [
    `You are the homeschool day-planning engine for ${input.studentName}, a ${input.gradeLevel || "5th-grade"} student.`,
    `You design short, kid-friendly schedule blocks. Always respect what works and avoid what harms.`,
    ``,
    seasonalFragment,
    ``,
    `What works for her: ${(input.whatWorks || []).join("; ") || "(unspecified)"}`,
    `What harms her: ${(input.whatHarms || []).join("; ") || "(unspecified)"}`,
    `Interests: ${(input.interests || []).join(", ") || "(unspecified)"}`,
    input.recentMoodNotes?.length ? `Recent mood notes: ${input.recentMoodNotes.join(" | ")}` : "",
    ``,
    tutorLine,
    ``,
    knowledge.promptBlock,
    ``,
    `===== ACTIVE CURRICULUM TOPIC CATALOG (use ONLY these codes) =====`,
    topicCatalogText,
    `===== END CATALOG =====`,
    ``,
    `===== REAGAN'S OWNED PRINTED BOOKS (prefer these for matching subjects) =====`,
    ownedBooksText,
    `===== END OWNED BOOKS =====`,
    ``,
    `OWNED-BOOK RULES:`,
    `- When you assign reading or workbook practice for ELA, math, or science, FIRST check the owned-books list above and use one of those titles instead of inventing a book.`,
    `- For workbooks (Spectrum Science, 180 Days of Language) write the description as: "Complete pg. X–Y of <Book Title>." using the suggested page span exactly as given (do not pick different pages).`,
    `- For novels / chapter books (Tuck Everlasting, Michael's World) write: "Read Chapter N of <Book Title>."`,
    `- If a book is marked in_progress_unstructured, still use the suggested page span — the system already skipped pages tutors have ticked off.`,
    `- Only invent a fresh source (web link, video, app) when no owned book matches the topic.`,
    ``,
    `RULES:`,
    `- Output JSON only, matching the schema you'll be given.`,
    `- Use ONLY these block types: ${blockTypesList}.`,
    `- For subjectSlug use one of (or null): ${input.subjects.map(s => s.slug).join(", ")}.`,
    `- Total duration target: ${totalMinHint}.`,
    startLine ?? "",
    `- Always include a soft warm-up first and a low-stakes wrap-up last.`,
    `- Keep titles ≤ 60 chars and friendly (one emoji is fine).`,
    `- Description = a parent-readable plan with the activity, materials, and 1–2 talk-about-it questions.`,
    `- EVERY academic block (math, read_aloud, choice, catch_up, custom, morning_warmup) MUST include a curriculumTopicCode chosen from the catalog above.`,
    `- Pure adventures and appointments may set curriculumTopicCode to null.`,
    `- Prefer topics whose status is "notStarted" or "inProgress". Only revisit "done" topics if the day is review-focused.`,
  ].filter(Boolean).join("\n");

  const user = [
    `Plan ${input.dayLabel} (${input.dateStr}) for ${input.studentName}.`,
    input.adultPrompt ? `\nParent's focus for today: ${input.adultPrompt}` : "",
    `\nReturn 3–6 blocks in order.`,
  ].filter(Boolean).join("\n");

  return [
    { role: "system" as const, content: sys },
    { role: "user" as const, content: user },
  ];
}

/* ----------------------- main entry ----------------------- */

export async function generateScheduleDraft(input: AIGenerateInput): Promise<AIGenerateResult> {
  const enforceTopic = input.enforceTopic === true;
  const messages = buildPromptMessages(input);
  const validSlugs = new Set(input.subjects.map(s => s.slug));

  const resp = await invokeLLM({
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "schedule_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Short rationale for the parent (1–2 sentences)." },
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  blockType: { type: "string", enum: [...ALLOWED_BLOCK_TYPES] },
                  title: { type: "string" },
                  description: { type: "string" },
                  durationMin: { type: "integer" },
                  startTime: { type: "string" },
                  subjectSlug: { type: ["string", "null"] },
                  curriculumTopicCode: { type: ["string", "null"], description: "Required for academic blocks; e.g. '5.OA.1', 'RL.5.2'." },
                },
                required: ["blockType", "title", "description", "durationMin", "startTime", "subjectSlug", "curriculumTopicCode"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "blocks"],
          additionalProperties: false,
        },
      },
    },
  } as any);

  const raw = (resp as any)?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }
  const validTopicCodes = new Set((input.topicCatalog || []).map(t => t.code.toUpperCase()));
  let { blocks, warnings } = sanitizeBlocks(parsed?.blocks, validSlugs, validTopicCodes, input.dayLength);

  // Push 33 — hard-reject + retry path.
  if (enforceTopic) {
    const untagged = blocks.filter((b) => ACADEMIC_BLOCK_TYPES.has(b.blockType) && !b.curriculumTopicCode);
    if (untagged.length > 0 && validTopicCodes.size > 0) {
      // Single retry with a stricter reminder appended to the system msg.
      const retryMessages = [
        ...messages,
        {
          role: "system" as const,
          content:
            "REJECT NOTICE: Your previous response had " +
            untagged.length +
            " academic block(s) without a curriculumTopicCode. " +
            "This is mandatory for every academic block. Reissue the SAME schedule but assign " +
            "every academic block (morning_warmup, math, read_aloud, choice, catch_up, custom) a " +
            "valid curriculumTopicCode from the catalog above. Do not invent codes.",
        },
      ];
      const retryResp = await invokeLLM({
        messages: retryMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "schedule_draft_retry",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      blockType: { type: "string", enum: [...ALLOWED_BLOCK_TYPES] },
                      title: { type: "string" },
                      description: { type: "string" },
                      durationMin: { type: "integer" },
                      startTime: { type: "string" },
                      subjectSlug: { type: ["string", "null"] },
                      curriculumTopicCode: { type: ["string", "null"] },
                    },
                    required: ["blockType", "title", "description", "durationMin", "startTime", "subjectSlug", "curriculumTopicCode"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "blocks"],
              additionalProperties: false,
            },
          },
        },
      } as any);
      const retryRaw = (retryResp as any)?.choices?.[0]?.message?.content ?? "{}";
      let retryParsed: any = {};
      try { retryParsed = typeof retryRaw === "string" ? JSON.parse(retryRaw) : retryRaw; } catch { retryParsed = {}; }
      const retried = sanitizeBlocks(retryParsed?.blocks, validSlugs, validTopicCodes, input.dayLength);
      blocks = retried.blocks;
      warnings = [...warnings, "hard-reject retry triggered: " + untagged.length + " academic block(s) lacked topicCode on first pass", ...retried.warnings];
      // Drop any academic blocks that STILL lack a topicCode after the retry.
      const before = blocks.length;
      blocks = blocks.filter((b) => !ACADEMIC_BLOCK_TYPES.has(b.blockType) || !!b.curriculumTopicCode);
      const dropped = before - blocks.length;
      if (dropped > 0) {
        warnings.push("hard-reject: dropped " + dropped + " academic block(s) that remained un-tagged after retry");
      }
      const summaryFromRetry = typeof retryParsed?.summary === "string" ? retryParsed.summary.slice(0, 600) : "";
      blocks = applyBudgetLayout(blocks, { startTime: input.startTime, minMinutes: input.budgetMinMinutes, maxMinutes: input.budgetMaxMinutes });
      return { blocks, summary: summaryFromRetry || (typeof parsed?.summary === "string" ? parsed.summary.slice(0, 600) : ""), warnings };
    }
  }

  blocks = applyBudgetLayout(blocks, { startTime: input.startTime, minMinutes: input.budgetMinMinutes, maxMinutes: input.budgetMaxMinutes });
  return {
    blocks,
    summary: typeof parsed?.summary === "string" ? parsed.summary.slice(0, 600) : "",
    warnings,
  };
}
