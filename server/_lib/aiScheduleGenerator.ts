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
};

export type AIGenerateResult = {
  blocks: AIBlockDraft[];
  summary: string;            // 1–2 sentence rationale for the parent
  warnings: string[];         // any subject slug it wanted to use but couldn't
};

/* ----------------------- pure helpers (unit-tested) ----------------------- */

/** Clamp + sanitize the LLM's raw block array. Drops invalid rows, never throws. */
export function sanitizeBlocks(
  raw: any,
  validSlugs: Set<string>,
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
    out.push({ blockType, title, description, durationMin, startTime, subjectSlug });
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
  const sys = [
    `You are Kiwi, a homeschool day-planning assistant for ${input.studentName}, a ${input.gradeLevel || "5th-grade"} student.`,
    `You design short, kid-friendly schedule blocks. Always respect what works and avoid what harms.`,
    ``,
    `What works for her: ${(input.whatWorks || []).join("; ") || "(unspecified)"}`,
    `What harms her: ${(input.whatHarms || []).join("; ") || "(unspecified)"}`,
    `Interests: ${(input.interests || []).join(", ") || "(unspecified)"}`,
    input.recentMoodNotes?.length ? `Recent mood notes: ${input.recentMoodNotes.join(" | ")}` : "",
    ``,
    knowledge.promptBlock,
    ``,
    `RULES:`,
    `- Output JSON only, matching the schema you'll be given.`,
    `- Use ONLY these block types: ${blockTypesList}.`,
    `- For subjectSlug use one of (or null): ${input.subjects.map(s => s.slug).join(", ")}.`,
    `- Total duration target: ${totalMinHint}.`,
    `- Always include a soft warm-up first and a low-stakes wrap-up last.`,
    `- Keep titles ≤ 60 chars and friendly (one emoji is fine).`,
    `- Description = a parent-readable plan with the activity, materials, and 1–2 talk-about-it questions.`,
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
                },
                required: ["blockType", "title", "description", "durationMin", "startTime", "subjectSlug"],
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
  const { blocks, warnings } = sanitizeBlocks(parsed?.blocks, validSlugs);
  return {
    blocks,
    summary: typeof parsed?.summary === "string" ? parsed.summary.slice(0, 600) : "",
    warnings,
  };
}
