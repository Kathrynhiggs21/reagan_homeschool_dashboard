/**
 * reviewBlockGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Picks the N topics most overdue for spaced-repetition review and generates a
 * 3-5 question multiple-choice quiz for Kiwi to deliver.
 *
 * Spaced-repetition schedule (simple SM-2 approximation):
 *   masteryScore ≥ 80  → review every 14 days
 *   masteryScore 50-79 → review every 7 days
 *   masteryScore < 50  → review every 3 days
 *
 * Usage:
 *   const block = await generateReviewBlock({ dateISO: "2026-06-01", count: 3 });
 *   // Returns a ready-to-insert scheduleBlock payload with embedded quiz JSON.
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";

export interface ReviewQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface ReviewBlockPayload {
  title: string;
  description: string;
  durationMin: number;
  blockType: "review";
  topics: Array<{
    subjectSlug: string;
    topicHandle: string;
    topicTitle: string;
    masteryScore: number;
  }>;
  questions: ReviewQuestion[];
}

/** Days between reviews based on mastery score */
function reviewIntervalDays(masteryScore: number): number {
  if (masteryScore >= 80) return 14;
  if (masteryScore >= 50) return 7;
  return 3;
}

/** Pick the N topics most overdue for review */
async function pickOverdueTopics(count = 3) {
  const now = new Date();
  // Get all tracked topics from topicMastery table
  const drizzleDb = getDb();
  const { topicMastery, weakTopics } = await import("../../drizzle/schema");
  const rows = await drizzleDb
    .select()
    .from(topicMastery)
    .limit(100);

  if (!rows || rows.length === 0) {
    // Fall back to weakTopics if topicMastery is empty
    const weak = await drizzleDb
      .select()
      .from(weakTopics)
      .limit(count);
    return (weak ?? []).map((w: any) => ({
      subjectSlug: w.subjectSlug,
      topicHandle: w.topicHandle,
      topicTitle: w.topicTitle,
      masteryScore: w.masteryScore ?? 50,
    }));
  }

  // Score each topic by how overdue it is
  const scored = rows.map((row: any) => {
    const interval = reviewIntervalDays(row.masteryScore ?? 50);
    const lastReviewed = row.lastReviewedAt ? new Date(row.lastReviewedAt) : new Date(0);
    const daysSince = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
    const overdueScore = daysSince / interval; // > 1 means overdue
    return { ...row, overdueScore };
  });

  // Sort by most overdue first, then by lowest mastery
  scored.sort((a: any, b: any) => {
    if (b.overdueScore !== a.overdueScore) return b.overdueScore - a.overdueScore;
    return (a.masteryScore ?? 50) - (b.masteryScore ?? 50);
  });

  return scored.slice(0, count).map((r: any) => ({
    subjectSlug: r.subjectSlug,
    topicHandle: r.topicHandle,
    topicTitle: r.topicTitle,
    masteryScore: r.masteryScore ?? 50,
  }));
}

/** Generate quiz questions for a set of topics via LLM */
async function generateQuizQuestions(
  topics: Array<{ subjectSlug: string; topicTitle: string; masteryScore: number }>,
  totalQuestions = 4,
): Promise<ReviewQuestion[]> {
  const topicList = topics.map(t => `- ${t.topicTitle} (${t.subjectSlug})`).join("\n");
  const questionsPerTopic = Math.max(1, Math.ceil(totalQuestions / topics.length));

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a friendly homeschool tutor creating review questions for Reagan, a 5th-grade student. 
Generate clear, age-appropriate multiple-choice questions. Each question should have exactly 4 choices (A, B, C, D).
Focus on core concepts, not trick questions. Keep language simple and encouraging.`,
      },
      {
        role: "user",
        content: `Generate ${totalQuestions} review questions covering these topics:
${topicList}

Return a JSON array of questions. Each question must have:
- question: string (the question text)
- choices: string[] (exactly 4 options, no A/B/C/D prefix)
- correctIndex: number (0-3, index of correct answer)
- explanation: string (brief, friendly explanation of the correct answer)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "review_questions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  correctIndex: { type: "integer" },
                  explanation: { type: "string" },
                },
                required: ["question", "choices", "correctIndex", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return [];
    const parsed = JSON.parse(content);
    return (parsed.questions ?? []).slice(0, totalQuestions);
  } catch {
    return [];
  }
}

/**
 * Main export: generate a review block payload for a given date.
 * @param dateISO - ISO date string (YYYY-MM-DD)
 * @param topicCount - number of topics to include (default 2-3)
 * @param questionCount - total questions (default 4)
 */
export async function generateReviewBlock(opts: {
  dateISO: string;
  topicCount?: number;
  questionCount?: number;
}): Promise<ReviewBlockPayload | null> {
  const { dateISO, topicCount = 3, questionCount = 4 } = opts;

  const topics = await pickOverdueTopics(topicCount);
  if (topics.length === 0) return null;

  const questions = await generateQuizQuestions(topics, questionCount);

  const topicNames = topics.map((t: { topicTitle: string }) => t.topicTitle).join(", ");
  return {
    title: `Review: ${topicNames}`,
    description: `Kiwi will quiz you on ${topics.length} topic${topics.length > 1 ? "s" : ""} — ${topicNames}. ${questionCount} questions, ~15 minutes.`,
    durationMin: 15,
    blockType: "review",
    topics,
    questions,
  };
}

/**
 * Inject a review block into a daily plan if one doesn't already exist.
 * Called by the nightly agenda builder.
 * Skips Fridays on short days (dayType = "half").
 */
export async function injectReviewBlockIfNeeded(opts: {
  planId: number;
  dateISO: string;
  dayType: string;
  existingBlockTypes: string[];
}): Promise<{ injected: boolean; reason?: string }> {
  const { planId, dateISO, dayType, existingBlockTypes } = opts;

  // Don't inject if there's already a review block
  if (existingBlockTypes.includes("review")) {
    return { injected: false, reason: "review block already exists" };
  }

  // Skip Fridays on half days
  const dayOfWeek = new Date(dateISO + "T12:00:00Z").getDay(); // 0=Sun, 5=Fri
  if (dayOfWeek === 5 && dayType === "half") {
    return { injected: false, reason: "Friday short day — skipping review" };
  }

  // Skip off days
  if (dayType === "off") {
    return { injected: false, reason: "day off — skipping review" };
  }

  const payload = await generateReviewBlock({ dateISO });
  if (!payload) {
    return { injected: false, reason: "no overdue topics found" };
  }

  // Insert as a morning_warmup-adjacent block (sortOrder 0.5 → becomes 1 after existing warmup)
  const drizzleDb2 = getDb();
  const { scheduleBlocks } = await import("../../drizzle/schema");
  await drizzleDb2
    .insert(scheduleBlocks)
    .values({
      planId,
      blockType: "review",
      title: payload.title,
      description: JSON.stringify({ ...payload, _type: "review_block" }),
      durationMin: payload.durationMin,
      sortOrder: 1, // after morning warmup
      status: "not_started",
    });

  return { injected: true };
}
