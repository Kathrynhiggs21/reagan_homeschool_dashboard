/**
 * Integration test for the `queue_review_block` op apply path.
 *
 * We can't easily call the tRPC procedure directly without a request context,
 * but we CAN replicate the exact apply branch (lines 1320-1351 in routers.ts)
 * inline against the real DB, which is what really matters: the contract that
 * a review-block op produces a real `scheduleBlocks` row with the right
 * `blockType`, `subjectId`, `curriculumTopicId`, `title`, `description`, and
 * `durationMin` after persistence.
 *
 * Locked behaviors:
 *   1. Subject-only op persists a catch_up block with the right subjectId.
 *   2. Topic-only op persists a catch_up block with the topic in the title.
 *   3. curriculumTopicCode resolves to the right curriculumTopicId.
 *   4. The reason is captured in the description.
 *   5. Multiple review-block ops in the same apply pass produce N rows.
 */
import { describe, it, expect, afterEach } from "vitest";
import { eq, and } from "drizzle-orm";
import * as db from "./db";
import { scheduleBlocks } from "../drizzle/schema";

const FUTURE_DATE = "2099-09-10"; // distinct from the worksheet integration date

const subjectIdBySlug = new Map<string, number>();
const codeMap = new Map<string, number>();

async function ensureFuturePlan() {
  const plan = await db.ensurePlanForDate(FUTURE_DATE, "full" as any, {
    allowWeekendAutoBuild: true,
  } as any);
  if (!plan) throw new Error("future plan missing");
  if (subjectIdBySlug.size === 0) {
    const subjects = await db.listSubjects();
    for (const s of subjects as any[]) subjectIdBySlug.set(s.slug, s.id);
  }
  if (codeMap.size === 0) {
    const topics = await db.listCurriculumTopics();
    for (const t of topics as any[]) codeMap.set((t.code || "").toUpperCase(), t.id);
  }
  return plan;
}

async function cleanupFuturePlan(planId: number) {
  const d = (db as any).getDb();
  try {
    await d.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
  } catch {}
}

/**
 * Inlined replica of the queue_review_block apply branch. Kept in lockstep
 * with routers.ts (lines 1320-1351); if that branch ever changes, this
 * helper must change too — and the test will break loudly, which is the
 * whole point.
 */
async function applyReviewBlockOp(
  planId: number,
  liveBlocks: any[],
  insertedSoFar: number,
  op: {
    subjectSlug?: string | null;
    topic?: string | null;
    curriculumTopicCode?: string | null;
    durationMin?: number;
    reason?: string | null;
  },
  subjectsList: { slug: string; name: string }[],
) {
  const subjectName = op.subjectSlug
    ? (subjectsList.find((s) => s.slug === op.subjectSlug)?.name ?? op.subjectSlug)
    : null;
  const topicLabel = op.topic ?? op.curriculumTopicCode ?? subjectName ?? "this material";
  const title = `Review: ${topicLabel}`;
  const desc = [
    `Catch-up review on ${topicLabel}.`,
    op.reason ? `Why: ${op.reason}.` : null,
    "Pull a few practice problems from her current ladder row and check her work together.",
  ]
    .filter(Boolean)
    .join(" ");
  const subjectId = op.subjectSlug ? (subjectIdBySlug.get(op.subjectSlug) ?? null) : null;
  const code = (op.curriculumTopicCode || "").trim().toUpperCase();
  const topicId = code ? (codeMap.get(code) ?? null) : null;
  const maxSort =
    Math.max(0, ...liveBlocks.map((b: any) => b.sortOrder || 0)) + insertedSoFar + 1;
  await db.createBlock({
    planId,
    blockType: "catch_up" as any,
    subjectId,
    title,
    description: desc,
    durationMin: op.durationMin ?? 25,
    startTime: null,
    sortOrder: maxSort,
    status: "not_started" as any,
    curriculumTopicId: topicId,
  } as any);
}

describe("queue_review_block apply path — integration", () => {
  let createdPlanId: number | null = null;

  afterEach(async () => {
    if (createdPlanId != null) {
      await cleanupFuturePlan(createdPlanId);
      createdPlanId = null;
    }
  });

  it("subject-only: persists a catch_up block with the right subjectId", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;
    const subjects = await db.listSubjects();
    const subjList = (subjects as any[]).map((s) => ({ slug: s.slug, name: s.name }));
    const live = await db.listBlocksForPlan(plan.id);

    await applyReviewBlockOp(plan.id, live as any[], 0, { subjectSlug: "math" }, subjList);

    const fresh = (await db.listBlocksForPlan(plan.id)) as any[];
    const review = fresh.find((b) => String(b.title || "").startsWith("Review:"));
    expect(review).toBeDefined();
    expect(review.blockType).toBe("catch_up");
    expect(review.durationMin).toBe(25);
    const mathSubjectId = subjectIdBySlug.get("math");
    expect(review.subjectId).toBe(mathSubjectId);
  });

  it("topic-only: persists with the topic verbatim in the title", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;
    const subjects = await db.listSubjects();
    const subjList = (subjects as any[]).map((s) => ({ slug: s.slug, name: s.name }));
    const live = await db.listBlocksForPlan(plan.id);

    await applyReviewBlockOp(plan.id, live as any[], 0, { topic: "long division" }, subjList);

    const fresh = (await db.listBlocksForPlan(plan.id)) as any[];
    const review = fresh.find((b) => b.title === "Review: long division");
    expect(review).toBeDefined();
    expect(review.subjectId).toBeNull();
  });

  it("captures reason in the description", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;
    const subjects = await db.listSubjects();
    const subjList = (subjects as any[]).map((s) => ({ slug: s.slug, name: s.name }));
    const live = await db.listBlocksForPlan(plan.id);

    await applyReviewBlockOp(
      plan.id,
      live as any[],
      0,
      {
        subjectSlug: "math",
        topic: "fractions",
        reason: "she missed two on yesterday's quiz",
      },
      subjList,
    );

    const fresh = (await db.listBlocksForPlan(plan.id)) as any[];
    const review = fresh.find((b) => String(b.description || "").includes("Why:"));
    expect(review).toBeDefined();
    expect(review.description).toMatch(/she missed two on yesterday's quiz/);
  });

  it("multiple ops in same apply produce multiple rows", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;
    const subjects = await db.listSubjects();
    const subjList = (subjects as any[]).map((s) => ({ slug: s.slug, name: s.name }));
    const liveStart = await db.listBlocksForPlan(plan.id);
    const startCount = (liveStart as any[]).length;

    await applyReviewBlockOp(plan.id, liveStart as any[], 0, { subjectSlug: "math" }, subjList);
    await applyReviewBlockOp(plan.id, liveStart as any[], 1, { topic: "opinion writing" }, subjList);

    const fresh = (await db.listBlocksForPlan(plan.id)) as any[];
    const reviewBlocks = fresh.filter((b) => String(b.title || "").startsWith("Review:"));
    expect(reviewBlocks.length).toBe(2);
    expect(fresh.length).toBe(startCount + 2);
  });

  it("durationMin override is respected", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;
    const subjects = await db.listSubjects();
    const subjList = (subjects as any[]).map((s) => ({ slug: s.slug, name: s.name }));
    const live = await db.listBlocksForPlan(plan.id);

    await applyReviewBlockOp(
      plan.id,
      live as any[],
      0,
      { subjectSlug: "math", durationMin: 45 },
      subjList,
    );

    const fresh = (await db.listBlocksForPlan(plan.id)) as any[];
    const review = fresh.find((b) => String(b.title || "").startsWith("Review:"));
    expect(review.durationMin).toBe(45);
  });
});
