/**
 * v3.16 (2026-05-30) — `generate_worksheet` op handler for the agenda chat.
 *
 * The unified AI chat (`agendaEditor.chat`) can emit a `generate_worksheet`
 * op when the adult asks for a custom practice sheet. This module is the
 * apply-side handler. It:
 *   1. Calls the LLM (vision-mode when a reference attachment is provided)
 *      to author title + instructions + numbered questions as structured JSON.
 *   2. Persists a real row in `assignmentsLibrary` with the worksheet body
 *      stored in `notes` (markdown), pinned to the target/new block via
 *      `blockId`. This is what makes the worksheet operable, sortable in the
 *      adult Assignments view, and printable through the existing pipeline.
 *   3. Either updates the existing target block's title/description or
 *      creates a new "custom" block to host it.
 *
 * Failure mode: if the LLM round-trips fail or return empty content, this
 * handler now THROWS so the chat router surfaces a real error to the adult
 * instead of silently writing placeholder questions.
 */
import * as db from "../db";
import { invokeLLM } from "../_core/llm";

export type GenerateWorksheetInput = {
  planId: number;
  targetBlockId: number | null;
  topic: string;
  subjectSlug: string | null;
  gradeLevel: string | null;
  questionCount: number;
  style: "practice" | "quiz" | "review" | "writing-prompt";
  sourceAttachmentUrl: string | null;
  subjectIdBySlug: Map<string, number>;
  liveBlockCount: number;
  /** Optional date to tag the assignment row with (defaults to today). */
  dateFor?: string | null;
  /**
   * Optional LLM injection seam used by integration tests.
   * When provided, this function is called *instead of* `invokeLLM`,
   * so tests can exercise the full persist + attach flow without
   * hitting the real model.
   */
  llmInvoker?: typeof invokeLLM;
};

export type GenerateWorksheetResult = {
  createdNewBlock: boolean;
  blockId: number;
  /** ID of the assignmentsLibrary row that holds the worksheet body. */
  assignmentLibraryId: number | null;
  questionCount: number;
};

/**
 * Pure helper: build the LLM prompt for a custom worksheet. Exported so
 * it can be unit-tested without touching the DB or LLM.
 */
export function buildWorksheetPrompt(input: {
  topic: string;
  gradeLevel: string | null;
  questionCount: number;
  style: GenerateWorksheetInput["style"];
}): { system: string; user: string } {
  const grade = (input.gradeLevel || "5th grade").toLowerCase();
  // v1 (2026-06-17) — Katy's labeling rule: quizzes are fine, but the
  // user-facing wording must read "questionnaire" (never "quiz"/"test"). The
  // internal style enum stays "quiz" so existing routing/validation is intact;
  // only the authored noun the LLM uses for titles/instructions changes.
  const styleNoun =
    input.style === "quiz" ? "questionnaire"
    : input.style === "review" ? "review sheet"
    : input.style === "writing-prompt" ? "writing prompt"
    : "practice worksheet";
  const labelRule =
    input.style === "quiz"
      ? ` Title it as a "Questionnaire" — do NOT use the words "quiz" or "test" anywhere in the title or instructions.`
      : "";
  const system =
    `You are a homeschool worksheet author. Write age-appropriate ${styleNoun}s ` +
    `for a ${grade} student. Be concrete, include real numbers / examples, and ` +
    `keep the language simple.${labelRule} Output JSON only — no commentary.`;
  const user =
    `Make a ${styleNoun} on: ${input.topic.trim()}.\n` +
    `It must contain exactly ${input.questionCount} numbered question${input.questionCount === 1 ? "" : "s"}, ` +
    `progressing from easier to harder. Include a one-sentence "instructions" line at the top.`;
  return { system, user };
}

/**
 * Pure helper: format the worksheet body as printable Markdown. Exported
 * for tests so the contract is locked.
 */
export function renderWorksheetMarkdown(opts: {
  title: string;
  instructions: string;
  questions: string[];
}): string {
  const numbered = opts.questions.map((q, i) => {
    const trimmed = String(q).trim();
    if (/^\d+[.)]/.test(trimmed)) return trimmed;
    return `${i + 1}. ${trimmed}`;
  });
  const lines: string[] = [];
  lines.push(`# ${opts.title.trim()}`);
  if (opts.instructions.trim()) {
    lines.push("");
    lines.push(`> ${opts.instructions.trim()}`);
  }
  lines.push("");
  for (const q of numbered) lines.push(q);
  return lines.join("\n").trim() + "\n";
}

/**
 * Internal: type for the LLM's structured JSON response.
 */
type LLMWorksheet = { title: string; instructions: string; questions: string[] };

