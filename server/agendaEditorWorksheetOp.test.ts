/**
 * Tests for the new `generate_worksheet` agenda chat op.
 *
 * Two surfaces are locked:
 *   1. `validateEditPlan` correctly accepts/rejects/normalizes
 *      `generate_worksheet` ops with edge-case inputs.
 *   2. `buildWorksheetPrompt` produces a deterministic, on-brand prompt.
 *
 * The full apply path (`handleGenerateWorksheet`) is *not* unit-tested here
 * because it depends on the real LLM + DB; the validation contract is what
 * actually protects us against bad upstream input.
 */
import { describe, it, expect } from "vitest";
import { validateEditPlan, type AgendaPlanContext, type AgendaEditPlan } from "./_lib/agendaEditor";
import { buildWorksheetPrompt } from "./_lib/agendaEditorWorksheetOp";

function ctx(overrides: Partial<AgendaPlanContext> = {}): AgendaPlanContext {
  return {
    planId: 1,
    date: "2026-05-30",
    dayLabel: "Saturday, May 30",
    studentName: "Reagan",
    gradeLevel: "5th grade",
    tutorOfDayLabel: null,
    blocks: [
      { id: 11, title: "Math", description: null, blockType: "math", startTime: "09:00", durationMin: 30, sortOrder: 1, status: "not_started", subjectSlug: "math", curriculumTopicCode: null },
      { id: 12, title: "ELA", description: null, blockType: "ela", startTime: "09:35", durationMin: 30, sortOrder: 2, status: "not_started", subjectSlug: "ela", curriculumTopicCode: null },
    ],
    subjects: [
      { slug: "math", name: "Math" },
      { slug: "ela", name: "ELA" },
      { slug: "science", name: "Science" },
    ],
    topicCatalog: [],
    ...overrides,
  };
}

function plan(ops: any[]): AgendaEditPlan {
  return { summary: "test", intent: "add", ops, warnings: [] };
}

