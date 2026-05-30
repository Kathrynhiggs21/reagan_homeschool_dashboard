/**
 * Lesson synthesizer for the nightly agenda packet.
 *
 * When a plan block was created by the AI Schedule Generator and has neither
 * a curated lesson, an attached printable, nor a curriculum topic id, the
 * regular hydrator returns null and the block prints as a bare title with
 * blank Notes lines. The user's stated preference is that every block in the
 * printed packet must include the worksheet content inline so Reagan can do
 * the whole day offline. This module fills that gap.
 *
 * Per block it produces (via the project's `invokeLLM` helper):
 *   - 2-4 measurable objectives
 *   - 4-8 sentence instructions paragraph
 *   - 3-6 practice items targeted at 5th grade with full answer key
 *   - (when relevant) a page reference into Reagan's owned books
 *
 * The synthesized lesson is cached as an `assignmentsLibrary` row keyed on
 * the block id so the second send (e.g. a Print Daily click after the
 * nightly email) is free and deterministic.
 *
 * Pure read-then-write helper. Never throws — failures degrade silently to
 * the existing "blank Notes" fallback.
 */
import * as db from "../db";
import { invokeLLM } from "../_core/llm";
import type { AgendaPdfBlock } from "./agendaPdf";

type LessonPayload = NonNullable<AgendaPdfBlock["lesson"]>;

const SYNTH_TYPE = "synth_lesson_v1";
const SYNTH_SOURCE = "ai-synthesizer";

const OWNED_BOOKS_BY_SUBJECT: Record<string, string[]> = {
  ela: ["Tuck Everlasting", "180 Days of Language for 5th Grade"],
  reading: ["Tuck Everlasting", "Michael's World"],
  writing: ["180 Days of Language for 5th Grade"],
  science: ["Spectrum Science Grade 5"],
};

type SynthInput = {
  blockId: number;
  blockTitle: string;
  blockDescription?: string | null;
  subjectSlug: string | null;
  subjectName?: string | null;
  durationMin: number;
  dateStr: string;
};

/**
 * Tiny schema we ask the LLM to fill. Strict JSON keeps the parsing
 * boring and crash-free.
 */
type SynthResult = {
  objectives: string[];
  instructions: string;
  practice: Array<{ q: string; a: string }>;
  bookReference?: { title: string; pageRange: string } | null;
};

export async function synthesizeLessonForBlock(
  input: SynthInput,
): Promise<LessonPayload | null> {
  // 1) Check cache: if we already synthesized this block, reuse it.
  try {
    const cached = await db.listAssignmentsLibrary({
      blockId: input.blockId,
      type: SYNTH_TYPE,
      limit: 1,
    });
    if (cached && cached.length > 0 && cached[0]?.notes) {
      const reparsed = safeParse(cached[0].notes);
      if (reparsed) return toLessonPayload(reparsed, input.blockTitle);
    }
  } catch {
    /* cache miss is fine */
  }

  // 2) Synthesize via LLM.
  const ownedBooks =
    OWNED_BOOKS_BY_SUBJECT[(input.subjectSlug ?? "").toLowerCase()] ?? [];

  const userMsg = [
    `Create a tiny offline-printable worksheet for a 5th-grade homeschool block.`,
    `Date: ${input.dateStr}`,
    `Subject: ${input.subjectName ?? input.subjectSlug ?? "general"}`,
    `Block title: ${input.blockTitle}`,
    input.blockDescription ? `Teacher notes: ${input.blockDescription}` : "",
    `Estimated time: ${input.durationMin} minutes`,
    ownedBooks.length > 0
      ? `Student owns these books for this subject — if a page reference is genuinely useful, pick ONE and provide a plausible page range; otherwise omit. Books: ${ownedBooks.join(", ")}.`
      : "",
    ``,
    `Return JSON with: 2-4 short measurable objectives; one 3-5 sentence instructions paragraph; 3-6 practice items (each q + a) appropriate for the time budget; optional bookReference if a real owned book matches.`,
  ]
    .filter(Boolean)
    .join("\n");

  let synth: SynthResult | null = null;
  try {
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a careful 5th-grade homeschool tutor preparing a one-page printable so a student can work fully offline. Keep answers short, age-appropriate, and grounded in standard 5th-grade curricula. Output only the requested JSON.",
        },
        { role: "user", content: userMsg },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "synth_lesson",
          strict: true,
          schema: {
            type: "object",
            properties: {
              objectives: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 4,
              },
              instructions: { type: "string" },
              practice: {
                type: "array",
                minItems: 3,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    q: { type: "string" },
                    a: { type: "string" },
                  },
                  required: ["q", "a"],
                  additionalProperties: false,
                },
              },
              bookReference: {
                type: ["object", "null"],
                properties: {
                  title: { type: "string" },
                  pageRange: { type: "string" },
                },
                required: ["title", "pageRange"],
                additionalProperties: false,
              },
            },
            required: ["objectives", "instructions", "practice", "bookReference"],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = (resp as any)?.choices?.[0]?.message?.content;
    synth = safeParse(typeof raw === "string" ? raw : JSON.stringify(raw));
  } catch {
    synth = null;
  }

  if (!synth) return null;

  // 3) Persist to cache (best-effort).
  try {
    await db.addAssignmentLibrary({
      title: `Synthesized: ${input.blockTitle}`.slice(0, 280),
      type: SYNTH_TYPE,
      subjectSlug: input.subjectSlug ?? undefined,
      topic: input.blockTitle.slice(0, 180),
      fromSource: SYNTH_SOURCE,
      dateFor: input.dateStr,
      dateReceived: input.dateStr,
      blockId: input.blockId,
      notes: JSON.stringify(synth),
    });
  } catch {
    /* caching failures must not block the packet */
  }

  return toLessonPayload(synth, input.blockTitle);
}

function safeParse(raw: string | null | undefined): SynthResult | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (
      Array.isArray(obj?.objectives) &&
      typeof obj?.instructions === "string" &&
      Array.isArray(obj?.practice)
    ) {
      return obj as SynthResult;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function toLessonPayload(s: SynthResult, blockTitle: string): LessonPayload {
  const answerKeyLines = s.practice.map((p, i) => `${i + 1}. ${p.a}`).join("\n");
  const questions = s.practice.map((p) => p.q);

  let descParts: string[] = [];
  if (s.bookReference?.title && s.bookReference?.pageRange) {
    // Strip any 'pages '/'pp.? '/'p.? ' prefix the LLM may have included so we
    // don't render 'pg pages 15-25'.
    const pageRange = String(s.bookReference.pageRange)
      .replace(/^\s*(pages?|pp\.?|p\.?)\s+/i, "")
      .trim();
    descParts.push(`Book: ${s.bookReference.title}, pg ${pageRange}`);
  }

  return {
    instructions: s.instructions ?? null,
    objectives: s.objectives ?? null,
    materials: null,
    videos: [],
    worksheets: [
      {
        title: `${blockTitle} — Practice`,
        description: descParts.join(" · ") || null,
        questions,
      },
    ],
    answerKey: answerKeyLines || null,
  };
}
