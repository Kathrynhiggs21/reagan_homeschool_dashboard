/**
 * 2026-05-14 overnight push — in-process auto-grade runner.
 *
 * The `submissions.autoGrade` tRPC mutation already has the full grading
 * logic (typed answers + vision-grade for photo submissions, plus rolling
 * the result into `skillsMastery`). To honor the new "automation-by-default"
 * rule we want every fresh submission to grade itself the moment it hits
 * the DB — without forcing the client to issue a second mutation.
 *
 * This module exposes `runAutoGradeForSubmission(submissionId)` which the
 * `submissions.create` mutation calls fire-and-forget. It re-implements the
 * same logic the tRPC procedure uses (same DB helpers, same LLM prompts) so
 * we don't have to fight tRPC's caller context from inside another caller.
 */
import * as db from "../db";
import { invokeLLM } from "../_core/llm";

interface QuestionShape {
  qId?: string;
  kind: "mc" | "text" | string;
  prompt?: string | null;
  rubric?: string | null;
  correct?: string | null;
}

export async function runAutoGradeForSubmission(submissionId: number): Promise<void> {
  if (!submissionId || submissionId <= 0) return;

  // Find the submission by id (listAssignmentSubmissions returns enriched rows).
  const subs: any[] = (await db.listAssignmentSubmissions(500)) as any[];
  const sub = subs.find((s) => s.id === submissionId);
  if (!sub) return;
  // Already graded? Don't waste an LLM call.
  if (sub.autoScore != null) return;

  const key = await db.getAnswerKeyForBlock(sub.blockId);
  if (!key) return; // No answer key set yet — silently skip.

  const total: number = (key.totalPoints as number) || 100;
  const questions: QuestionShape[] = ((key.questions as any[]) || []) as QuestionShape[];
  const perQ = questions.length ? Math.floor(total / questions.length) : 0;
  let score = 0;
  let feedback = "";
  const answers: Record<string, string> = {};

  if (sub.submissionType === "text" && sub.contentText) {
    const lines = String(sub.contentText)
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const ans = lines[i] || "";
      if (q.qId) answers[q.qId] = ans;
      if (!ans) continue;
      if (q.kind === "mc" && q.correct) {
        if (ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) {
          score += perQ;
        }
      } else if (q.kind === "text" && q.correct) {
        if (ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) {
          score += perQ;
        } else {
          try {
            const r = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "You grade 5th-grade answers. Reply with a single JSON object {\"correct\": boolean, \"why\": string}.",
                },
                {
                  role: "user",
                  content: `Question: ${q.prompt ?? "(no prompt)"}\nExpected: ${q.correct}\nStudent: ${ans}\nGrade with tolerance for spelling/phrasing.`,
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "g",
                  strict: true,
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["correct", "why"],
                    properties: {
                      correct: { type: "boolean" },
                      why: { type: "string" },
                    },
                  },
                },
              },
            });
            const raw =
              ((r as any)?.choices?.[0]?.message?.content as string) || "{}";
            const parsed = JSON.parse(raw);
            if (parsed.correct) score += perQ;
            if (parsed.why) {
              feedback += `${q.prompt ? q.prompt + ": " : ""}${parsed.why}\n`;
            }
          } catch {
            /* swallow LLM errors */
          }
        }
      }
    }
  } else if (sub.fileUrl) {
    try {
      const promptText = questions
        .map(
          (q, i) =>
            `Q${i + 1} (${q.kind}): ${q.prompt ?? ""}\n  Rubric: ${q.rubric ?? ""}\n  Expected: ${q.correct ?? ""}`,
        )
        .join("\n");
      const r = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You grade a 5th-grade worksheet from an image. Reply with strict JSON {\"score\": 0-100, \"feedback\": string}.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Grade this worksheet.\n${promptText}` },
              {
                type: "image_url",
                image_url: { url: String(sub.fileUrl) },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "g",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["score", "feedback"],
              properties: {
                score: { type: "integer" },
                feedback: { type: "string" },
              },
            },
          },
        },
      });
      const raw =
        ((r as any)?.choices?.[0]?.message?.content as string) || "{}";
      const parsed = JSON.parse(raw);
      score = Math.max(0, Math.min(100, Math.round(parsed.score || 0)));
      feedback = String(parsed.feedback || "");
    } catch {
      feedback = "Image grading unavailable right now.";
    }
  }

  const pct = Math.max(0, Math.min(100, Math.round((score / total) * 100)));
  const letter =
    pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  await db.recordAutoGrade({
    submissionId,
    autoScore: pct,
    autoLetter: letter,
    autoFeedback: feedback,
    answers,
  } as any);
  if (sub.subjectSlug) {
    try {
      await db.applyGradeToMastery({
        subjectSlug: sub.subjectSlug,
        skillName: sub.title || sub.subjectSlug,
        score: pct,
      } as any);
    } catch {
      /* best-effort */
    }
  }
}