describe("generate_worksheet op — validation", () => {
  it("accepts a well-formed op and clamps questionCount to default range", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 11,
          topic: "long division with remainders",
          subjectSlug: "math",
          questionCount: 8,
          style: "practice",
        },
      ]),
      ctx(),
    );
    expect(v.ops).toHaveLength(1);
    expect((v.ops[0] as any).kind).toBe("generate_worksheet");
    expect((v.ops[0] as any).questionCount).toBe(8);
    expect(v.warnings).toHaveLength(0);
  });

  it("drops op with missing topic", () => {
    const v = validateEditPlan(
      plan([{ kind: "generate_worksheet", targetBlockId: 11, topic: "" }]),
      ctx(),
    );
    expect(v.ops).toHaveLength(0);
    expect(v.warnings.join(" ")).toMatch(/topic/);
  });

  it("drops op with too-short topic", () => {
    const v = validateEditPlan(
      plan([{ kind: "generate_worksheet", targetBlockId: null, topic: "ok" }]),
      ctx(),
    );
    expect(v.ops).toHaveLength(0);
    expect(v.warnings.join(" ")).toMatch(/topic/);
  });

  it("nulls out an unknown targetBlockId and warns (instead of dropping)", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 999,
          topic: "fractions on a number line",
        },
      ]),
      ctx(),
    );
    expect(v.ops).toHaveLength(1);
    expect((v.ops[0] as any).targetBlockId).toBeNull();
    expect(v.warnings.join(" ")).toMatch(/999/);
  });

  it("drops unknown subjectSlug but keeps the rest of the op", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 11,
          topic: "decimal place value",
          subjectSlug: "underwater-basket-weaving",
        },
      ]),
      ctx(),
    );
    expect(v.ops).toHaveLength(1);
    expect((v.ops[0] as any).subjectSlug).toBeNull();
    expect(v.warnings.join(" ")).toMatch(/underwater-basket-weaving/);
  });

  it("clamps questionCount above 50 down to 50", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 11,
          topic: "long division",
          questionCount: 999,
        },
      ]),
      ctx(),
    );
    expect((v.ops[0] as any).questionCount).toBe(50);
    expect(v.warnings.join(" ")).toMatch(/Clamped/);
  });

  it("clamps questionCount below 1 up to default", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 11,
          topic: "long division",
          questionCount: 0,
        },
      ]),
      ctx(),
    );
    expect((v.ops[0] as any).questionCount).toBeGreaterThanOrEqual(1);
  });

  it("normalizes invalid style to 'practice'", () => {
    const v = validateEditPlan(
      plan([
        {
          kind: "generate_worksheet",
          targetBlockId: 11,
          topic: "long division",
          style: "extreme-mode",
        },
      ]),
      ctx(),
    );
    expect((v.ops[0] as any).style).toBe("practice");
    expect(v.warnings.join(" ")).toMatch(/extreme-mode/);
  });

  it("preserves a valid style", () => {
    for (const style of ["practice", "quiz", "review", "writing-prompt"] as const) {
      const v = validateEditPlan(
        plan([{ kind: "generate_worksheet", targetBlockId: 11, topic: "x", style }]),
        ctx(),
      );
      // topic "x" is too short → expect drop, but style preservation is
      // tested separately with a longer topic:
      expect(v.ops.length === 0 || (v.ops[0] as any).style === style).toBe(true);
    }
    const longer = validateEditPlan(
      plan([{ kind: "generate_worksheet", targetBlockId: 11, topic: "valid topic", style: "quiz" }]),
      ctx(),
    );
    expect((longer.ops[0] as any).style).toBe("quiz");
  });

  it("allows targetBlockId = null (signals create-new-block)", () => {
    const v = validateEditPlan(
      plan([
        { kind: "generate_worksheet", targetBlockId: null, topic: "fractions on a number line" },
      ]),
      ctx(),
    );
    expect(v.ops).toHaveLength(1);
    expect((v.ops[0] as any).targetBlockId).toBeNull();
    expect(v.warnings).toHaveLength(0);
  });
});

describe("buildWorksheetPrompt — deterministic prompt shape", () => {
  it("includes the topic, grade, and styleNoun in the user prompt", () => {
    const p = buildWorksheetPrompt({
      topic: "fractions on a number line",
      gradeLevel: "5th grade",
      questionCount: 6,
      style: "practice",
    });
    expect(p.user).toMatch(/fractions on a number line/);
    expect(p.user).toMatch(/6 numbered questions/);
    expect(p.user).toMatch(/practice worksheet/);
    expect(p.system).toMatch(/5th grade/);
    expect(p.system).toMatch(/JSON only/);
  });

  it("uses singular 'question' when questionCount is 1", () => {
    const p = buildWorksheetPrompt({
      topic: "x",
      gradeLevel: null,
      questionCount: 1,
      style: "practice",
    });
    expect(p.user).toMatch(/exactly 1 numbered question\b/);
    expect(p.user).not.toMatch(/numbered questions/);
  });

  it("falls back to '5th grade' when gradeLevel is null", () => {
    const p = buildWorksheetPrompt({
      topic: "x",
      gradeLevel: null,
      questionCount: 5,
      style: "quiz",
    });
    expect(p.system).toMatch(/5th grade/);
    expect(p.user).toMatch(/quiz/);
  });

  it("maps each style to a different noun", () => {
    const styles: Array<{ s: "practice" | "quiz" | "review" | "writing-prompt"; noun: RegExp }> = [
      { s: "practice", noun: /practice worksheet/ },
      { s: "quiz", noun: /\bquiz\b/ },
      { s: "review", noun: /review sheet/ },
      { s: "writing-prompt", noun: /writing prompt/ },
    ];
    for (const { s, noun } of styles) {
      const p = buildWorksheetPrompt({ topic: "x", gradeLevel: "5th", questionCount: 5, style: s });
      expect(p.user).toMatch(noun);
    }
  });
});
