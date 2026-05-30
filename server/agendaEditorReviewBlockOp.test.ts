/**
 * Tests for the v3.17 `queue_review_block` op kind.
 * Pure validation + apply tests; no DB / no LLM.
 */
import { describe, it, expect } from "vitest";
import {
  validateEditPlan,
  applyEditPlanInMemory,
  type AgendaEditPlan,
  type AgendaPlanContext,
} from "./_lib/agendaEditor";

const baseCtx = (): AgendaPlanContext => ({
  planId: 7,
  date: "2026-05-30",
  dayLabel: "Saturday, May 30",
  studentName: "Reagan",
  gradeLevel: "5",
  tutorOfDayLabel: null,
  blocks: [
    { id: 101, title: "Warm-up", description: null, blockType: "morning_warmup", startTime: "09:00", durationMin: 15, sortOrder: 0, status: "not_started", subjectSlug: null, curriculumTopicCode: null },
    { id: 102, title: "Fractions intro", description: null, blockType: "math", startTime: "09:30", durationMin: 30, sortOrder: 1, status: "not_started", subjectSlug: "math", curriculumTopicCode: "OH.5.NF.1" },
    { id: 103, title: "Reading", description: null, blockType: "read_aloud", startTime: "10:30", durationMin: 25, sortOrder: 2, status: "not_started", subjectSlug: "ela", curriculumTopicCode: null },
  ],
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "ela", name: "English Language Arts" },
    { slug: "science", name: "Science" },
  ],
  topicCatalog: [
    { code: "OH.5.NF.1", title: "Adding fractions w/ unlike denominators", subjectSlug: "math" },
    { code: "OH.5.NF.4", title: "Multiplying fractions", subjectSlug: "math" },
    { code: "OH.5.W.1", title: "Opinion writing", subjectSlug: "ela" },
  ],
});

const emptyPlan = (ops: any[]): AgendaEditPlan => ({
  summary: "test",
  intent: "add",
  ops: ops as any,
  warnings: [],
});

describe("queue_review_block validation", () => {
  it("accepts an op with a valid subjectSlug only", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "math" }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
    expect((out.ops[0] as any).subjectSlug).toBe("math");
  });

  it("accepts an op with topic only (no subject)", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", topic: "long division" }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
  });

  it("accepts an op with curriculumTopicCode only", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", curriculumTopicCode: "OH.5.NF.4" }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
  });

  it("drops the op when none of subjectSlug, topic, or code provided", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", durationMin: 20 }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(0);
    expect(out.warnings.some((w) => /must specify/i.test(w))).toBe(true);
  });

  it("drops unknown subjectSlug but keeps op alive via topic", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "fakesub", topic: "metric system" }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
    expect((out.ops[0] as any).subjectSlug).toBe(null);
    expect(out.warnings.some((w) => /Dropped unknown subject/i.test(w))).toBe(true);
  });

  it("drops the entire op when unknown subject + no topic + no code", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "fakesub" }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(0);
  });

  it("drops unknown curriculumTopicCode but keeps op alive via subject", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      { kind: "queue_review_block", subjectSlug: "math", curriculumTopicCode: "OH.5.NOPE.99" },
    ]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
    expect((out.ops[0] as any).curriculumTopicCode).toBe(null);
    expect(out.warnings.some((w) => /Dropped unknown topic code/i.test(w))).toBe(true);
  });

  it("clamps durationMin into [5,90]", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      { kind: "queue_review_block", subjectSlug: "math", durationMin: 200 },
      { kind: "queue_review_block", topic: "fractions", durationMin: 1 },
    ]);
    const out = validateEditPlan(plan, ctx);
    expect((out.ops[0] as any).durationMin).toBe(90);
    expect((out.ops[1] as any).durationMin).toBe(5);
    expect(out.warnings.filter((w) => /Clamped queue_review_block/i.test(w)).length).toBe(2);
  });

  it("normalizes invalid afterBlockId to null", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "math", afterBlockId: 9999 }]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.length).toBe(1);
    expect((out.ops[0] as any).afterBlockId).toBe(null);
    expect(out.warnings.some((w) => /not found/i.test(w))).toBe(true);
  });
});

describe("queue_review_block applyEditPlanInMemory", () => {
  it("appends a catch-up block at end of day with default 25 min", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "math" }]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    expect(after.length).toBe(4);
    const last = after[after.length - 1];
    expect(last.blockType).toBe("catch_up");
    expect(last.durationMin).toBe(25);
    expect(last.subjectSlug).toBe("math");
    expect(last.title).toMatch(/^Review:/);
  });

  it("uses the topic verbatim when no subject is set", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", topic: "long division" }]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    expect(after[after.length - 1].title).toBe("Review: long division");
  });

  it("inserts after a specific block when afterBlockId is given", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      { kind: "queue_review_block", subjectSlug: "ela", afterBlockId: 102 },
    ]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    // Inserted right after block 102 (index 1), so index 2 is the new block
    expect(after[2].blockType).toBe("catch_up");
    expect(after[2].subjectSlug).toBe("ela");
  });

  it("captures the reason in the description", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      {
        kind: "queue_review_block",
        subjectSlug: "math",
        topic: "fractions",
        reason: "she missed two on yesterday's quiz",
      },
    ]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    const block = after[after.length - 1];
    expect(block.description).toMatch(/Why: she missed two on yesterday's quiz/);
  });

  it("propagates curriculumTopicCode to the synthesized block", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      { kind: "queue_review_block", subjectSlug: "math", curriculumTopicCode: "OH.5.NF.4" },
    ]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    const block = after[after.length - 1];
    expect(block.curriculumTopicCode).toBe("OH.5.NF.4");
  });

  it("uses subject DISPLAY name in the title when only subjectSlug is provided", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([{ kind: "queue_review_block", subjectSlug: "ela" }]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    expect(after[after.length - 1].title).toBe("Review: English Language Arts");
  });

  it("supports multiple consecutive review queues in the same plan", () => {
    const ctx = baseCtx();
    const plan = emptyPlan([
      { kind: "queue_review_block", subjectSlug: "math" },
      { kind: "queue_review_block", topic: "opinion writing" },
    ]);
    const after = applyEditPlanInMemory(ctx, validateEditPlan(plan, ctx));
    expect(after.length).toBe(5);
    expect(after[3].title).toBe("Review: Math");
    expect(after[4].title).toBe("Review: opinion writing");
  });
});