/**
 * Internal: invoke the LLM and parse the structured response. Throws on
 * empty / malformed output so the caller can surface the failure rather
 * than silently saving filler.
 */
async function generateWorksheetContent(
  input: Pick<GenerateWorksheetInput, "topic" | "gradeLevel" | "questionCount" | "style" | "sourceAttachmentUrl" | "llmInvoker">,
): Promise<LLMWorksheet> {
  const { system, user } = buildWorksheetPrompt({
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    questionCount: input.questionCount,
    style: input.style,
  });

  const userContent: any = input.sourceAttachmentUrl
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: input.sourceAttachmentUrl, detail: "auto" } },
      ]
    : user;

  const invoker = input.llmInvoker ?? invokeLLM;
  const resp = await invoker({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "custom_worksheet",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            instructions: { type: "string" },
            questions: { type: "array", items: { type: "string" } },
          },
          required: ["title", "instructions", "questions"],
          additionalProperties: false,
        },
      },
    },
  } as any);

  const raw = (resp as any)?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Worksheet generator returned empty response — try rephrasing the topic.");
  }
  let parsed: any;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Worksheet generator returned non-JSON output.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Worksheet generator returned malformed output.");
  }
  const title = String(parsed.title ?? "").slice(0, 200).trim();
  const instructions = String(parsed.instructions ?? "").trim();
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((q: any) => String(q ?? "").trim()).filter((q: string) => q.length > 0)
    : [];
  if (!title) throw new Error("Worksheet generator did not provide a title.");
  if (questions.length === 0) {
    throw new Error("Worksheet generator did not return any questions.");
  }
  return { title, instructions, questions };
}

/**
 * Handler entry point. Called from the `agendaEditor.chat` apply switch.
 *
 * Persistence:
 *   - One `assignmentsLibrary` row (type="worksheet", fromSource="ai_chat",
 *     status="pending", blockId=resolved, notes=markdown body).
 *   - The host block's title gets the worksheet title, and its description
 *     gets a short pointer back to the saved assignment id.
 *
 * Errors thrown here propagate up to the chat router, which converts them
 * into a visible warning on the chat reply so the adult sees the failure
 * rather than a silent placeholder.
 */
export async function handleGenerateWorksheet(
  input: GenerateWorksheetInput,
): Promise<GenerateWorksheetResult> {
  // 1. Generate the worksheet content (throws on failure).
  const content = await generateWorksheetContent(input);

  // 2. Resolve the host block: either the existing target or a new one.
  const subjectId = input.subjectSlug ? (input.subjectIdBySlug.get(input.subjectSlug) ?? null) : null;
  const markdown = renderWorksheetMarkdown(content);
  const today = input.dateFor ?? new Date().toISOString().slice(0, 10);

  let hostBlockId: number;
  let createdNewBlock: boolean;

  if (input.targetBlockId != null) {
    await db.updateBlock(input.targetBlockId, {
      title: content.title,
      description: content.instructions || `Custom worksheet on ${input.topic}.`,
      ...(subjectId ? { subjectId } : {}),
    } as any);
    hostBlockId = input.targetBlockId;
    createdNewBlock = false;
  } else {
    const sortOrder = input.liveBlockCount + 1;
    const inserted = await db.createBlock({
      planId: input.planId,
      blockType: "custom" as any,
      subjectId,
      title: content.title,
      description: content.instructions || `Custom worksheet on ${input.topic}.`,
      durationMin: 25,
      startTime: null,
      sortOrder,
      status: "not_started" as any,
      curriculumTopicId: null,
    } as any);
    // db.createBlock returns the bare insertId (number) on TiDB; fall back
    // to envelope shapes for safety.
    const insertedId =
      typeof inserted === "number" ? inserted
      : (inserted as any)?.id ?? (inserted as any)?.insertId ?? null;
    if (insertedId == null) {
      throw new Error("Failed to create new block to host the generated worksheet.");
    }
    hostBlockId = Number(insertedId);
    createdNewBlock = true;
  }

  // 3. Persist the worksheet body in assignmentsLibrary so it shows up in
  //    the adult Assignments view and can be re-printed / re-opened later.
  const libRow = await db.addAssignmentLibrary({
    title: content.title,
    subjectSlug: input.subjectSlug ?? null,
    type: "worksheet",
    topic: input.topic.slice(0, 200),
    tags: ["ai_chat", input.style],
    fromSource: "ai_chat",
    ihClassroom: false,
    dateReceived: today,
    dateFor: today,
    status: "pending",
    recommendedUse: 4,
    notes: markdown,
    blockId: hostBlockId,
  } as any);

  return {
    createdNewBlock,
    blockId: hostBlockId,
    assignmentLibraryId: libRow?.id ?? null,
    questionCount: content.questions.length,
  };
}
