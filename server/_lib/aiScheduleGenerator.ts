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
  return { blocks: out, warnings };
}

/** Build the LLM messages array. Exported so tests can pin the prompt shape. */
export function buildPromptMessages(input: AIGenerateInput) {
  const subjectsList = input.subjects.map(s => `- ${s.slug} (${s.name})`).join("\n");
  const blockTypesList = ALLOWED_BLOCK_TYPES.map(t => `"${t}"`).join(", ");

  const totalMinHint =
    input.dayLength === "off" ? "0 (just one optional rest block)" :
    input.dayLength === "half" ? "around 90–150 minutes total" :
    "around 180–240 minutes total";

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
  const { blocks, warnings } = sanitizeBlocks(parsed?.blocks, validSlugs, validTopicCodes);
  return {
    blocks,
    summary: typeof parsed?.summary === "string" ? parsed.summary.slice(0, 600) : "",
    warnings,
  };
}
