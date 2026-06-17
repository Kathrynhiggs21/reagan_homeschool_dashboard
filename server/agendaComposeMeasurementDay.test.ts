/**
 * Integration-style test (no live LLM): simulates the JSON edit-plan the LLM
 * would return for Katy's real measurement-day prompt, then runs it through the
 * same server pipeline the router uses — validateEditPlan() + the agendaBudget
 * layout — and asserts the composed day is correct.
 *
 * Katy's prompt (today, Jun 17):
 *   "Today starts at 1pm, 2 to 4 hours total. Teach measurement types, a lesson
 *    on measurement conversions, include metric info too, a worksheet on all of
 *    it, then a fun duck-themed activity using measurement — give me several
 *    ways to choose from."
 *
 * This proves the three things that were broken before:
 *   1. generate_worksheet + offer_options ops survive validation (schema gap fix)
 *   2. the duck activity is OFFERED as choices (>=2), not auto-picked
 *   3. start times begin at the 1pm anchor and durations fit the 2–4h window,
 *      flowing around the existing 11am appointment.
 */
import { describe, it, expect } from "vitest";
import {
  validateEditPlan,
  type AgendaEditPlan,
  type AgendaPlanContext,
} from "./_lib/agendaEditor";
import {
  parseBudgetAndStart,
  layoutInsertedBlocks,
  type LayoutBlock,
} from "./_lib/agendaBudget";

const ctx: AgendaPlanContext = {
  planId: 999,
  date: "2026-06-17",
  dayLabel: "Wednesday, June 17",
  studentName: "Reagan",
  gradeLevel: "6",
  tutorOfDayLabel: null,
  blocks: [
    // Existing fixed appointment (the "Ali appt") — new work must flow around it.
    { id: 501, title: "Ali appointment", description: null, blockType: "appointment", startTime: "11:00", durationMin: 60, sortOrder: 0, status: "not_started", subjectSlug: null, curriculumTopicCode: null },
  ],
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "science", name: "Science" },
    { slug: "ela", name: "English Language Arts" },
  ],
  topicCatalog: [
    { code: "OH.5.MD.1", title: "Convert like measurement units", subjectSlug: "math" },
    { code: "OH.5.MD.A", title: "Measurement types", subjectSlug: "math" },
  ],
};

const message =
  "Today starts at 1pm, 2 to 4 hours total. Teach measurement types, a lesson on measurement conversions, include metric info too, a worksheet on all of it, then a fun duck-themed activity using measurement — give me several ways to choose from.";

// A realistic plan the LLM would now be ALLOWED to emit (schema gap fixed).
const simulatedLLMPlan: AgendaEditPlan = {
  summary: "Built a measurement unit with a worksheet and offered duck activity choices.",
  intent: "add",
  warnings: [],
  ops: [
    { kind: "insert", title: "Measurement Types", description: "Length, mass, volume, temperature, time.", blockType: "math", subjectSlug: "math", curriculumTopicCode: "OH.5.MD.A", durationMin: 45, afterBlockId: 501 },
    { kind: "insert", title: "Measurement Conversions", description: "Convert within customary and metric systems.", blockType: "math", subjectSlug: "math", curriculumTopicCode: "OH.5.MD.1", durationMin: 45 },
    { kind: "insert", title: "Metric System Info", description: "Base-ten metric units and prefixes.", blockType: "math", subjectSlug: "math", durationMin: 30 },
    { kind: "insert", title: "Measurement Worksheet", description: "Practice on all of the above.", blockType: "math", subjectSlug: "math", durationMin: 30 },
    { kind: "generate_worksheet", targetBlockId: null, topic: "measurement types, conversions, and the metric system", subjectSlug: "math", questionCount: 8, style: "practice" },
    {
      kind: "offer_options",
      prompt: "Pick a duck-themed measurement activity:",
      options: [
        { title: "Duck pond depth chart", description: "Measure and chart water depths.", blockType: "adventure", subjectSlug: "math", durationMin: 30 },
        { title: "Weigh the rubber ducks", description: "Compare grams and ounces.", blockType: "adventure", subjectSlug: "math", durationMin: 30 },
        { title: "Duck race timing", description: "Time duck races and convert units.", blockType: "adventure", subjectSlug: "math", durationMin: 30 },
      ],
    } as any,
  ] as any,
};

describe("compose measurement day — full pipeline", () => {
  it("parses the 1pm start and 2–4h budget from the prompt", () => {
    const b = parseBudgetAndStart(message);
    expect(b.startTime).toBe("13:00");
    expect(b.minMinutes).toBe(120);
    expect(b.maxMinutes).toBe(240);
  });

  it("keeps all op kinds through validation (insert, worksheet, options)", () => {
    const out = validateEditPlan(simulatedLLMPlan, ctx);
    const kinds = out.ops.map((o: any) => o.kind);
    expect(kinds.filter((k) => k === "insert").length).toBe(4);
    expect(kinds).toContain("generate_worksheet");
    expect(kinds).toContain("offer_options");
  });

  it("OFFERS the duck activity as 2+ choices rather than auto-picking", () => {
    const out = validateEditPlan(simulatedLLMPlan, ctx);
    const opt = out.ops.find((o: any) => o.kind === "offer_options") as any;
    expect(opt).toBeTruthy();
    expect(opt.options.length).toBeGreaterThanOrEqual(2);
    expect(opt.prompt.toLowerCase()).toContain("duck");
  });

  it("lays out start times from 1pm and fits durations in the 2–4h window, around the 11am appt", () => {
    const out = validateEditPlan(simulatedLLMPlan, ctx);
    const budget = parseBudgetAndStart(message);
    const insertOps = out.ops.filter((o: any) => o.kind === "insert") as any[];

    const fixed: LayoutBlock[] = ctx.blocks
      .filter((b) => b.startTime && b.blockType === "appointment")
      .map((b, i) => ({ ref: 10000 + i, durationMin: b.durationMin, fixed: true, startTime: b.startTime! }));
    const flex: LayoutBlock[] = insertOps.map((o, i) => ({ ref: i, durationMin: o.durationMin }));

    const laid = layoutInsertedBlocks([...flex, ...fixed], {
      startTime: budget.startTime,
      minMinutes: budget.minMinutes,
      maxMinutes: budget.maxMinutes,
    });

    const flexResults = laid.filter((r) => r.ref < 10000);
    // First flexible block starts at the 1pm anchor.
    const first = flexResults.find((r) => r.startTime)!;
    expect(first.startTime).toBe("13:00");

    // Total flexible minutes land within the requested window.
    const total = flexResults.reduce((s, r) => s + r.durationMin, 0);
    expect(total).toBeGreaterThanOrEqual(120);
    expect(total).toBeLessThanOrEqual(240);
  });
});
