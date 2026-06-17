/**
 * Tests for the v1 (2026-06-17) `offer_options` op kind — the "several ways →
 * pick one" path. Pure validation; writes nothing to the DB.
 *
 * Katy's request: when she asks for "several ways" (e.g. a duck-themed
 * measurement activity), the assistant should PROPOSE choices rather than pick
 * for her. The chosen option is later sent back as a normal insert.
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
  date: "2026-06-17",
  dayLabel: "Wednesday, June 17",
  studentName: "Reagan",
  gradeLevel: "6",
  tutorOfDayLabel: null,
  blocks: [
    { id: 101, title: "Measurement types", description: null, blockType: "math", startTime: "13:00", durationMin: 30, sortOrder: 0, status: "not_started", subjectSlug: "math", curriculumTopicCode: null },
  ],
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "science", name: "Science" },
  ],
  topicCatalog: [
    { code: "OH.5.MD.1", title: "Measurement conversions", subjectSlug: "math" },
  ],
});

const planWith = (ops: any[]): AgendaEditPlan => ({
  summary: "test",
  intent: "add",
  ops: ops as any,
  warnings: [],
});

describe("offer_options validation", () => {
  it("keeps a valid options op with 2+ choices and defaults the prompt", () => {
    const ctx = baseCtx();
    const plan = planWith([
      {
        kind: "offer_options",
        options: [
          { title: "Measure duck pond depths", description: "Use a ruler to chart depths.", durationMin: 30 },
          { title: "Weigh toy ducks", description: "Compare grams to ounces.", durationMin: 25 },
          { title: "Duck race timing", description: "Time ducks and convert seconds.", durationMin: 20 },
        ],
      },
    ]);
    const out = validateEditPlan(plan, ctx);
    const op = out.ops.find((o: any) => o.kind === "offer_options") as any;
    expect(op).toBeTruthy();
    expect(op.options.length).toBe(3);
    expect(op.prompt).toBe("Pick one:");
    // durations clamped to [5,180]
    expect(op.options.every((o: any) => o.durationMin >= 5 && o.durationMin <= 180)).toBe(true);
  });

  it("drops an options op with fewer than 2 valid choices and warns", () => {
    const ctx = baseCtx();
    const plan = planWith([
      { kind: "offer_options", options: [{ title: "Only one" }] },
    ]);
    const out = validateEditPlan(plan, ctx);
    expect(out.ops.find((o: any) => o.kind === "offer_options")).toBeUndefined();
    expect(out.warnings.join(" ")).toMatch(/fewer than 2/i);
  });

  it("caps the number of choices at 6", () => {
    const ctx = baseCtx();
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `Option ${i + 1}`, description: "d" }));
    const plan = planWith([{ kind: "offer_options", prompt: "Choose a duck activity:", options: many }]);
    const out = validateEditPlan(plan, ctx);
    const op = out.ops.find((o: any) => o.kind === "offer_options") as any;
    expect(op.options.length).toBe(6);
    expect(op.prompt).toBe("Choose a duck activity:");
  });

  it("writes nothing to the schedule when applied (no DB effect)", () => {
    const ctx = baseCtx();
    const plan = planWith([
      {
        kind: "offer_options",
        options: [
          { title: "A", description: "a" },
          { title: "B", description: "b" },
        ],
      },
    ]);
    const validated = validateEditPlan(plan, ctx);
    const before = ctx.blocks.length;
    const result = applyEditPlanInMemory(ctx, validated);
    // offer_options must not add/remove/modify any block.
    expect(result.length).toBe(before);
  });
});
